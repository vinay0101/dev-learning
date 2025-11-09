
# KafkaJS Producer-Consumer Example

This project demonstrates a basic Kafka setup using Docker for Zookeeper and Kafka. It includes Node.js scripts using `kafkajs` for:
* An **admin** client to create topics.
* A **producer** client to send messages from the command line.
* A **consumer** client to subscribe to topics and print messages.

The example is designed to show how producers can manually route messages to different partitions and how consumer groups work.

## Project File Structure

Before you begin, create the following files in your project directory:

```

.
├── admin.js        \# Script to create the Kafka topic
├── client.js       \# Shared Kafka client configuration
├── consumer.js     \# Script to consume messages
├── producer.js     \# Script to produce messages
└── package.json    \# Node.js project file

````

---

## Setup and Running Instructions

### 1. Prerequisites

* **Docker:** You must have Docker and Docker Desktop (or Docker Engine) installed and running.
* **Node.js:** You need Node.js (version 14 or higher) and `npm` installed.

### 2. Create Project Files

Copy the code you provided into the corresponding files.

**`client.js`**
```javascript
const { Kafka } = require('kafkajs');

module.exports.kafka = new Kafka({
    clientId: 'my-app',
    brokers: ['127.0.0.1:9092'], // Use 127.0.0.1 or localhost
});
````

**`admin.js`**

```javascript
const { kafka } = require('./client');

async function init() {
    const admin = kafka.admin();
    console.log('Connecting admin...');
    await admin.connect();
    console.log('Admin connected.');

    console.log('Creating topic "rider-updates"...');
    await admin.createTopics({
        topics: [
            {
                topic: 'rider-updates',
                numPartitions: 2, // 2 partitions (0 and 1)
            }
        ]
    });
    console.log('Topic "rider-updates" created.');

    console.log('Disconnecting admin...');
    await admin.disconnect();
    console.log('Admin disconnected.');
}

init().catch(e => console.error(`[admin] ${e.message}`, e));
```

**`producer.js`**

```javascript
const { kafka } = require("./client");
const readline = require("readline");

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

async function init() {
	const producer = kafka.producer();
	console.log("Connecting producer...");
	await producer.connect();
	console.log("Producer connected.");

	rl.setPrompt("Enter [RiderName] [Location] (e.g., 'Anil north' or 'Sunil south')\n> ");
	rl.prompt();

	rl.on("line", async (line) => {
		const [riderName, location] = line.split(" ");

        if (!riderName || !location) {
            console.log("Invalid format. Please use 'RiderName Location'.");
            rl.prompt();
            return;
        }

        const partition = location.toLowerCase() === "north" ? 0 : 1;
        console.log(`Sending to partition ${partition}...`);

		await producer.send({
			topic: "rider-updates",
			messages: [
				{
                    partition: partition, // Explicitly setting partition
					key: "location-update",
					value: JSON.stringify({ name: riderName, loc: location }),
				},
			],
		});
	}).on("close", async () => {
		await producer.disconnect();
		console.log("Producer disconnected.");
	});
}

init().catch(e => console.error(`[producer] ${e.message}`, e));
```

**`consumer.js`**

```javascript
const { kafka } = require("./client");

// Consumer group ID is passed as a command-line argument
const group = process.argv[2];

if (!group) {
    console.error("Please provide a consumer group ID. Example: node consumer.js group-1");
    process.exit(1);
}

async function init() {
    const consumer = kafka.consumer({ groupId: group });
    console.log(`Connecting consumer in group "${group}"...`);
    await consumer.connect();
    console.log('Consumer connected.');

    await consumer.subscribe({ topic: 'rider-updates', fromBeginning: true });
    console.log(`Subscribed to topic "rider-updates" as group "${group}".`);

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const prefix = `[Group: ${group}] | Topic: ${topic} | Partition: ${partition} | Offset: ${message.offset}`;
            console.log(`${prefix} | Key: ${message.key.toString()} | Value: ${message.value.toString()}`);
        },
    });
}

init().catch(e => console.error(`[consumer/${group}] ${e.message}`, e));
```

### 3\. Install Dependencies

In your terminal, initialize your Node.js project and install `kafkajs`:

```sh
# Initialize a package.json
npm init -y

# Install kafkajs and readline
npm install kafkajs readline
```

### 4\. Start Kafka and Zookeeper

Open a terminal and run the following Docker commands one by one.

**1. Start Zookeeper:**

```sh
docker run -d \
  --name zookeeper \
  -p 2181:2181 \
  -e ZOOKEEPER_CLIENT_PORT=2181 \
  -e ZOOKEEPER_TICK_TIME=2000 \
  confluentinc/cp-zookeeper:7.2.1
```

