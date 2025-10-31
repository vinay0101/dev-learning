# Caching Strategy Migration

This document outlines the strategic shift from a **file-based caching** system to an **in-memory caching** system for the application's data layer.

---

## 1. The Previous Approach: File-Based Caching

This strategy relied on the server's local file system to persist cached data.

### Approach

- **Storage**: A single JSON file (for example, `global.cache_fileName`) was used as the cache store.

- **Cache Set (Write)**: On a cache miss, the application would:
  1. Fetch data from the database (e.g., **DynamoDB**).
  2. Read the entire JSON cache file from disk.
  3. Parse the JSON string into a JavaScript object.
  4. Add or update the new data along with a **TTL**.
  5. Re-serialize the entire object back into a JSON string.
  6. Write the entire string back to the file on disk.

- **Cache Get (Read)**: On a cache hit, the application would:
  1. Read the entire JSON cache file from disk.
  2. Parse the JSON string.
  3. Look up the requested key.
  4. If the key exists and its **TTL** is valid, return the data.

### Pros

- **Persistence**: Cache survives application restarts, redeployments, or crashes (because it is stored on disk). This reduces "cold starts".
- **Simplicity**: Straightforward to implement for a single-server, low-traffic environment; no external dependencies required.

### Cons

- **Performance Bottleneck**: Extremely I/O-intensive — disk access is orders of magnitude slower than RAM. Every read/write (even for a small item) required full-file operations.
- **Scalability Issues**: As the JSON file grows, read/parse/stringify/write cycles become progressively slower. This approach does **not** scale well with increased data volume or traffic.
- **Concurrency & Race Conditions**: Non-atomic operations introduce risk: concurrent cache-miss handlers can read and write simultaneously, leading to data loss or corruption.
- **No Memory Management**: File size can grow unchecked; there is no built-in eviction policy (e.g., `max items` or `max file size`).

---

## 2. The New Approach: In-Memory Caching

This strategy stores cached data in the application process memory (RAM).

### Approach

- **Storage**: A global JavaScript object, e.g., `store = {}`, held in the Node.js process memory.

- **Cache Set (Write)**: On a cache miss, the application:
  1. Fetches data from the database.
  2. Checks if the new item exceeds memory limits (`MAX_CACHE_SIZE`, `MAX_ITEM_SIZE`).
  3. If limits are reached, runs an eviction policy (e.g., **FIFO** — First-In-First-Out) to remove old items until there is space.
  4. Adds the new data and a **TTL** directly to the in-memory object (O(1) operation).
  5. Updates internal memory usage metrics.

- **Cache Get (Read)**: On a cache hit, the application:
  1. Looks up the key in the in-memory object (O(1)).
  2. If the key exists, checks the **TTL**.
  3. If valid, returns the data directly from RAM.

### Pros

- **Extreme Performance**: RAM access is vastly faster than disk I/O (nanoseconds vs. milliseconds), reducing latency for cached responses.
- **Low I/O**: Eliminates disk as a caching bottleneck; reduces pressure on the event loop and system resources.
- **Controlled Memory Usage**: Explicit limits (`MAX_ITEMS`, `MAX_CACHE_SIZE`) prevent out-of-memory crashes.
- **Efficient Eviction**: A FIFO policy (or other policies) keeps the cache within bounds by evicting older items automatically.
- **Atomic (in-process)**: In a single-threaded Node.js process, in-memory object operations are effectively atomic, avoiding file-based race conditions.

### Cons

- **Volatility**: Cache is not persistent. On process restarts, crashes, or redeploys, the entire cache is lost — causing a "cold start" where data must be re-fetched from the DB.
- **Limited Vertical Scalability**: Cache size is limited to the available RAM of the single Node.js process.
- **Horizontal Scalability (Clustering) Issues**:
  - Each process maintains its own independent cache; caches are not shared across processes or pods.
  - A write in one process (which updates the DB and its local cache) is **not** reflected in other processes, causing **cache inconsistency** and stale reads.
  - Redundant memory usage and repeated DB fetches occur as the same data may be cached separately in each process.

---

## 3. Summary of Rationale

- The migration from **file-based** to **in-memory** caching was driven by the need for improved performance and reduced I/O overhead.
- The file-based approach introduced significant **I/O bottlenecks**, **concurrency risks**, and poor scalability.
- The in-memory approach offers massive performance gains and deterministic memory management within a single process.

**Future Consideration:** For horizontally scaled (clustered) deployments, consider adopting a **distributed cache** (for example, `Redis` or `Memcached`) to:
- Provide shared, **persistent** (optional) cache storage across processes and pods.
- Eliminate cache inconsistency across instances.
- Support larger cache sizes and advanced eviction policies in a single coherent layer.
