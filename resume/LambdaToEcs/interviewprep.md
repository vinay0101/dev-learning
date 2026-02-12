# Interview Prep: AWS Lambda to ECS Migration

This guide prepares you to defend the "Contributed to architecture migration from AWS Lambda to ECS (Elastic Container Service), optimizing
compute resource utilization and improving service scalability and reliability by 40%." claim on your resume. 
As an SDE1, focus on **execution details** while acknowledging the **architectural "why"** established by the Tech Lead.

---

## 🚀 The Core Narrative (The STAR Method)

* **Situation:** Our backend used AWS Lambda, but during high-traffic events (25k logins/min), we faced high latency and "Too Many Connections" errors at the DB level because Lambda couldn't reuse connection pools.
* **Task:** Migrate 10 microservices from Lambda to ECS Fargate to establish a persistent runtime.
* **Action:** I refactored the code from a serverless wrapper to a standalone Express server, optimized Docker images using multi-stage builds, and configured the CI/CD pipeline for rolling updates.
* **Result:** Reduced connection-related errors and p99 latency by 40% during peak surges.

---

## 🧠 Section 1: Strategic "Why" Questions

### 1.1 Why not use Lambda Provisioned Concurrency?
**Answer:** While Provisioned Concurrency solves cold starts, it doesn't solve **Connection Exhaustion**. In Lambda, every execution environment eventually shuts down, and scaling up still creates a "thundering herd" of new DB connections. ECS keeps connections alive for the life of the container (days/weeks), which is much more efficient for our high-frequency DB/Redis calls.

### 1.2 Why Fargate over EC2?
**Answer:** We wanted to minimize **Operational Overhead**. Fargate allowed us to focus on the container logic without managing the underlying EC2 instances, OS patching, or cluster scaling. It provided the best balance of "Serverless ease" and "Server persistence."



---

## 🛠️ Section 2: Technical Execution (Your Role)

### 2.1 How did you handle the code refactor?
**Answer:** I removed `serverless-http` and set up a standard `app.listen(PORT)`. Crucially, I moved the Database and Hazelcast initialization logic **outside the request loop**. In Lambda, this was hit-or-miss; in ECS, it runs once at task startup, ensuring the service is "warm" before the ALB sends traffic.

### 2.2 How did you optimize the Docker images?
**Answer:** I implemented **Multi-stage builds**. 
* **Stage 1 (Build):** Installed full dev-dependencies and compiled TypeScript.
* **Stage 2 (Run):** Copied only the compiled JS and production `node_modules` into a **Distroless** or **Alpine** base image. 
* **Result:** This kept our images under 200MB, speeding up task launch times during scaling events.



---

## 📈 Section 3: Justifying the "40%" Metric

### 3.1 How was the 40% improvement calculated?
**Answer:** We compared metrics from a major cricket tournament before and after the migration:
1.  **Latency:** p99 latency dropped by **40%** because we eliminated the "TCP Handshake" overhead on every request.
2.  **Reliability:** 5xx errors caused by `ConnectionTimeoutException` decreased by **40%** because the connection pool was already established.
3.  **Efficiency:** In Lambda, we used 2GB RAM just to get enough CPU share. In ECS, we used **Task-level CPU/Memory tuning** to allocate exactly 0.5 vCPU and 1GB RAM, reducing compute waste by 40% per request.

---

## 🔍 Section 4: Deep Dives & Edge Cases

### 4.1 How did you handle Graceful Shutdowns?
**Answer:** ECS sends a `SIGTERM` when it wants to stop a task. I added a listener in my Node.js code:
```javascript
process.on('SIGTERM', () => {
  server.close(() => {
    db.disconnect(); // Ensure connections are closed cleanly
    process.exit(0);
  });
});

```

This prevents dropping active user requests during a deployment or scale-down.

### 4.2 How did you handle Distributed Tracing/Logging?

**Answer:** In Lambda, logs are isolated by request. In ECS, they are a continuous stream. I implemented **Structured JSON Logging** and ensured a `correlation-id` from the ALB header was attached to every log line, allowing us to trace a single user's journey across the service.

---

# Questions

## 🏗️ 1. The Strategy: "Why not RDS Proxy?"
**The Grill:** "AWS RDS Proxy handles connection pooling for Lambda. Why move the entire architecture to ECS just for pooling?"

