# Users Authentication — Resume Notes

Built and maintained a scalable, secure authentication system for 70M+ users using Node.js, Express, AWS Lambda, API Gateway, JWT, and DynamoDB.

---

## Q: Walk me through the high-level architecture. How do API Gateway, Lambda, and DynamoDB interact during a login request?

Example answer:

Certainly. The entire flow was designed to be secure, scalable, and event-driven.

1. A user's client (web or mobile) sends a POST request with their email and password to our `/login` endpoint on Amazon API Gateway.
2. API Gateway is configured to proxy this request and triggers our primary `LoginHandler` AWS Lambda function.
3. The Lambda function sanitizes and validates the input (we used a validation library such as Joi).
4. It queries a DynamoDB table called `Users`. To find the user by email, the function uses a Global Secondary Index (GSI) where `email` is the partition key.
5. The GSI query returns the user's `userId` and `hashedPassword`.
6. The Lambda function uses `bcrypt.compare` to securely check the provided password against the stored hash.
7. If the credentials are valid, the Lambda generates two tokens:
   - A short-lived Access Token (a JWT, 15-minute expiry) containing `userId` and scope.
   - A long-lived Refresh Token (an opaque, random string, 30-day expiry).
8. The Lambda stores a hashed version of the Refresh Token in a separate `RefreshTokens` DynamoDB table, linked to the `userId`.
9. The Lambda returns the Access Token in the JSON response body and sends the Refresh Token as a secure, HttpOnly cookie.
10. The client uses the Access Token for authenticated requests until it expires, then exchanges the Refresh Token for a new Access Token.

---

## Q: Why choose a serverless (Lambda/API Gateway) architecture over a traditional, container-based (e.g., ECS/EKS with Express) approach?

Example answer:

That was a key design decision. We chose serverless for three main reasons:

- Scalability & Concurrency  
  Authentication traffic is highly spiky — massive peaks during business hours and very low traffic overnight. Serverless scales automatically to meet bursts of concurrent requests without manual provisioning. With containers, we would need to provision capacity or build autoscaling strategies that are more complex to operate and tune.

- Reduced Operational Overhead  
  With a user base of 70M, my team needed to focus on features and security rather than patching OS images, managing Kubernetes, or configuring load balancers. Serverless removes much of that operational burden: AWS manages the underlying infrastructure, runtime updates, and scaling.

- Cost Efficiency  
  For an event-driven function like login (which typically executes in <200ms), Lambda's pay-per-invocation model is significantly cheaper than running an always-on Express server in ECS/EKS.

Trade-offs and mitigations:

- Cold starts can be a downside. We mitigated cold starts by enabling Provisioned Concurrency on critical functions (e.g., `LoginHandler`, token authorizers) to keep a warm pool and maintain low latency.
- Observability and debugging require different tooling (AWS X-Ray, CloudWatch, structured logging) compared to containerized setups; we invested in tracing, structured logs, and metrics to maintain visibility.
- If long-lived connections or heavy compute are needed, containers or specialized services might be a better fit; for authentication flows, serverless provided the best balance of cost, scalability, and operational simplicity.

---

## Q: "What was your role in this? Did you design this from scratch... or... scaling/maintaining? What would you do differently?"
## Q: "How did you handle CI/CD for this serverless application? What did your deployment and rollback strategy look like?"

2. Scalability (70M+ Users)
Q: "70 million users is a significant scale. What was your DynamoDB key schema design... to avoid hot partitions...?"
Example Answer: "This was the most critical piece of the design. We used two main tables:

Users Table: The Partition Key (PK) was the userId, which was a UUID. This gave us perfect, high-cardinality distribution for all 'get profile' or 'update settings' operations, as all requests for a specific user would hit the same partition.

AuthIndex GSI: The login problem is that users log in with email, not userId. A scan is impossible. So, we created a Global Secondary Index (GSI) on the Users table called email-index. The PK of this GSI was the email attribute.

Since emails are unique and have high cardinality, this distributed our read traffic for logins evenly across the GSI's partitions, completely avoiding hot partitions during peak login times. We used On-Demand capacity for both the table and the GSI, so it scaled automatically with traffic spikes."

