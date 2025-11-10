# 🐇 RabbitMQ Node.js Setup

This guide walks through setting up RabbitMQ using Docker and creating a simple Node.js producer and consumer.

---

## Step 1: Start the RabbitMQ Server

First, we need to start the RabbitMQ message broker. We'll use the Docker command you provided. Open your terminal and run:

```bash
docker run -d --name my-rabbit -p 5672:5672 -p 15672:15672 rabbitmq:3-management
````

  * **-d**: Runs the container in detached mode (in the background).
  * **--name my-rabbit**: Gives your container a memorable name.
  * **-p 5672:5672**: Maps the standard AMQP port (used by the script) from the container to your local machine.
  * **-p 15672:15672**: Maps the RabbitMQ Management UI port to your local machine.
  * **rabbitmq:3-management**: Pulls the official RabbitMQ image that includes the management plugin.

### Check if it's running

Open your browser and go to `http://localhost:15672`.

You should see the RabbitMQ login page. Use the default credentials:

  * **Username:** `guest`
  * **Password:** `guest`

-----

## Step 2: Install Dependencies

For this Node.js example, you'll need the `amqplib` library.

```bash
npm install amqplib
```

-----

## Step 3: Create the Producer Script

Create a file named `producer.js` and paste the following code into it. This script sends a single message to the "letterbox" queue.

```javascript
const amqp = require("amqplib");

const startProducer = async () => {
    const queue = "letterbox";
    const message = "Hello this is my first message!";

    try {
        // Connect to the RabbitMQ server running in Docker
        // amqp://0.0.0.0 points to localhost on the host machine from the script
        const connection = await amqp.connect("amqp://0.0.0.0");
        const channel = await connection.createChannel();

        // Create the queue if it doesn't exist
        await channel.assertQueue(queue, { durable: false });
        console.log("Sending message to RabbitMQ...");

        // Send the message to the queue
        channel.sendToQueue(queue, Buffer.from(message));
        console.log("Message sent:", message);

        // Close the connection after a short delay
        setTimeout(() => {
            connection.close();
            process.exit(0);
        }, 500);
    } catch (error) {
        console.error("Error sending message from producer:", error);
    }
}

startProducer().catch(console.error);
```

-----

## Step 4: Create the Consumer Script

Create a second file named `consumer.js` and paste this code into it. This script connects to the same queue and waits to receive messages.

```javascript
const amqp = require("amqplib");

const onMessageReceived = (msg) => {
    const messageContent = msg.content.toString();
    console.log("Received message:", messageContent);
}

const startConsumer = async () => {
    const queue = "letterbox";

    try {
        const connection = await amqp.connect("amqp://0.0.0.0");
        const channel = await connection.createChannel();

        await channel.assertQueue(queue, { durable: false });
        console.log("Starting RabbitMQ consumer... Waiting for messages.");

        // Consume messages from the queue
        // { noAck: true } automatically acknowledges messages (good for simple examples)
        channel.consume(queue, onMessageReceived, { noAck: true });
    } catch (error) {
        console.error("Error starting RabbitMQ consumer:", error);
    }
};

startConsumer().catch(console.error);
```

-----

## Step 5: Run the Example

You'll need two separate terminal windows.

1.  **In Terminal 1 (Consumer):** Start the consumer script first. It will connect and wait for messages.

    ```bash
    node consumer.js
    ```

    *Output:*

    ```
    Starting RabbitMQ consumer... Waiting for messages.
    ```

2.  **In Terminal 2 (Producer):** Run the producer script.

    ```bash
    node producer.js
    ```

    *Output:*

    ```
    Sending message to RabbitMQ...
    Message sent: Hello this is my first message!
    ```

3.  **Check Terminal 1:** As soon as the producer runs, the message will appear in the consumer's terminal.
    *Output (in Terminal 1):*

    ```
    Starting RabbitMQ consumer... Waiting for messages.
    Received message: Hello this is my first message!
    ```

<!-- end list -->
