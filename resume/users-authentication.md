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
