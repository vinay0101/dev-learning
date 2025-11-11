# RabbitMQ Topic Exchange Example

This document explains the RabbitMQ Topic Exchange and provides Node.js code examples for a producer and multiple consumers.

## Topic Exchange Concepts

A **Topic Exchange** is a powerful routing method that allows for flexible pattern matching using wildcard characters in binding keys.

  * Routing keys for a topic exchange must be a list of words delimited by dots (e.g., `user.europe.payment`).
  * The `*` (star) wildcard matches **exactly one word** in the routing key.
  * The `#` (hash) wildcard matches **zero or more words** in the routing key.

-----

## Code Examples

### 1\. Producer (`producer.js`)

This script connects to RabbitMQ, asserts a `topic` exchange, and publishes two messages with different routing keys.

```javascript
const amqp = require("amqplib");

const startProducer = async () => {
    const exchangeName = "topic";
    const exchangeType = "topic";

    try {
        const connection = await amqp.connect("amqp://localhost");
        const channel = await connection.createChannel();
        
        // Assert the topic exchange exists
        await channel.assertExchange(exchangeName, exchangeType, { durable: false });

        // Message 1
        const msg1 = 'A european user paid for something';
        const key1 = 'user.europe.payments';
        channel.publish(exchangeName, key1, Buffer.from(msg1));
        console.log(`sent message [${key1}]: ${msg1}`);
        
        // Message 2
        const msg2 = 'A european business ordered goods';
        const key2 = 'business.europe.order';
        channel.publish(exchangeName, key2, Buffer.from(msg2));
        console.log(`sent message [${key2}]: ${msg2}`);

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

-----

### 2\. Consumers

These three consumers listen to the same `topic` exchange but use different binding keys to capture different messages.

#### User Consumer (`user_consumer.js`)

This consumer uses the binding key `user.#` to capture all messages that start with `user.`.

```javascript
const amqp = require("amqplib");

const startConsumer = async () => {
    const exchangeName = "topic";
    const exchangeType = "topic";
    const bindingKey = 'user.#'; // Matches 'user.anything'

    try {
        const connection = await amqp.connect("amqp://localhost");
        const channel = await connection.createChannel();

        await channel.assertExchange(exchangeName, exchangeType, { durable: false });
        const q = await channel.assertQueue('', { exclusive: true });
        
        console.log(`User Consumer: Queue '${q.queue}' created.`);
        await channel.bindQueue(q.queue, exchangeName, bindingKey);
        console.log(`Bound to exchange '${exchangeName}' with key '${bindingKey}'`);
        
        console.log('User Starting Consuming');

        channel.consume(q.queue, (msg) => {
            if (msg.content) {
                console.log(`User - received new message (key: ${msg.fields.routingKey}): ${msg.content.toString()}`);
            }
        }, {
            noAck: true
        });

    } catch (error) {
        console.error("Error in User Consumer:", error);
    }
};

startConsumer().catch(console.error);
```

#### Payments Consumer (`payments_consumer.js`)

This consumer uses the binding key `#.payments` to capture all messages that end with `.payments`.

```javascript
const amqp = require("amqplib");

const startConsumer = async () => {
    const exchangeName = "topic";
    const exchangeType = "topic";
    const bindingKey = '#.payments'; // Matches 'anything.payments'

    try {
        const connection = await amqp.connect("amqp://localhost");
        const channel = await connection.createChannel();

        await channel.assertExchange(exchangeName, exchangeType, { durable: false });
        const q = await channel.assertQueue('', { exclusive: true });
        
        console.log(`Payments Consumer: Queue '${q.queue}' created.`);
        await channel.bindQueue(q.queue, exchangeName, bindingKey);
        console.log(`Bound to exchange '${exchangeName}' with key '${bindingKey}'`);
        
        console.log('Payments Starting Consuming');

        channel.consume(q.queue, (msg) => {
            if (msg.content) {
                console.log(`Payments - received new message (key: ${msg.fields.routingKey}): ${msg.content.toString()}`);
            }
        }, {
            noAck: true
        });

    } catch (error) {
        console.error("Error in Payments Consumer:", error);
    }
};

startConsumer().catch(console.error);
```

#### Analytics Consumer (`analytics_consumer.js`)

This consumer uses the binding key `*.europe.*` to capture messages that have exactly three words, with the middle word being `europe`.

```javascript
const amqp = require("amqplib");

const startConsumer = async () => {
    const exchangeName = "topic";
    const exchangeType = "topic";
    const bindingKey = '*.europe.*'; // Matches 'word.europe.word'

    try {
        const connection = await amqp.connect("amqp://localhost");
        const channel = await connection.createChannel();

        await channel.assertExchange(exchangeName, exchangeType, { durable: false });
        const q = await channel.assertQueue('', { exclusive: true });
        
        console.log(`Analytics Consumer: Queue '${q.queue}' created.`);
        await channel.bindQueue(q.queue, exchangeName, bindingKey);
        console.log(`Bound to exchange '${exchangeName}' with key '${bindingKey}'`);
        
        console.log('Analytics Starting Consuming');

        channel.consume(q.queue, (msg) => {
            if (msg.content) {
                console.log(`Analytics - received new message (key: ${msg.fields.routingKey}): ${msg.content.toString()}`);
            }
        }, {
            noAck: true
        });

    } catch (error) {
        console.error("Error in Analytics Consumer:", error);
    }
};

startConsumer().catch(console.error);
```

-----

## Expected Output

If you run the producer and all three consumers simultaneously (in separate terminal windows):

  * **Producer sends:**

      * `[user.europe.payments]: A european user paid for something`
      * `[business.europe.order]: A european business ordered goods`

  * **User Consumer** (key `user.#`) **receives:**

      * `User - received new message (key: user.europe.payments): A european user paid for something`

  * **Payments Consumer** (key `#.payments`) **receives:**

      * `Payments - received new message (key: user.europe.payments): A european user paid for something`

  * **Analytics Consumer** (key `*.europe.*`) **receives:**

      * `Analytics - received new message (key: user.europe.payments): A european user paid for something`
      * `Analytics - received new message (key: business.europe.order): A european business ordered goods`
   
---

![alt text](https://github.com/vinay0101/dev-learning/blob/main/rabbitmq/assets/topic-exchange.png)
