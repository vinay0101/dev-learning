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
