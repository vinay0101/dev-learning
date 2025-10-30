Built and maintained a scalable, secure authentication system for 70M+ users using Node.js, Express, AWS
Lambda, API Gateway, JWT, and DynamoDB.

Q: "Walk me through the high-level architecture... How do API Gateway, Lambda, and DynamoDB interact during a login request?"
Example Answer: "Certainly. The entire flow was designed to be secure, scalable, and event-driven.

A user's client (web or mobile) sends a POST request with their email and password to our /login endpoint on Amazon API Gateway.

API Gateway is configured to proxy this request, which triggers our primary LoginHandler AWS Lambda function.

The Lambda function first sanitizes and validates the input using a library like Joi.

It then queries a DynamoDB table called Users. To find the user by email, it uses a Global Secondary Index (GSI) where the email is the partition key.

This GSI query returns the user's userId and their hashedPassword.

The Lambda function uses bcrypt.compare to securely check the provided password against the stored hash.

If the credentials are valid, the Lambda generates two tokens:

A short-lived Access Token (a JWT, 15-minute expiry) containing the userId and scope.

A long-lived Refresh Token (an opaque, random string, 30-day expiry).

The Lambda stores a hashed version of this Refresh Token in a separate RefreshTokens DynamoDB table, linking it to the userId.

Finally, the Lambda returns the Access Token in the JSON response body and sends the Refresh Token as a secure, httpOnly cookie. The client then uses the Access Token for all future requests."

Q: "Why choose a serverless (Lambda/API Gateway) architecture over a traditional, container-based (e.g., ECS/EKS with Express) approach?"
Example Answer: "That was a key design decision. We chose serverless for three main reasons:

Scalability & Concurrency: Authentication traffic is incredibly 'spiky.' We see massive peaks in the morning and near-zero traffic at 3 AM. A container-based system would require us to provision for that peak 24/7, which is expensive. Lambda scales from zero to thousands of concurrent requests automatically, and we only pay for the compute time we actually use.

Reduced Operational Overhead: With 70M users, my team needed to focus on security and features, not on patching OS, managing container orchestrators like Kubernetes, or configuring load balancers. API Gateway and Lambda are fully managed, which let our small team operate a massive-scale system.

Cost: For an event-driven function like login (which executes in <200ms), the pay-per-invocation model of Lambda is significantly cheaper than running an idle Express server on ECS all day.

The trade-off, of course, was cold starts. We mitigated this by enabling Provisioned Concurrency on our most critical functions (like LoginHandler and our TokenAuthorizer). This kept a 'warm pool' of Lambdas ready, virtually eliminating cold starts for 99.9% of users during peak times."