**The Defense:**
* **Protocol Limitation:** RDS Proxy only supports MySQL and PostgreSQL. Our architecture relied on **RabbitMQ (AMQP)** and **Hazelcast**, which require persistent TCP connections that RDS Proxy cannot handle.
* **Holistic Solution:** Moving to ECS solved the "Connection Storm" issue for *all* our downstream dependencies (DBs, Caches, and Message Queues) simultaneously.
* **Overhead:** RDS Proxy adds an additional layer of latency and cost. By using native pooling in ECS, we kept the architecture "flat" and more performant.

---

## 📉 2. The Metric: "Justifying the 40% Improvement"
**The Grill:** "40% is a specific number. Where did it come from?"

**The Defense:**
* **Latency Math:** Our baseline p99 on Lambda was **~1.2s**. After migration, it dropped to **~720ms**.
* **The "Connection Tax":** We identified that 300ms–400ms of our Lambda latency was purely "handshake tax" (establishing TLS/TCP with Postgres and Redis). In ECS, these connections are established once at startup.
* **Reliability:** We tracked `503 Service Unavailable` errors during 25k/min login spikes. On Lambda, we hit **Burst Limits** and **Connection Limits**. On ECS, with pre-warmed pools, these errors dropped by 40% compared to previous tournament events.

---

## ⚡ 3. The Scaling Gap: "Lambda vs. ECS Speed"
**The Grill:** "Lambda scales in milliseconds. ECS takes 60-90 seconds. How do you survive a sudden 25k user surge?"

**The Defense:**
* **Predictive Scaling:** Since our traffic spikes are tied to match start times, we use **Scheduled Scaling** to increase the "Desired Task Count" 10 minutes before an event.
* **Aggressive Buffering:** We set Target Tracking at **50% CPU**. This means we always have 50% "headroom" to absorb a spike while Fargate provisions new containers.
* **Trade-off Acknowledgement:** We traded "Instant Scaling" for "Runtime Stability." For our specific domain (predictable sports events), stability was more valuable than reactive scaling.

---

## 💰 4. The Cost: "On-Demand vs. Spot"
**The Grill:** "Fargate is expensive. How did you manage the budget?"

**The Defense:**
* **Capacity Provider Strategy:** we used a split: 30% **FARGATE (On-Demand)** for a guaranteed baseline and 70% **FARGATE_SPOT** for cost savings.
* **Graceful Termination:** To prevent Spot interruptions from dropping user logins, I implemented a `SIGTERM` handler.
    * When AWS sends the 2-minute warning, the app catches `SIGTERM`.
    * It signals the ALB to stop sending traffic.
    * It drains active requests before the container shuts down.

---

## 🛠️ 5. The Execution: "SDE-1 Deep Dive"
**The Grill:** "What specific optimization did you perform on the containers?"

**The Defense:**
* **Multi-Stage Builds:** I wrote Dockerfiles that separated the *Build* environment (Node/TS/Build-tools) from the *Production* environment (Distroless/Alpine). This reduced image size from ~800MB to **<200MB**, significantly speeding up task launch times.
* **Health Check Logic:** I implemented a custom `/health` endpoint that checked not just if the server was up, but if the **DB Connection Pool** was healthy. This prevented the ALB from sending traffic to "zombie" containers.
* **Graceful Shutdown:** ```javascript
    process.on('SIGTERM', () => {
      server.close(() => {
        db.pool.end(); // Cleanly close pools
        process.exit(0);
      });
    });
    ```

---

## 📊 6. The "Blast Radius" Problem
**The Grill:** "In Lambda, if one function fails, only that route is down. In ECS, one bug can crash the whole container. Isn't that riskier?"

**The Defense:**
* **Domain Isolation:** We didn't put everything in one "Monolith" container. We grouped functions into **Microservices by Domain** (Auth, GameEngine, Payments).
* **Rolling Updates:** We used the **Minimum Healthy Percent (100%)** and **Maximum Percent (200%)** setting. During deployment, ECS starts the new version entirely before stopping the old one, ensuring no downtime if the new version fails to boot.

---
**Key Takeaway for Interviewer:** "As an SDE-1, I learned that architecture is about trade-offs. We traded the granular isolation of Lambda for the resource efficiency and connection stability of ECS, resulting in a significantly more reliable platform during our highest-traffic windows."
