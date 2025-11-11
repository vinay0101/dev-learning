# RabbitMQ: Direct Exchange Routing Example

This example demonstrates the **Direct Exchange** pattern in RabbitMQ using `amqplib`. We will create one producer and two consumers (one for "payments" and one for "analytics") to show how messages are routed based on an exact-matching routing key.

## 🧠 What is a Direct Exchange?

A Direct Exchange routes messages using **binding keys** and **routing keys** for exact matching. When a producer sends a message with a specific `routing key`, the direct exchange routes it *only* to queues that have a binding with an identical `binding key`.

* Multiple queues can share the same binding key.
* A single queue can have multiple bindings to receive different types of messages.



This example will route messages based on three keys:
1.  `paymentsOnly`: Should only go to the Payments Consumer.
2.  `analyticsonly`: Should only go to the Analytics Consumer.
3.  `both`: Should go to *both* consumers.

---

## 💻 The Code

Here are the three scripts needed for this example.

### 1. Producer (`producer.js`)

This script sends a single message to the `routing` exchange. It takes the **routing key** as a command-line argument (e.g., `node producer.js paymentsOnly`). If no key is provided, it defaults to `"both"`.

*Note: Typos from the original code (`exhangeName` and the connection string) have been corrected for functionality.*

```javascript
const amqp = require("amqplib");

const startProducer = async () => {
    const exchangeName = "routing";
    const exchangeType = "direct";

    // Get routing key from command-line arguments, default to 'both'
    const routingKey = process.argv[2] || 'both';
    const message = `Message sent with key: '${routingKey}'`;

    try {
        const connection = await amqp.connect("amqp://0.0.0.0");
        const channel = await connection.createChannel();

        await channel.assertExchange(exchangeName, exchangeType, { durable: false });

        channel.publish(exchangeName, routingKey, Buffer.from(message));
        console.log(`Sent: "${message}" with routing key: '${routingKey}'`);

        setTimeout(() => {
            connection.close();
            process.exit(0);
        }, 500);
    } catch (error) {
        console.error("Error in producer:", error);
    }
};

startProducer().catch(console.error);
````

-----

### 2\. Payments Consumer (`consumer_payments.js`)

This consumer creates its own exclusive queue. It binds that queue to the `routing` exchange with two binding keys: **`"paymentsOnly"`** and **`"both"`**.

```javascript
const amqp = require("amqplib");

const startConsumer = async () => {
    const exchangeName = "routing";
    const exchangeType = "direct";

    try {
        const connection = await amqp.connect("amqp://0.0.0.0");
        const channel = await connection.createChannel();

        await channel.assertExchange(exchangeName, exchangeType, {
            durable: false,
        });

        const q = await channel.assertQueue("", { exclusive: true });

        // Bind the queue to listen for 'paymentsOnly' and 'both'
        await channel.bindQueue(q.queue, exchangeName, "paymentsOnly");
        await channel.bindQueue(q.queue, exchangeName, "both");
        console.log("Starting 'Payments' consumer... Waiting for messages.");

        channel.consume(
            q.queue,
            (msg) => {
                if (msg.content) {
                    console.log(
                        `Payments Received: "${msg.content.toString()}" with routing key: '${
                            msg.fields.routingKey
                        }'`
                    );
                }
            },
            { noAck: true }
        );
    } catch (error) {
        console.error("Error in consumer:", error);
    }
};

startConsumer().catch(console.error);
```

-----

### 3\. Analytics Consumer (`consumer_analytics.js`)

This consumer *also* creates its own exclusive queue. It binds its queue to the same `routing` exchange but with two different binding keys: **`"analyticsonly"`** and **`"both"`**.

```javascript
const amqp = require("amqplib");

const startConsumer = async () => {
    const exchangeName = "routing";
    const exchangeType = "direct";

    try {
        const connection = await amqp.connect("amqp://0.0.0.0");
        const channel = await connection.createChannel();

        await channel.assertExchange(exchangeName, exchangeType, {
            durable: false,
        });

        const q = await channel.assertQueue("", { exclusive: true });

        // Bind the queue to listen for 'analyticsonly' and 'both'
        await channel.bindQueue(q.queue, exchangeName, "analyticsonly");
        await channel.bindQueue(q.queue, exchangeName, "both");
        console.log("Starting 'Analytics' consumer... Waiting for messages.");

        channel.consume(
            q.queue,
            (msg) => {
                if (msg.content) {
                    console.log(
                        `Analytics Received: "${msg.content.toString()}" with routing key: '${
                            msg.fields.routingKey
                        }'`
                    );
                }
            },
            { noAck: true }
        );
    } catch (error) {
        console.error("Error in consumer:", error);
    }
};

startConsumer().catch(console.error);
```

-----

## 🚀 How to Run the Example

You will need **three separate terminal windows**.

1.  **Install dependencies:**

    ```bash
    npm init -y
    npm install amqplib
    ```

2.  **Terminal 1: Start the Payments Consumer**
    Save the code as `consumer_payments.js` and run:

    ```bash
    node consumer_payments.js
    ```

    *Output:* `Starting 'Payments' consumer... Waiting for messages.`

3.  **Terminal 2: Start the Analytics Consumer**
    Save the code as `consumer_analytics.js` and run:

    ```bash
    node consumer_analytics.js
    ```

    *Output:* `Starting 'Analytics' consumer... Waiting for messages.`

4.  **Terminal 3: Run the Producer**
    Save the code as `producer.js`. Now, run it with different routing keys to see the results.

    -----

    **Scenario A: Send to Payments Only**

    ```bash
    node producer.js paymentsOnly
    ```

      * **Terminal 1 (Payments) Output:** `Payments Received: "Message sent with key: 'paymentsOnly'" with routing key: 'paymentsOnly'`
      * **Terminal 2 (Analytics) Output:** (Nothing)

    -----

    **Scenario B: Send to Analytics Only**

    ```bash
    node producer.js analyticsonly
    ```

      * **Terminal 1 (Payments) Output:** (Nothing)
      * **Terminal 2 (Analytics) Output:** `Analytics Received: "Message sent with key: 'analyticsonly'" with routing key: 'analyticsonly'`

    -----

    **Scenario C: Send to Both (using the "both" key)**

    ```bash
    node producer.js both
    ```

      * **Terminal 1 (Payments) Output:** `Payments Received: "Message sent with key: 'both'" with routing key: 'both'`
      * **Terminal 2 (Analytics) Output:** `Analytics Received: "Message sent with key: 'both'" with routing key: 'both'`

<!-- end list -->

---

![alt text](https://github.com/vinay0101/dev-learning/blob/main/rabbitmq/assets/direct-excahnge.png)
