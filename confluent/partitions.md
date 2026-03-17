# 📘 Partitions

## 1. Introduction
Kafka uses **partitioning**, a fundamental concept that enables topics to be distributed across multiple nodes in a cluster.

This document explains the concept of **Kafka partitions**, their purpose, behavior, and impact on message ordering and scalability.

---

## 2. Motivation for Partitioning

### 2.1 Problem Without Partitioning
If a Kafka topic were stored on a single machine:
- Storage capacity would be limited to that machine
- Throughput would be constrained by a single node
- Scalability would be severely restricted

### 2.2 Solution: Partitioning
Kafka addresses this limitation by splitting a topic into multiple **partitions**, allowing:
- Distribution of data across multiple brokers
- Parallel processing of messages
- Horizontal scalability

---

## 3. Definition of a Partition

A **partition** is:
- A subset of a topic
- An **ordered, immutable log** of messages

Each topic consists of one or more partitions:
```

Topic
├── Partition 0
├── Partition 1
└── Partition 2

```

---

## 4. Partitioning and Scalability

### 4.1 Horizontal Scaling
- Each partition can reside on a different broker
- Enables Kafka to scale across clusters

### 4.2 High Throughput
- Producers and consumers can operate in parallel across partitions
- Improves performance for large-scale systems

### 4.3 Capacity
- Kafka supports **hundreds to thousands of partitions per topic**
- Modern versions support **millions of partitions across a cluster**

---

## 5. Message Ordering

### 5.1 Ordering Within a Partition
- Messages are strictly ordered **within a single partition**
- Each message is assigned a sequential **offset**

### 5.2 No Global Ordering
- Across multiple partitions:
  - No strict global ordering is guaranteed
  - Messages may be interleaved

### Key Insight:
> Kafka guarantees ordering **only within a partition**, not across the entire topic.

---

## 6. Partition Assignment Strategy

When a producer sends a message, Kafka determines which partition it should go to.

### 6.1 Without a Key (Null Key)

If the message has no key:
- Kafka uses **round-robin distribution**
- Messages are evenly distributed across partitions

#### Characteristics:
- Balanced load
- No ordering guarantee for related messages

---

### 6.2 With a Key

If a message includes a key:
- Kafka applies a **hash function** to the key
- Partition is determined using:
```

partition = hash(key) % number_of_partitions

```

#### Characteristics:
- All messages with the same key go to the **same partition**
- Ensures **ordering for that key**

---

## 7. Ordering with Keys

### 7.1 Key-Based Ordering Guarantee
- Messages with the same key:
  - Always routed to the same partition
  - Maintain strict order

### 7.2 Cross-Key Behavior
- Messages with different keys:
  - May go to different partitions
  - No ordering guarantee between them

---

## 8. Example: Thermostat System

### Without Key
- Messages from the same sensor may go to different partitions
- Ordering is not guaranteed

### With Key (sensor_id)
- All messages from a sensor:
  - Go to the same partition
  - Maintain chronological order

---

## 9. Benefits of Partitioning

Partitioning enables Kafka to achieve:

### 9.1 Scalability
- Topics can grow beyond a single machine's limits

### 9.2 Parallelism
- Multiple consumers can read from different partitions simultaneously

### 9.3 Load Distribution
- Workload is spread across brokers

### 9.4 Fault Tolerance (with replication)
- Partitions can be replicated across nodes (covered separately)

---

## 10. Key Takeaways

- A **partition is an ordered log within a topic**
- Topics are split into partitions for scalability
- Kafka guarantees **ordering only within a partition**
- Message routing depends on:
  - Key → hash-based partitioning
  - No key → round-robin distribution
- Using keys is essential when ordering matters