**2. Start Kafka:**

```sh
docker run -d \
  --name kafka \
  -p 9092:9092 \
  --link zookeeper \
  -e KAFKA_BROKER_ID=1 \
  -e KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://127.0.0.1:9092 \
  -e KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092 \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  confluentinc/cp-kafka:7.2.1
```

> **Note:** `KAFKA_ADVERTISED_LISTENERS` is set to `127.0.0.1:9092` (localhost). This is the address the broker tells your Node.js scripts (running on your host machine) to connect to. `KAFKA_LISTENERS` is set to `0.0.0.0:9092`, which is what the broker listens to *inside* the Docker container.

### 5\. Create the Kafka Topic

Run the `admin.js` script to create the `rider-updates` topic.

```sh
node admin.js
```

You should see "Topic 'rider-updates' created."

### 6\. Run the Consumer(s)

Open a **new terminal** and start a consumer. You must provide a group name.

```sh
node consumer.js group-1
```

This consumer will now wait for messages.

### 7\. Run the Producer

Open a **third terminal** and start the producer.

```sh
node producer.js
```

You will be prompted to enter a rider's name and location.

  * Type `Anil north` and press Enter.
  * Type `Sunil south` and press Enter.

You will see the messages appear in your consumer's terminal.

-----

## How It Works: Background Explanation

### 🗺️ Custom Partitioning (North vs. South)

You asked how the producer sends "north" and "south" to different partitions. This is done with **explicit partitioning** in `producer.js`:

```javascript
const partition = location.toLowerCase() === "north" ? 0 : 1;

await producer.send({
    topic: "rider-updates",
    messages: [
        {
            partition: partition, // <-- Right here!
            key: "location-update",
            value: JSON.stringify({ name: riderName, loc: location }),
        },
    ],
});
```

1.  **Logic:** The code checks if the location is "north".
      * If `true`, it sets the `partition` variable to `0`.
      * If `false` (e.g., "south"), it sets the `partition` variable to `1`.
2.  **`producer.send()`:** When calling `producer.send()`, we explicitly pass the `partition` number in the message object.
3.  **Result:** Kafka skips its default partitioning logic (which would normally hash the message key) and sends the message directly to the partition number you specified.

This guarantees that **all "north" messages land in Partition 0** and **all "south" (or other) messages land in Partition 1**.

### 👥 How Consumer Groups Work

This is the most important concept for scaling consumption in Kafka. A **consumer group** is identified by its `groupId`.

**The Golden Rule:** Within a single consumer group, **each partition can only be read by one consumer**.

Let's explore the scenarios based on your code.

#### Scenario 1: One Group, One Consumer

  * **How to run:**
    ```sh
    # Terminal 1:
    node consumer.js group-A
    ```
  * **What happens:**
    The single consumer in `group-A` subscribes to the `rider-updates` topic. Kafka assigns it **all available partitions** (Partition 0 and Partition 1).
  * **Result:** This consumer receives **all messages**, from both "north" and "south".

#### Scenario 2: One Group, Two Consumers (Scaling Out)

  * **How to run:**
    ```sh
    # Terminal 1:
    node consumer.js group-A

    # Terminal 2:
    node consumer.js group-A
    ```
  * **What happens:**
    When the second consumer joins the *same group* (`group-A`), Kafka triggers a **rebalance**. It re-distributes the partitions among the available consumers in that group.
  * **Result:**
      * Consumer 1 might be assigned **Partition 0** (all "north" messages).
      * Consumer 2 might be assigned **Partition 1** (all "south" messages).
      * The load is now **split** between the two consumers. This is how you achieve parallel processing. If you add a third consumer to this group, it will sit idle, as there are only two partitions.

#### Scenario 3: Two Groups, One Consumer Each (Broadcast)

  * **How to run:**
    ```sh
    # Terminal 1:
    node consumer.js group-A

    # Terminal 2:
    node consumer.js group-B
    ```
  * **What happens:**
    `group-A` and `group-B` are **completely independent**. Each group tracks its own offsets (its "bookmark" in the topic).
  * **Result:**
      * The consumer in `group-A` is assigned both partitions and gets a **full copy of all messages**.
      * The consumer in `group-B` is *also* assigned both partitions and gets its own **full copy of all messages**.
      * This is the **publish/subscribe (pub/sub)** or "broadcast" model. You can have one service (e.g., `group-A`) processing locations for analytics, and a completely separate service (e.g., `group-B`) processing them for notifications, both reading from the same topic independently.

<!-- end list -->
