# 📘 Topics and Message Model

## 1. Introduction

Apache Kafka is a distributed event streaming platform that fundamentally differs from traditional database systems in how it stores and processes data. Instead of relying on mutable records in tables, Kafka uses **immutable logs** to capture and retain the full history of events.

This document explains the core concepts of **topics, logs, and message structure** in Kafka.

---

## 2. Traditional Database Model vs Kafka Model

### 2.1 Traditional Database Model
In relational databases:
- Data is stored in **tables**
- Each entity is represented as a **row**
- Updates modify existing rows

#### Limitations:
- Historical data is often lost due to updates
- Requires complex schema design to track changes over time
- Not optimized for event-driven or log-based use cases

---

### 2.2 Kafka Model
Kafka replaces tables with **logs**:
- Data is stored as a sequence of **immutable events**
- New data is **appended**, not updated
- Historical data is preserved

---

## 3. Kafka Topics

### 3.1 Definition
A **topic** is a fundamental abstraction in Kafka:
- A **topic is a log**
- It is an ordered, append-only sequence of messages

### 3.2 Characteristics
- Messages are written sequentially
- Multiple producers and consumers can interact with the same topic
- Topics can scale to handle large volumes of data

### 3.3 Example
Topic: `thermostat_readings`  
Each message represents a temperature reading from a sensor.

---

## 4. Log-Based Storage Model

### 4.1 Append-Only Design
- New messages are always added to the **end of the log**
- Existing messages are never modified

### 4.2 Immutability
- Messages are **immutable**
- Once written, they cannot be changed

### 4.3 Benefits
- Full historical record of events
- Enables replay and auditing
- Simplifies data consistency

---

## 5. Kafka is Not a Queue

Kafka is often mistakenly referred to as a queue; however, it is fundamentally different.

| Feature | Traditional Queue | Kafka Topic (Log) |
|--------|------------------|-------------------|
| Data after consumption | Removed | Retained |
| Multiple consumers | Limited | Supported |
| Replay capability | Not supported | Supported |

### Key Insight:
> Kafka topics allow multiple consumers to read the same data independently without data loss.

---

## 6. Message Structure

Each Kafka message consists of several components:

### 6.1 Value (Mandatory)
- The core data payload
- Represents the event itself
- Can be serialized in formats such as JSON, Avro, or Protobuf

```json
{
  "sensor_id": 42,
  "temperature": 24
}
````

---

### 6.2 Key (Optional)

* Identifier associated with the message
* Commonly used for:

  * Partitioning
  * Data grouping
* Example: `sensor_id`

---

### 6.3 Timestamp

* Indicates when the event occurred
* Can be:

  * Set by the producer
  * Assigned by Kafka broker

---

### 6.4 Headers

* Key-value metadata pairs
* Used for additional context
* Not intended to store primary data

---

### 6.5 Topic

* Logical category where the message is stored

---

### 6.6 Offset

* Unique identifier within a topic partition
* Starts at `0` and increments sequentially

---

## 7. Data Format and Schema

### 7.1 Schema-less Storage

* Kafka stores messages as **byte arrays**
* No enforced schema at the broker level

### 7.2 Common Serialization Formats

* JSON (human-readable)
* Avro (schema-based, efficient)
* Protocol Buffers (compact and fast)

### 7.3 Schema Management

* External tools (e.g., Schema Registry) are typically used

---

## 8. Data Retention

### 8.1 Retention Policy

Kafka allows configurable retention:

* Time-based (e.g., 7 days default)
* Size-based

### 8.2 Behavior

* Messages are automatically deleted after retention period expires
* Can be configured to retain data indefinitely

---

## 9. Log Compaction

### 9.1 Definition

Log compaction ensures that only the **latest value for each key** is retained.

### 9.2 Use Case

* When only the current state matters
* Example: user profile updates

### 9.3 Benefit

* Reduces storage usage
* Maintains up-to-date dataset

---

## 10. Event vs Message

### 10.1 Event

* A real-world occurrence
* Examples:

  * Temperature reading
  * User interaction

### 10.2 Message

* Serialized representation of an event in Kafka
* Includes metadata such as key, timestamp, and headers

### Note:

The terms *event* and *message* are often used interchangeably.

---

## 11. Data Transformation in Kafka

### 11.1 Immutable Data Handling

Since messages cannot be modified:

* Transformations create **new topics**

### 11.2 Example Workflow

1. Source topic: `thermostat_readings`
2. Process/filter data
3. Output topic: `hot_readings`

---

## 12. Key Takeaways

* Kafka uses **append-only logs** instead of mutable tables
* Topics are **ordered, immutable sequences of messages**
* Messages cannot be updated once written
* Kafka enables **data replay and multiple consumers**
* Schema is external; Kafka stores raw bytes
* Data retention and compaction provide flexibility in storage
