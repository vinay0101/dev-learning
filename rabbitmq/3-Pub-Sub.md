# RabbitMQ: Publish/Subscribe (Pub/Sub) Pattern

This document explains the Publish/Subscribe (Pub/Sub) pattern in RabbitMQ, which differs from the competing consumer pattern by enabling the delivery of the **same message to multiple interested consumers**.

It's a powerful pattern for building decoupled, event-driven architectures where multiple services need to react to the same event.

## 🔑 Key Concepts

Here are the key takeaways for understanding the Pub/Sub pattern.

### Purpose of Pub/Sub
The pattern is used when multiple applications or microservices need to process the same message.

* **Example:** A "new account created" message might be consumed simultaneously by:
    * A user storage service.
    * An auditing service.
    * A promotions service.
* **Benefit:** This **decouples the producer** from the consumers. New services can be added to listen for the "new account created" event without requiring any changes to the producer service.

### Role of Exchanges
The power of Pub/Sub comes from **exchanges**. Instead of publishing directly to a queue, the producer sends its message to an exchange. The exchange is then responsible for routing the message to the correct queues.

While RabbitMQ offers various exchange types (direct, topic, headers), the **`fanout` exchange** is central to the basic Pub/Sub pattern.

### How a Fanout Exchange Works
A `fanout` exchange simply broadcasts (copies) all messages it receives to **all queues that are bound to it**.

1.  A producer publishes a message to the `fanout` exchange.
2.  The exchange looks at all queues bound to it.
3.  It copies the message and sends it to *each* of those bound queues.
4.  Each queue then delivers the message to its respective consumer.

This allows the producer to publish a message without even knowing which services (or how many) are consuming it.



### Bindings and Temporary Queues
* **Bindings:** For a queue to receive messages from an exchange, a **binding** must be created between them. Only queues bound to the exchange will receive the messages.
* **Temporary Queues:** Consumers can create **temporary, exclusive queues**. These are auto-named queues that are automatically deleted when the consumer's connection closes. This is perfect for Pub/Sub, as a consumer can just "tap into" the broadcast stream when it's online and be automatically cleaned up when it goes offline.

---

## 💻 Implementation Example

Here is a complete example in Node.js using `amqplib` showing one producer and two consumers.

### 1. The Producer (`producer.js`)
This script connects, asserts that a `fanout` exchange named `pubsub` exists, and then publishes a single message **to the exchange**, not to a specific queue. The routing key (`''`) is ignored by fanout exchanges.

```javascript
const amqp = require("amqplib");

const startProducer = async () => {
    const exchangeName = "pubsub";
    const exchangeType = "fanout";
    const message = "Hello I want to broadcast this message";

    try {
        const connection = await amqp.connect("amqp://localhost");
        const channel = await connection.createChannel();
        
        // Assert the exchange exists (and is a fanout)
        await channel.assertExchange(exchangeName, exchangeType, { durable: false });

        // Publish the message to the exchange, not to a queue
        // The routing key is ignored for fanout exchanges
        channel.publish(exchangeName, '', Buffer.from(message));
        
        console.log(`sent message: ${message}`);

        // Close connection after a short delay to ensure message is sent
        setTimeout(() => {
            connection.close();
            process.exit(0);
        }, 500);

    } catch (error) {
        console.error("Error in producer:", error);
    }
};

startProducer().catch(console.error);
```

---

![alt text](https://github.com/vinay0101/dev-learning/blob/main/rabbitmq/assets/pub-sub.png)
