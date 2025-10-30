# SDE-2 Interview Prep: Authentication Service (70M Users)

This guide covers common SDE-2 interview questions and strong example answers based on the resume point: "Built and maintained a scalable, secure authentication system for 70M+ users using Node.js, Express, AWS Lambda, API Gateway, JWT, and DynamoDB."

## 1. System Design & Architecture

### Q: "Walk me through the high-level architecture... How do API Gateway, Lambda, and DynamoDB interact during a login request?"

> **A:** Certainly. The entire flow was designed to be secure, scalable, and event-driven.
>
> 1.  A user's client (web or mobile) sends a `POST` request with their email and password to our `/login` endpoint on **Amazon API Gateway**.
> 2.  API Gateway is configured to proxy this request, which triggers our primary `LoginHandler` **AWS Lambda** function.
> 3.  The Lambda function first sanitizes and validates the input using a library like `Joi`.
> 4.  It then queries a **DynamoDB** table called `Users`. To find the user by email, it uses a **Global Secondary Index (GSI)** where the `email` is the partition key.
> 5.  This GSI query returns the user's `userId` and their `hashedPassword`.
> 6.  The Lambda function uses `bcrypt.compare` to securely check the provided password against the stored hash.
> 7.  If the credentials are valid, the Lambda generates two tokens:
>     * A **short-lived Access Token** (a JWT, 15-minute expiry) containing the `userId` and `scope`.
>     * A **long-lived Refresh Token** (an opaque, random string, 30-day expiry).
> 8.  The Lambda stores a hashed version of this Refresh Token in a separate `RefreshTokens` DynamoDB table, linking it to the `userId`.
> 9.  Finally, the Lambda returns the Access Token in the JSON response body and sends the Refresh Token as a secure, `httpOnly` cookie.

### Q: "Why choose a serverless (Lambda/API Gateway) architecture over a traditional, container-based (e.g., ECS/EKS) approach?"

> **A:** That was a key design decision. We chose serverless for three main reasons:
>
> 1.  **Scalability & Concurrency:** Authentication traffic is incredibly 'spiky.' We see massive peaks in the morning and near-zero traffic at 3 AM. A container-based system would require us to provision for that peak 24/7, which is expensive. Lambda scales from zero to thousands of concurrent requests automatically, and we only pay for the compute time we actually use.
> 2.  **Reduced Operational Overhead:** With 70M users, my team needed to focus on security and features, not on patching OS, managing container orchestrators, or configuring load balancers. API Gateway and Lambda are fully managed.
> 3.  **Cost:** For an event-driven function like login (which executes in <200ms), the pay-per-invocation model of Lambda is significantly cheaper than running an idle `Express` server on ECS all day.
>
> The main **trade-off** was **cold starts**. We mitigated this by enabling **Provisioned Concurrency** on our most critical functions (like `LoginHandler` and our `TokenAuthorizer`), which kept a 'warm pool' of Lambdas ready.

### Q: "What was your role in this? Did you design this from scratch, or were you scaling/maintaining?"

> **A:** I led the design and implementation end-to-end as the primary engineer on the auth service. My responsibilities included:
>
> * **Designing the core serverless architecture** (API Gateway $\rightarrow$ Lambda $\rightarrow$ DynamoDB).
> * **Implementing the core Lambdas** (login, refresh, revoke, authorizer) in Node.js.
> * **Building the secure token flows**, including JWT access tokens and opaque refresh tokens.
> * **Implementing the DynamoDB schemas** for the `Users` and `RefreshTokens` tables, including the GSIs for login.
> * **Adding a multi-level caching layer:** An in-memory cache inside Lambda for hot configs and a clustered Redis for our JWT deny-list.
> * **Instrumenting complete observability:** I built our Grafana dashboards, CloudWatch metrics, and alarms.
> * **Owning operations:** This included incident response, capacity planning, and performance tuning.

### Q: "How did you handle CI/CD for this serverless application? What did your deployment and rollback strategy look like?"

> **A:** We had a robust, automated pipeline built for safety at scale.
>
> * **CI:** Our **Jenkins** pipeline ran unit tests, linting, and integration tests on every pull request.
> * **IaC:** We used the **Serverless Framework** to package our Lambdas and define all our AWS resources (like API Gateway, DynamoDB, and Lambda permissions) as a CloudFormation template.
> * **Deployment:** Jenkins would first deploy to `staging`. After tests passed, we used a **canary rollout** for production. The Serverless Framework would deploy the new function version and use **Lambda aliases** to shift a small percentage of traffic (e.g., 5%) to it.
> * **Monitoring:** We monitored our Grafana dashboards and CloudWatch alarms during this canary release.
> * **Rollback:** If we saw *any* SLO breaches (like increased error rates or latency), our Jenkins pipeline had a one-click **automated rollback**. This job would instantly shift 100% of the traffic back to the previous stable function version by updating the Lambda alias.

