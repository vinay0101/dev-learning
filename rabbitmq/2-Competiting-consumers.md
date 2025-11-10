# 🐇 Competing Consumers (Work Queues)

This guide explains the **Competing Consumer** pattern (also known as a *work queue*), a common messaging strategy used to distribute time-consuming tasks among multiple workers. We'll cover the core concepts and then implement a practical example in Node.js.

---

## 📚 Key Concepts (The "Why")

This pattern is essential for building scalable and reliable systems.

### 🎯 The Problem: A Single Consumer Bottleneck

Imagine a scenario where a producer sends messages (tasks) faster than a single consumer can process them. This creates a few issues:
* **Message Backlog:** The queue grows continuously.
* **High Latency:** Messages at the end of the queue wait a long time to be processed.
* **Broker Strain:** A massive backlog can exhaust the memory of the RabbitMQ broker itself.

### 💡 The Solution: Competing Consumers

Instead of one consumer, we can run **multiple consumers** (workers) that all listen to the **same queue**. When a message arrives, RabbitMQ will deliver it to *one* of the available consumers. This effectively distributes the workload across all the workers.



### ⚠️ The Challenge: Uneven Processing (Default Behavior)

By default, RabbitMQ distributes messages in a **round-robin** fashion.
* Message 1 goes to Consumer A.
* Message 2 goes to Consumer B.
* Message 3 goes to Consumer A.
* ...and so on.

This works perfectly if all tasks take the same amount of time. But what if **Consumer A** gets a task that takes 10 seconds, and **Consumer B** gets one that takes 1 second?

With round-robin, Consumer B will finish its 1-second task and then sit idle. Meanwhile, Consumer A is still busy for 9 more seconds. The next message (Message 3) is *already assigned* to Consumer A, so it has to wait, even though Consumer B is free. This is inefficient.

### ✨ The Fix: Fair Dispatch with `prefetch(1)`

We can solve this by setting the **prefetch value to 1**.

* `channel.prefetch(1)` tells RabbitMQ: "Only send **one** message at a time to this worker. Do not send another message until the worker has **acknowledged** (finished) its current one."

With this setting, RabbitMQ only dispatches a new message to a worker that is **confirmed to be free**. The "fast" consumer (Consumer B) will process its 1-second task, acknowledge it, and immediately become available for the next message, while the "slow" consumer (Consumer A) is still busy.

### 🚀 Key Benefits

1.  **Scalability:** If messages are backing up, you can simply start more consumer applications. This allows you to easily scale your processing power up or down to meet demand.
2.  **Reliability:** If one consumer node fails or crashes, the other consumers on the same queue can continue processing messages. This ensures the workflow isn't completely interrupted.

---

## 💻 Practical Example (The "How")

Let's demonstrate this exact pattern in Node.js using `amqplib`.

### Setup

First, make sure you have the library installed:
```bash
npm install amqplib
````

And ensure your RabbitMQ server is running (e.g., via Docker):

```bash
docker run -d --name my-rabbit -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

### 1\. The Producer (`producer.js`)

This script simply produces a new message every 1-4 seconds and sends it to the `letterbox` queue.

```javascript
const amqp = require("amqplib");

// A helper function for an asynchronous sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const startProducer = async () => {
    const queue = "letterbox";
    
    try {
        // Connect to the local RabbitMQ server
        const connection = await amqp.connect("amqp://localhost");
        const channel = await connection.createChannel();
        
        // Ensure the queue exists
        await channel.assertQueue(queue, { durable: false });

        console.log("Starting producer...");
        let messageId = 1;

        // Infinite loop to send messages
        while (true) {
            const message = `Sending Message Id: ${messageId}`;
            
            // Send the message to the queue
            channel.sendToQueue(queue, Buffer.from(message));
            console.log(`sent message: ${message}`);
            
            // Wait for a random time (1-4 seconds)
            const sleepTimeMs = (Math.floor(Math.random() * 4) + 1) * 1000;
            await sleep(sleepTimeMs);

            messageId++;
        }
    } catch (error) {
        console.error("Error in producer:", error);
        process.exit(1); // Exit on error
    }
};

startProducer().catch(console.error);
```

### 2\. The Consumer (`consumer.js`)

This is our worker script. It connects to the *same* `letterbox` queue and simulates an uneven workload (1-6 seconds).

Notice these two key lines:

1.  `channel.prefetch(1);` - Implements the "fair dispatch" logic.
2.  `{ noAck: false }` & `channel.ack(msg);` - We are *manually* acknowledging messages. The `prefetch` setting relies on this acknowledgment to know when the worker is free.

<!-- end list -->

```javascript
const amqp = require("amqplib");

const startConsumer = async () => {
    const queue = "letterbox";

    try {
        const connection = await amqp.connect("amqp://localhost");
        const channel = await connection.createChannel();
        await channel.assertQueue(queue, { durable: false });

        // This is equivalent to basic_qos(prefetch_count=1)
        // It tells RabbitMQ to only send one message to this consumer at a time
        channel.prefetch(1); 
        
        console.log('Starting Consuming. Waiting for messages...');

        // Set up the consumer
        channel.consume(queue, (msg) => {
            if (msg === null) {
                // This can happen if the channel is closed
                return;
            }

            const body = msg.content.toString();
            // Get random processing time between 1 and 6 seconds
            const processingTime = Math.floor(Math.random() * 6) + 1;
            
            console.log(`received: "${body}", will take ${processingTime}s to process`);

            // Simulate the asynchronous work
            setTimeout(() => {
                console.log('finished processing and acknowledged message');
                
                // Manually acknowledge the message
                // This tells RabbitMQ the message has been processed
                channel.ack(msg);
                
            }, processingTime * 1000);
        }, {
            // noAck: false means we *must* send manual acknowledgments
            noAck: false 
        });

    } catch (error) {
        console.error("Error in consumer:", error);
        process.exit(1);
    }
};

startConsumer().catch(console.error);
```

-----

## 🏃‍♀️ How to See the Pattern in Action

To truly see the competing consumer pattern, you must run the producer and **at least two** consumers.

1.  **Open Terminal 1 (Producer):**

    ```bash
    node producer.js
    ```

    *You'll see it start sending messages.*

2.  **Open Terminal 2 (Consumer A):**

    ```bash
    node consumer.js
    ```

    *It will start receiving messages.*

3.  **Open Terminal 3 (Consumer B):**

    ```bash
    node consumer.js
    ```

**Observe the output across Terminals 2 and 3:** You will see the messages being distributed between both consumers. Because of `prefetch(1)`, if **Consumer A** gets a long (e.g., 6-second) task, **Consumer B** will immediately pick up the next message and may even process several 1-second tasks in the time it takes Consumer A to finish its single task. This is efficient load balancing.

```
```
