# Users Authentication — Resume Notes

Built and maintained a scalable, secure authentication system for 70M+ users using Node.js, Express, AWS Lambda, API Gateway, JWT, and DynamoDB.

---

## High-level architecture — Login flow (API Gateway → Lambda → DynamoDB)

1. Client POSTs email & password to /login on API Gateway.
2. API Gateway proxies request to LoginHandler (AWS Lambda).
3. Lambda validates input (Joi) and queries Users table via a GSI on email.
4. DynamoDB returns userId and hashedPassword.
5. Lambda verifies password with bcrypt.compare.
6. On success:
   - Create Access Token: JWT, 15m expiry (contains sub=userId, scope, jti).
   - Create Refresh Token: opaque random string, 30d expiry.
7. Store hashed Refresh Token in RefreshTokens DynamoDB table with TTL and userId.
8. Return Access Token in JSON and set Refresh Token as secure, HttpOnly cookie.
9. Client uses Access Token until expiry, then exchanges Refresh Token for new Access Token.

---

## Why serverless (Lambda + API Gateway) vs container-based (ECS/EKS)

- Scalability: Automatic concurrency scaling for spiky auth traffic.
- Reduced ops: Less infrastructure maintenance; team focused on features/security.
- Cost: Pay-per-invocation (Lambda) is cheaper for short-lived auth functions.
- Trade-offs & mitigations:
  - Cold starts → Provisioned Concurrency for critical Lambdas (LoginHandler, authorizers).
  - Observability → CloudWatch + AWS X-Ray + Grafana dashboards for traces/metrics.
  - Long-running/connection-heavy workloads → offloaded to containers if needed.

---

## My role

I led design and implementation end-to-end as the primary engineer on the auth service:
- Designed the serverless architecture (API Gateway → Lambda → DynamoDB).
- Implemented core Lambdas (login, refresh, revoke, authorizer) in Node.js.
- Built secure token flows (JWT access tokens, opaque refresh tokens).
- Implemented DynamoDB schemas (Users table and RefreshTokens table) and GSIs.
- Added in-memory caching layer for hot lookups and a Redis-like deny-list substitute (in-memory caches for local/short-lived speed; clustered Redis for production).
- Instrumented observability: CloudWatch metrics and traces, Grafana dashboards, alarms.
- Owned incident response, capacity planning, and performance tuning.

---

## CI/CD, deployment and rollback strategy

- CI: Jenkins pipelines run unit tests, linting, and integration tests on PRs.
- Packaging & Deployment: Serverless Framework packages Lambdas and CloudFormation templates; Jenkins deploys to staging then production.
- Canary & staged rollout: Use Lambda aliases and traffic shifting (CloudFormation/Serverless) to route a small % to new versions, monitor metrics.
- Automated checks: Post-deploy smoke tests + CloudWatch & Grafana health checks.
- Rollback: If errors or SLO breaches observed, Jenkins triggers alias rollback to the previous function version (instant) and notifies on-call.
- Secrets: JWT signing keys and DB credentials in AWS Secrets Manager with rotation.
- Infrastructure as code: All infra in Serverless/CloudFormation for repeatable rollbacks.

---

## DynamoDB schema & avoiding hot partitions

- Users table: PK = userId (UUID) for even distribution on profile reads/writes.
- GSI (email-index): PK = email for login lookups; emails have high cardinality to avoid hot partitions.
- RefreshTokens table: PK = tokenId or userId+tokenId with TTL for automatic expiration.
- Access patterns considered to keep read/write evenly distributed; use batch and exponential backoff on retries.

---

## Performance bottlenecks and mitigations

- Cold starts: Provisioned Concurrency; smaller, focused Lambdas to reduce startup time.
- Cache pressure: Split caching workloads — in-memory caching for very hot, local reads; dedicated Redis cluster for deny-list and high-throughput caches.
- Downstream load: Add local caches and TTLs; use asynchronous fan-out where possible.

---

## Caching strategy

- In-memory caching (local/Lambda ephemeral) for micro-latency hot lookups (username, profilePictureUrl) with short TTL.
- Dedicated Redis cluster (or ElastiCache) for:
  - JWT deny-list (high-throughput reads on each request) with TTL equal to remaining token life.
  - Profile cache for frequently-read, rarely-changed fields.
- Cache-aside pattern: read from cache → if miss, read DynamoDB → populate cache.

---

## Security: top mitigations

1. Broken Authentication
   - bcrypt with strong cost factor for passwords.
   - Short-lived JWTs (15m) + stateful Refresh Tokens (30d) stored hashed in DynamoDB.
   - Mandatory MFA for admin/critical accounts.

2. Injection & Input Validation
   - Joi validation for all inputs before business logic.
   - Parameterized queries and least privilege IAM roles.

3. Broken Access Control
   - Never trust user-supplied userId; always validate via JWT subject and authorizer.
   - Scoped tokens and role-based checks in services.

Secrets managed in AWS Secrets Manager with rotation; authorizers trust AWSCURRENT and AWSPREVIOUS keys during rotation window.

---

## JWT invalidation (logout / immediate revoke)

- Refresh Tokens: stateful — delete the refresh token row in DynamoDB on logout to prevent new access tokens.
- Access Tokens: deny-list stored in high-performance cache (Redis). On logout, write the token jti to the deny-list with TTL = remaining token lifetime. Lambda Authorizer checks deny-list on each request.

---

## Data in JWT vs runtime lookups

- JWT contains minimal claims:
  - sub: userId
  - scope: permissions
  - iat, exp, jti, iss
- Avoid PII in token to reduce risk & token size.
- Downstream services fetch user attributes (email, displayName, accountTier) from cache/DynamoDB when needed to avoid stale PII.

---

## Preventing brute-force & credential-stuffing

- AWS WAF in front of API Gateway for IP-level protections and managed rules.
- API Gateway throttling per route/IP.
- Application-level soft-lock after repeated failed attempts; escalate to CAPTCHA or challenge-based flow.
- Monitoring for anomalous patterns in Grafana/CloudWatch and automated blocking where required.

---

## Observability & SLIs/SLOs

- Metrics in CloudWatch; dashboards in Grafana:
  - Availability: % non-5xx responses; SLO = 99.9%.
  - Latency: P99 LoginHandler < 800ms.
  - Error rate: alarm on spikes of Lambda 5xx or DynamoDB throttles.
- Distributed tracing with AWS X-Ray for end-to-end traces.

---

## Incident example (summary)

- Problem: P99 login latency spiked due to Redis cluster saturation (deny-list and profile cache shared).
- Short-term: scaled Redis instance; restored latency.
- Long-term: split caches into dedicated clusters for deny-list vs profile cache, isolating workloads.

---

## Technologies used (concise)

Node.js, Express (local dev), AWS Lambda, API Gateway, DynamoDB (with GSIs), Serverless Framework / CloudFormation, JWT, bcrypt, RefreshTokens table, AWS Secrets Manager, ElastiCache/Redis + in-memory caching, AWS WAF, AWS X-Ray, CloudWatch, Grafana, Jenkins CI/CD.

---