## 2. Scalability (70M+ Users)

### Q: "What was your DynamoDB key schema design... to avoid hot partitions...?"

> **A:** This was the most critical piece of the design for scale. We used two main tables:
>
> 1.  **`Users` Table:** The **Partition Key (PK)** was the `userId` (a UUID). This gave us perfect, high-cardinality distribution for all 'get profile' or 'update settings' operations.
> 2.  **`AuthIndex` GSI:** The login problem is that users log in with `email`, not `userId`. A scan is impossible. So, we created a **Global Secondary Index (GSI)** on the `Users` table. The **PK of this GSI was the `email` attribute**.
>
> Since emails are unique and high-cardinality, this distributed our *read traffic* for logins evenly across all of the GSI's partitions, completely avoiding hot partitions. We used **On-Demand capacity** for both the table and the GSI, so it scaled automatically.

### Q: "What were the primary performance bottlenecks you faced?"

> **A:** Our biggest bottleneck by far was **Lambda cold starts**. A user hitting a cold start could experience a 4-5 second login, which was unacceptable. We solved this with **Provisioned Concurrency** on our user-facing Lambdas.
>
> Our *second* bottleneck was **database read pressure**. Our `GetProfile` Lambda was being called by many other microservices just to get basic user details, which put a lot of read-pressure on our `Users` table. This led us to implement a caching layer.

### Q: "How did you handle caching? (e.g., DynamoDB DAX, ElastiCache)"

> **A:** We used **ElastiCache for Redis** (not DAX, as we needed more fine-grained control). We implemented it using the **cache-aside pattern**.
>
> We cached two main things:
>
> 1.  **"Hot" User Data:** Data that's read often but changes rarely, like `username`, `profilePictureUrl`, and `accountTier`. When a service requested a profile, our Lambda would check Redis first. A cache miss would fetch from DynamoDB and write the result to Redis with a 1-hour TTL.
> 2.  **JWT Revocation List:** This was our "deny-list" for security. When a user logged out, we'd add the `jti` (JWT ID) of their access token to a Redis set. Our authorizer checked this set, so it was a critical, high-throughput cache.
>
> This layer dramatically reduced our DynamoDB read costs and took the load off our primary database.

## 3. Security (A core part of auth)

### Q: "What were the top 3 security vulnerabilities you designed against?"

