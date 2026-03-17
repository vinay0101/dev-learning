# 📘 Brokers

## 1. Introduction

While topics and partitions define how data is organized, **brokers** represent the physical infrastructure that stores and manages this data.

This document provides a detailed overview of Kafka brokers, their responsibilities, and their role within a Kafka cluster.

---

## 2. Definition of a Broker

A **broker** is:
- A server running the Kafka process
- Responsible for storing data and serving client requests

### Key Characteristics:
- Each broker is an independent machine (physical or virtual)
- Runs the Kafka server (JVM process)
- Participates as part of a Kafka cluster

---

## 3. Deployment Options

Kafka brokers can be deployed in various environments:

### 3.1 Physical Infrastructure
- On-premise servers with local storage
- Typically equipped with SSDs for high-performance I/O

### 3.2 Cloud Infrastructure
- Virtual machines (e.g., AWS, Azure, GCP)
- Managed environments

### 3.3 Containerized Environments
- Docker containers
- Orchestrated using Docker Compose or Kubernetes

### 3.4 Lightweight Systems
- Edge devices (e.g., Raspberry Pi)

---

## 4. Kafka Cluster

### 4.1 Definition
A **Kafka cluster** is a group of brokers working together.

```

Kafka Cluster
├── Broker 1
├── Broker 2
└── Broker 3

```id="kq4n1c"

### 4.2 Purpose
- Distributes data and workload
- Provides scalability and fault tolerance

---

## 5. Brokers and Partitions

### 5.1 Partition Hosting
- Each broker stores one or more **partitions**
- Partitions of a topic are distributed across brokers

### 5.2 Example
Topic with 3 partitions:
```

Broker 1 → Partition 0
Broker 2 → Partition 1
Broker 3 → Partition 2

```id="3z2y1g"

### 5.3 Multiple Topics
- A broker can host partitions from multiple topics
- Topics can have different partition counts

---

## 6. Responsibilities of a Broker

Brokers perform several critical functions:

### 6.1 Message Storage
- Persist messages to disk (log segments)
- Typically use local storage (e.g., SSDs)

### 6.2 Request Handling
- Handle **produce requests** (write messages)
- Handle **consume requests** (read messages)

### 6.3 Data Distribution
- Manage partition placement across the cluster

### 6.4 Replication Management
- Maintain copies of partitions across brokers
- Ensure data durability and fault tolerance

---

## 7. Client Interaction

Kafka clients interact with brokers:

### 7.1 Producers
- Send messages to topics
- Brokers write messages to partitions

### 7.2 Consumers
- Read messages from topics
- Brokers serve data from partitions

### Key Insight:
> Brokers act as intermediaries that handle all read and write operations for Kafka data.

---

## 8. Storage Model

### 8.1 Local Storage
- Brokers rely on **local disk storage**
- Data is stored in partition logs

### 8.2 Performance Considerations
- Sequential disk writes improve throughput
- SSDs are commonly used for optimal performance

---

## 9. Managed Kafka vs Self-Managed Kafka

### 9.1 Self-Managed Kafka
- Users configure and manage brokers directly
- Requires understanding of infrastructure

### 9.2 Managed Kafka (e.g., Confluent Cloud)
- Brokers are abstracted away
- Users interact with:
  - Topics
  - Messages
  - Connectors

### Key Insight:
> In managed environments, brokers exist but are hidden from the user.

---

## 10. Metadata Management (KRaft)

### 10.1 Historical Approach: ZooKeeper
- Previously used for:
  - Cluster metadata
  - Coordination

### 10.2 Modern Approach: KRaft (Kafka Raft)

As of Apache Kafka 4.0:
- ZooKeeper is removed
- Brokers manage metadata internally

### 10.3 KRaft Features
- Uses the **Raft consensus protocol**
- Provides:
  - Consistent metadata
  - Cluster coordination
  - Fault tolerance

---

## 11. Key Takeaways

- A **broker is a Kafka server instance**
- Multiple brokers form a **Kafka cluster**
- Brokers store and manage **topic partitions**
- They handle:
  - Message production and consumption
  - Data storage
  - Replication
- Modern Kafka uses **KRaft instead of ZooKeeper**
- In managed services, brokers are abstracted away

---