Q: "What were the primary performance bottlenecks you faced? Was it Lambda cold starts, DynamoDB read/write capacity...?"
Example Answer: "Our biggest bottleneck, by far, was Lambda cold starts. In our v1, a user hitting a cold start could experience a 4-5 second login, which was unacceptable. As mentioned, we solved this with Provisioned Concurrency on our user-facing Lambdas.

Our second biggest bottleneck was downstream service load. Our GetProfile Lambda (which reads from the Users table) was being called by every other microservice to get user details. This was creating read-pressure on our DynamoDB table. We solved this by implementing a caching layer."

Q: "How did you handle caching? Where did you implement it (e.g., DynamoDB DAX, ElastiCache) and what data was cached?"
Example Answer: "We used ElastiCache for Redis (not DAX, as we needed fine-grained control over what we cached). We implemented it using the cache-aside pattern.

We cached two main things:

"Hot" User Data: Data that's read often but changes rarely, like username, profilePictureUrl, and accountTier. When a service requested a user's profile, our Lambda would check Redis first. If it was a 'cache miss,' it would fetch from DynamoDB and then write the result to Redis with a 1-hour TTL.

JWT Revocation List: This was a security-driven use. When a user logged out, we'd add the jti (JWT ID) of their access token to a Redis set. Our authorizer checked this set, so it was a critical, high-throughput cache.

This caching layer dramatically reduced our DynamoDB read costs and took the load off our primary database, allowing it to focus on writes (like new user registrations)."

3. Security (A core part of auth)
Q: "You mention 'secure'. What were the top 3 security vulnerabilities you designed against?"
Example Answer: "As an auth system, we were a prime target. We focused heavily on the OWASP Top 10. My top 3 were:

Broken Authentication: We prevented this by:

Using bcrypt with a strong salt and work factor for all password hashing.

Implementing a Refresh Token flow, so our powerful Access Tokens (JWTs) were extremely short-lived (15 mins), minimizing their attack window.

Enforcing multi-factor authentication (MFA) for all admin accounts.

Injection: We used the principle of 'never trust user input.' Every request payload was passed through a schema validation library (Joi) in the Lambda before any business logic was run. This prevented any malformed data (and potential NoSQL injection vectors) from reaching our DynamoDB queries.