> **A:** We focused heavily on the **OWASP Top 10**. My top 3 were:
>
> 1.  **Broken Authentication:** We prevented this by using `bcrypt` with a strong salt for all password hashing. We also implemented a Refresh Token flow, so our Access Tokens (JWTs) were extremely short-lived (15 mins), minimizing their attack window.
> 2.  **Injection:** We used the principle of 'never trust user input.' Every request payload was passed through a schema validation library (`Joi`) in the Lambda *before* any business logic was run. This prevented any malformed data from reaching our database.
> 3.  **Broken Access Control:** We ensured user 'A' could never access user 'B's data. We did this by *never* trusting a `userId` from the request body. Our JWT Authorizer Lambda would validate the token and inject the *trusted* `userId` (from the token's `sub` claim) into the request context. All subsequent database queries used *that* `userId`.

### Q: "Let's talk about JWTs. How did you handle JWT invalidation? (e.g., on logout)"

> **A:** This is a classic 'stateless' challenge. We used a **hybrid stateful approach** for immediate invalidation.
>
> * **Refresh Tokens (Easy Part):** These were stateful. They were stored in our `RefreshTokens` DynamoDB table. When a user logged out, we simply **deleted the Refresh Token row** from the database.
> * **Access Tokens (Hard Part):** These are stateless. To invalidate them immediately, we used our **Redis-based Deny List**.
>     1.  When a user logged out, we'd take the `jti` (JWT ID) claim from their current 15-minute Access Token.
>     2.  We'd write that `jti` into a Redis set. We set the **TTL on that Redis key to be the remaining life of the token** (e.g., 14 minutes).
>     3.  Our custom Lambda Authorizer, which ran on *every* authenticated request, would perform a sub-millisecond check against this Redis set. If the `jti` was in the deny list, it rejected the token with a `401`.

### Q: "What data did you store in the JWT payload versus what did you query from DynamoDB?"

> **A:** We kept our JWT payload **as minimal as possible**. It contained only:
>
> * `sub` (Subject): The `userId`.
> * `scope`: An array of permissions, like `['read:profile', 'write:posts']`.
> * Standard claims: `iat` (Issued At), `exp` (Expiry), `iss` (Issuer).
>
> We **explicitly did not** store things like `email` or `username` in the token.
>
> **The Trade-off:**
> * **Con:** This meant our downstream services had to make an extra API call (to our cache/DB) to get the user's name.
> * **Pro (Why we did it):**
>     1.  **Security:** If a token was compromised, it exposed minimal PII.
>     2.  **Stale Data:** If a user changes their username, all their old, valid JWTs would contain *stale* data. By forcing a lookup, we ensured services *always* had the freshest user data.
>     3.  **Size:** JWTs are sent in HTTP headers, which have size limits. Keeping them small is critical.

### Q: "How did you manage and rotate secrets (like your JWT signing key)?"

> **A:** We used **AWS Secrets Manager** for all secrets. Our JWT signing key was stored there.
>
> For **rotation**, we used Secrets Manager's built-in feature. We had a separate, dedicated Lambda function that Secrets Manager would invoke on a schedule (e.g., every 90 days). This Lambda would:
>
> 1.  Generate a *new* key pair.
> 2.  Store the new private key in Secrets Manager with the `AWSCURRENT` label.
> 3.  The *old* private key would automatically be labeled `AWSPREVIOUS`.
>
> Our `AuthHandler` Lambda (which *signs* tokens) was coded to *only* use the `AWSCURRENT` key.
> Our `Authorizer` Lambda (which *verifies* tokens) was coded to fetch and trust *both* `AWSCURRENT` and `AWSPREVIOUS` keys.
>
> This allowed a seamless, zero-downtime rotation. Old tokens were still valid until they expired, while all new tokens were signed with the new key.

### Q: "What measures did you put in place to prevent brute-force or credential-stuffing attacks?"

> **A:** We had a multi-layered defense:
>
> 1.  **AWS WAF:** At the edge, in front of API Gateway, we used WAF to block known malicious IPs and to rate-limit IPs that were making an unusual number of requests to the `/login` endpoint.
> 2.  **API Gateway Throttling:** We also applied fine-grained throttling in API Gateway itself, limiting a single IP to (for example) 10 login attempts per minute.
> 3.  **Application-Level Logic:** After 5 failed login attempts for a *specific account*, our `LoginHandler` Lambda would 'soft-lock' the account by requiring a **CAPTCHA** to be solved for that username on all subsequent login attempts. This made automated attacks computationally expensive.

## 4. Operational & Problem Solving

### Q: "How did you monitor the health of this system? What were your key metrics (SLIs/SLOs)?"

> **A:** I built our primary monitoring dashboard in **Grafana**, which pulled data from **Amazon CloudWatch**.
>
> Our key **SLIs (Service Level Indicators)** were:
>
> * **Availability:** The percentage of **non-5xx** (server error) responses from our API Gateway. Our **SLO (Service Level Objective)** was **99.9%**.
> * **Latency:** The **P99 (99th percentile)** latency of our `LoginHandler` Lambda. Our **SLO** was **P99 < 800ms**.
> * **Error Rate:** We had specific CloudWatch Alarms for any spike in `Lambda 5xx Errors` or `DynamoDB ThrottleEvents`.
>
> We also used **AWS X-Ray** for distributed tracing, which was a lifesaver for debugging the exact source of latency in a request.

### Q: "Tell me about a time the authentication service failed. What was the root cause, how did you diagnose it, and what was the permanent fix?"

> **A:** *(Using the STAR method: Situation, Task, Action, Result)*
>
> * **Situation:** We had a partial outage one morning where our P99 login latency shot up from ~200ms to over 5 seconds. Our Grafana dashboard lit up, and we started seeing a cascade of 504 Gateway Timeouts.
> * **Task:** I was the on-call engineer. My job was to diagnose the issue and restore service as quickly as possible.
> * **Action:**
>     1.  **Diagnose:** I first checked our Grafana dashboard. I saw Lambda P99 latency was through the roof, but our DynamoDB metrics were perfectly healthy. This told me the database was not the problem.
>     2.  **Trace:** I immediately went to **AWS X-Ray**. The X-Ray trace showed the `LoginHandler` Lambda was spending 99% of its time (4-5 seconds) on one specific call: a `Redis:GET` command. The Redis cluster for our JWT deny-list was the bottleneck.
>     3.  **Contain:** I checked the ElastiCache metrics and saw its CPU was pegged at 100%. As a short-term fix, I scaled up the Redis instance type (from a `t3.small` to an `r5.large`). Within 10 minutes, the cluster was provisioned, CPU dropped, and P99 latency returned to normal.
> * **Result (Permanent Fix):**
>     The **root cause** was a design flaw. We were using a single, small Redis cluster for *both* the high-throughput JWT deny-list (read on *every* API call) and our low-throughput user profile cache. We had massively underestimated the read load from the deny-list.
>
>     The **permanent fix** was to re-architect our caching layer. We split it into two:
>
>     1.  A new, high-performance Redis cluster dedicated to the deny-list.
>     2.  A separate, smaller cluster for the profile cache.
>
>     This isolated the workloads and taught me a valuable lesson: treat your caching layer with the same scaling and performance respect as your primary database.
