Caching Strategy Migration
This document outlines the strategic shift from a file-based caching system to an in-memory caching system for the application's data layer.

1. The Previous Approach: File-Based Caching
This strategy relied on the server's local file system to persist cached data.

Approach:

Storage: A single JSON file (e.g., global.cache_fileName) was used as the cache store.

Cache Set (Write): On a cache miss, the application would:

Fetch data from the database (DynamoDB).

Read the entire JSON cache file from the disk.

Parse the JSON string into a JavaScript object.

Add or update the new data (with a TTL) in the object.

Re-serialize the entire object back into a JSON string.

Write the entire string back to the file on disk.

Cache Get (Read): On a cache hit, the application would:

Read the entire JSON cache file from disk.

Parse the JSON string.

Look up the requested key.

If the key exists and its TTL is valid, return the data.

Pros:

Persistence: The cache survived application restarts, re-deployments, or crashes, as it was saved on disk. This reduced "cold starts."

Simplicity: For a single-server, low-traffic environment, this was a straightforward approach without external dependencies.

Cons:

Performance Bottleneck: This approach is extremely I/O-intensive. Disk access is thousands of times slower than RAM access. Every read and write operation (even for a small piece of data) required reading and writing the entire cache file, leading to significant latency.

Scalability Issues: As the cache grew, the JSON file size would increase, making the read/parse/stringify/write cycle progressively slower. This does not scale with data volume or traffic.

Concurrency & Race Conditions: The implementation was not atomic. If two concurrent requests missed the cache at the same time, they would both try to read and write to the file. This could lead to one request's data overwriting the other's, resulting in data loss or file corruption.

No Memory Management: The file could grow indefinitely, limited only by disk space. There was no built-in eviction policy (like "max items" or "max file size") to manage the cache's footprint.

2. The New Approach: In-Memory Caching
This strategy leverages the application's own process memory (RAM) to store cached data.

Approach:

Storage: A global JavaScript object (e.g., store = {}) is held in the Node.js process's memory.

Cache Set (Write): On a cache miss, the application:

Fetches data from the database.

Checks if the new item exceeds memory limits (MAX_CACHE_SIZE, MAX_ITEM_SIZE).

If limits are reached, it runs an eviction policy (FIFO - First-In-First-Out) to remove old items until there is space.

Adds the new data and a TTL directly to the in-memory object. This is an extremely fast O(1) hash map operation.

Updates internal memory usage metrics.

Cache Get (Read): On a cache hit, the application:

Looks up the key in the in-memory object (an O(1) operation).

If the key exists, it checks the TTL.

If valid, the data is returned directly from RAM.

Pros:

Extreme Performance: Accessing data from RAM is exceptionally fast (nanoseconds vs. milliseconds for disk I/O). This drastically reduces latency for cached responses.

Low I/O: The server's disk is no longer a bottleneck for caching. This frees up the event loop and system resources.

Controlled Memory Usage: The cache has explicit limits (MAX_ITEMS, MAX_CACHE_SIZE). This prevents the application from running out of memory and crashing.

Efficient Eviction: The FIFO policy ensures that the cache stays within its defined bounds by automatically removing the oldest (and presumably least-used) data when new data needs to be added.

Atomic (in-process): Within a single-threaded Node.js process, object operations are effectively atomic, which eliminates the file-based race conditions.

Cons:

Volatility: The cache is not persistent. If the application process restarts, crashes, or is redeployed, the entire cache is lost. This will result in a "cold start" where the application must re-fetch all data from the database, potentially causing a temporary spike in database load.

Limited Vertical Scalability: The cache size is limited by the amount of RAM available to a single Node.js process.

Horizontal Scalability (Clustering) Issues: This is the most significant trade-off. If the application is run in a cluster (e.g., multiple pods in Kubernetes, multiple processes via PM2), each process will have its own separate, independent in-memory cache. This leads to:

Cache Inconsistency: A write operation in one process (which updates the DB and its local cache) will not be reflected in the other processes. Other processes will continue to serve stale data from their local caches.

Wasted Resources: The same piece of data may be fetched and stored multiple times, once in each process's memory, leading to redundant database calls and memory usage.

3. Summary of Rationale
The migration from file-based to in-memory caching was driven primarily by the need for performance and scalability. The I/O bottleneck and concurrency risks of the file-based system were a major liability.

The in-memory approach provides a massive performance gain and safe, controlled memory management within a single process.

Future Consideration: This in-memory solution is ideal for single-process deployments. For a clustered, horizontally-scaled environment, the next logical step would be to implement a distributed cache (like Redis or Memcached). A distributed cache provides a shared, external, and persistent (in the case of Redis) memory store that all application processes can access, solving the problem of cache inconsistency.
