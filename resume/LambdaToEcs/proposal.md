# Engineering Proposal: Migrating Backend Services from AWS Lambda to ECS Fargate

## 1. Executive Summary
Our current backend architecture relies on AWS Lambda triggered by API Gateway. While this provided a quick start, the ephemeral nature of Lambda has created bottlenecks in connection management, scalability during high-concurrency events (e.g., cricket tournaments), and integration with long-lived protocols like WebSockets and RabbitMQ. 

This document proposes a migration to **Amazon Elastic Container Service (ECS) on AWS Fargate** to establish a more robust, stateful, and performant microservices environment.

---

## 2. Problem Statement & Current Pain Points

### 2.1 Connection Pooling & Latency
Because Lambdas are short-lived, we cannot effectively reuse connection pools (Database, Redis, Hazelcast). Every invocation often requires a new TCP/TLS handshake, adding significant latency and overhead.

### 2.2 Cold Starts
Even with optimization, "cold starts" occur during scaling or after inactivity, impacting user experience during critical peak windows.

### 2.3 Deployment & Runtime Limits
* **Package Size:** We frequently hit the 250MB unzipped limit for Lambda layers.
* **Resources:** Lambda maxes out at 10GB RAM / 6 vCPUs, whereas ECS Fargate offers up to 120GB RAM and 16 vCPUs for heavier workloads.
* **Async Limitations:** Executing logic outside the handler scope (without `await`) is unreliable in Lambda as the execution environment freezes immediately after the response.

### 2.4 Protocol Constraints
* **RabbitMQ:** Establishing a persistent connection is impossible; we must re-connect for every message.
* **WebSockets:** We are forced to use API Gateway WebSocket API, preventing us from using native long-lived socket connections within our application logic.

---

## 3. Proposed Solution: ECS Fargate
Shifting to a containerized architecture allows our services to run as long-lived processes.



### Key Benefits
* **Persistent Runtime:** Initialize connection pools and internal caches once on startup.
* **No Cold Starts:** Requests are routed to already-running containers.
* **Express Compatibility:** Use frameworks like Express.js exactly as intended, with a persistent server listener.
* **Scalability:** Ability to launch up to 1,000 tasks per service with granular control over CPU and Memory.

---

## 4. Technical Comparison

| Feature | AWS Lambda | AWS ECS (Fargate) |
| :--- | :--- | :--- |
| **Pricing Model** | Per invocation / duration | Per vCPU and GB per hour |
| **Timeout** | Max 15 minutes | No practical limit |
| **Scaling** | Instant (but subject to burst limits) | Metric-based (Target Tracking) |
| **State** | Stateless | Stateful (In-memory/Connections) |
| **Code Size** | 250MB (Limited) | No practical limit (Docker image) |

---

## 5. Implementation Workflow

To move from Lambda to ECS, the following transition is required:

1. **Dockerization:** Build a Docker image for each service (replacing `serverless.yml`).
2. **Registry:** Push images to **Amazon ECR**.
3. **Orchestration:** - Define **Task Definitions** (Resources + Environment Variables).
   - Create an **ECS Service** to maintain the desired task count.
4. **Networking:** Deploy an **Application Load Balancer (ALB)** for traffic distribution and health checks.
5. **CI/CD:** Update Jenkins/GitHub Actions to build, push, and trigger a rolling update on ECS.

---

## 6. Scaling & Performance Strategy



### Handling High Concurrency
For peak events (e.g., 25k logins/min during Fantasy tournaments):
* **Target Tracking:** Scale based on "ALB Request Count per Target" or "Average CPU Utilization."
* **Provisioning Speed:** Our tests show scaling from 1 to 30 tasks takes **~60 seconds**.
* **Reliability:** Containers remain running once spun up, ensuring high availability during the duration of the event.

---

## 7. Cost Projection (Monthly)

| Item | Estimated Cost |
| :--- | :--- |
| **ECS Fargate** (50 Tasks across 10 Services) | ~$1,045 |
| **Load Balancers** (10 ALBs) | ~$400 |
| **ECR Storage** (1TB including history) | ~$100 |
| **Total Estimated Monthly Cost** | **$1,545** |

*Note: Costs can be significantly reduced (up to 70%) by utilizing **Fargate Spot** for non-critical workloads.*

---

## 8. Drawbacks & Mitigations

* **Operational Overhead:** Managing Docker images and ALBs.
  - *Mitigation:* Use CDK or Terraform to automate infrastructure.
* **Logging:** No unique ID per log by default.
  - *Mitigation:* Implement structured JSON logging with correlation IDs.
* **Complexity:** Environment variables must be set in SSM/Secrets Manager.
  - *Mitigation:* Use Task Definition secret injection to automate this.

---

## 9. Next Steps
- [ ] Conduct load testing on a single high-traffic service (PlatformGames).
- [ ] Define Docker best practices for the team.
- [ ] Set up a pilot ECR and ECS Cluster.
- [ ] Investigate **Service Connect** for internal inter-service communication.

---
**Date:** July 19, 2023 (Updated Feb 2026)
**Status:** Under Review