Broken Access Control: We ensured user 'A' could never access user 'B's data. We did this by never trusting a userId passed in the request body or URL. Our JWT Authorizer would validate the token and inject the trusted userId (from the token's sub claim) into the request context. All subsequent database queries used that userId."

Q: "Let's talk about JWTs. How did you handle JWT invalidation? For instance, what happens immediately when a user logs out...?"
Example Answer: "This is a classic 'stateless' challenge. We used a hybrid stateful approach for immediate invalidation.

Refresh Tokens (Easy Part): These were stateful. They were stored in a DynamoDB table. When a user logged out, we simply deleted the Refresh Token row from the database. That user could no longer get new Access Tokens.

Access Tokens (Hard Part): These are stateless and designed to be trusted until they expire. To invalidate them immediately, we used a Redis-based Deny List.

When a user logged out, we'd take the jti (JWT ID) claim from their current 15-minute Access Token.

We'd write that jti into a Redis set. We set the TTL on that Redis key to be the remaining life of the token (e.g., 14 minutes).

Our custom Lambda Authorizer, which ran on every authenticated request, would perform a sub-millisecond check against this Redis set. If the jti was in the deny list, it rejected the token with a 401.

This gave us the speed of stateless JWTs for most requests, but the security of immediate revocation when we needed it."

Q: "What data did you store in the JWT payload versus what did you query from DynamoDB... What were the trade-offs?"
Example Answer: "We kept our JWT payload as minimal as possible. It contained only:

sub (Subject): The userId (a UUID).

scope: An array of permissions, like ['read:profile', 'write:posts'].

Standard claims: iat (Issued At), exp (Expiry), iss (Issuer).

We explicitly did not store things like email, username, or accountTier in the token.

The Trade-off:

Con: This meant our downstream services had to make an extra API call (to our cache/DB) to get the user's name or email.

Pro (Why we did it):

Security: If a token was compromised, it exposed minimal PII.

Stale Data: If a user changes their username, all their old, valid JWTs would contain stale data. By forcing a lookup, we ensured services always had the freshest user data.

Size: JWTs are sent in HTTP headers, which have size limits. Keeping them small is critical."

Q: "How did you manage and rotate secrets (like your JWT signing key or database credentials) in this serverless environment?"
Example Answer: "We used AWS Secrets Manager for all secrets. Our JWT signing key was stored there.

For rotation, we used Secrets Manager's built-in rotation feature. We had a separate, dedicated Lambda function that Secrets Manager would invoke on a schedule (e.g., every 90 days). This Lambda would:

Generate a new key pair (public/private).

Store the new private key in Secrets Manager with the AWSCURRENT label.

The old private key would automatically be labeled AWSPREVIOUS.

Our AuthHandler Lambda (which signs tokens) was coded to only use the AWSCURRENT key. Our Authorizer Lambda (which verifies tokens) was coded to fetch and trust both AWSCURRENT and AWSPREVIOUS keys.

This allowed a seamless, zero-downtime rotation. Old tokens signed with the previous key were still valid until they expired, while all new tokens were signed with the new key."

Q: "What measures did you put in place to prevent brute-force or credential-stuffing attacks?"
Example Answer: "We had a multi-layered defense:

AWS WAF: At the edge, in front of API Gateway, we used AWS WAF. We used its managed rulesets to block known malicious IPs and to rate-limit IPs that were making an unusual number of requests to the /login endpoint.

API Gateway Throttling: We also applied fine-grained throttling in API Gateway itself, limiting a single IP to (for example) 10 login attempts per minute.

Application-Level Logic: After 5 failed login attempts for a specific account, our LoginHandler Lambda would 'soft-lock' the account. We wouldn't fully lock it (to prevent a DoS attack), but we would require a CAPTCHA to be solved for that username on all subsequent login attempts. This made automated attacks computationally expensive."

4. Operational & Problem Solving
Q: "How did you monitor the health of this system? What were your key metrics (SLIs/SLOs) for latency and error rates?"
Example Answer: "Our monitoring was centered in Amazon CloudWatch and AWS X-Ray. I built a primary CloudWatch Dashboard for our team.

Our key SLIs (Service Level Indicators) were:

Availability: The percentage of non-5xx (server error) responses from our API Gateway. Our SLO (Service Level Objective) was 99.9% (or "three nines").

Latency: The P99 (99th percentile) latency of our LoginHandler Lambda. Our SLO was P99 < 800ms.

Error Rate: We had specific CloudWatch Alarms for any spike in Lambda 5xx Errors or DynamoDB ThrottleEvents.

We also used AWS X-Ray for distributed tracing. This was a lifesaver, as it allowed us to see a full trace of a request as it flowed from API Gateway, to Lambda, to DynamoDB, and to Redis, letting us pinpoint exactly where a bottleneck was."

Q: "Tell me about a time the authentication service failed. What was the root cause, how did you diagnose it, and what was the permanent fix?"
Example Answer: (Using the STAR method: Situation, Task, Action, Result)

"Situation: We had a partial outage about a month after I rolled out the Redis-based JWT deny-list. At peak traffic (around 9 AM), our P99 login latency shot up from ~200ms to over 5 seconds, and we started seeing a cascade of 504 Gateway Timeouts.

Task: I was the on-call engineer. My job was to diagnose the issue and restore service as quickly as possible.

Action:

Diagnose: I first checked our CloudWatch dashboard. I saw Lambda P99 latency was through the roof, but our DynamoDB metrics (throttling, latency) were perfectly healthy. This told me the database was not the problem.

Trace: I immediately went to AWS X-Ray. The X-Ray trace showed the LoginHandler Lambda was spending 99% of its time (4-5 seconds) on one specific call: a Redis:GET command. The Redis cluster for our deny-list was the bottleneck.

Contain: I checked the ElastiCache metrics and saw its CPU was pegged at 100%. As a short-term fix, I scaled up the Redis instance type (from a t3.small to an r5.large). Within 10 minutes, the cluster was provisioned, CPU dropped, and P99 latency returned to normal. The outage was over.

Result (Permanent Fix): The root cause was a design flaw. We were using a single, small Redis cluster for both the high-throughput JWT deny-list (read on every API call) and our low-throughput user profile cache. We had massively underestimated the read load from the deny-list.

The permanent fix was to re-architect our caching layer. We split it into two:

A new, high-performance Redis cluster for the deny-list.

A separate, smaller cluster for the profile cache.

This isolated the workloads and taught me a valuable lesson: treat your caching layer with the same scaling and performance respect as your primary database."
