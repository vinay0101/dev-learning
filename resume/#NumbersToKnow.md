# System Design Scale Numbers Cheat Sheet

## General Traffic & Concurrency

**Rule of Thumb:** Peak Load $\approx 10 \times$ Average Load.

| App Type | DAU (Daily Active Users) | Peak Active Users (10% Rule) | Typical RPS |
| :--- | :--- | :--- | :--- |
| **Small Startup App** | 50k | 5k | 50–100 RPS |
| **Medium Social / Gaming** | 500k | 50k | 400–800 RPS |
| **Large App** (E-commerce, OTT) | 5M | 500k | 5k–10k RPS |
| **Mega Scale** (Global Social/Msg) | 100M+ | 10M+ | 50k–200k RPS |

## Authentication (Login / Signup)

| App Size | Login RPS |
| :--- | :--- |
| **Small App** | 10–50 RPS |
| **Medium App** | 50–200 RPS |
| **Large App** | 200–2,000 RPS |
| **Extreme Scale** | 5,000+ RPS |

## Reads vs Writes Ratios

| Action | Ratio |
| :--- | :--- |
| **Read-heavy systems** | 90:10 or 99:1 |
| **Social feed** | 1000 reads per 1 write |

## Database & Storage Benchmarks

| Component | Typical Safe Range |
| :--- | :--- |
| **Single SQL Instance** | 2k–5k writes/sec <br> 20k–50k reads/sec |
| **Redis Cache** | 100k–500k ops/sec |
| **Kafka Throughput** | 500k–1M messages/sec per cluster |
| **S3 Read/Write** | Thousands TPS per prefix |

## Latency Benchmarks

| Component | Target Latency |
| :--- | :--- |
| **In-memory cache (Redis)** | 1ms |
| **Network hop** | 0.5–1ms |
| **DB read** | 5–10ms |
| **DB write** | 10–20ms |
| **External API** | 100–300ms |
| **P99 Target (Good UX)** | \< 200–300ms |

## Bandwidth & Storage Estimations

| Item | Size |
| :--- | :--- |
| **Small text JSON request** | 1 KB |
| **Login response (Token + Meta)** | 2–5 KB |
| **Image upload** | 1–5 MB |
| **1M requests/day (Logs)** | \~5 GB |

-----

## Standard Interview Assumptions & Phrasing

If asked to estimate without specific data, use these baselines:

  * **DAU:** 1 Million
  * **Peak Concurrent:** $10\%$ of DAU = 100k
  * **Peak RPS:** $20\text{--}30\%$ of concurrent users $\approx$ 20k–30k RPS (for critical endpoints)

### Verbalizing the Estimate

> "Let’s assume 1M DAU. Peak concurrency is typically 10%, so we have \~100k active users. If the peak login window is 5 minutes, that becomes \~333 RPS. Including retries and background token refreshes, the auth service may receive 500 RPS at peak."

-----

## Domain-Specific Traffic Estimates

### E-commerce (e.g., Amazon, Flipkart)

*Ratio: 95% reads, 5% writes*

| Metric | Small | Medium | Large |
| :--- | :--- | :--- | :--- |
| **DAU** | 100k | 1M | 50M |
| **Peak Concurrent** | 10k | 100k | 5M |
| **Home/Browse** | 200–500 RPS | 2k–5k RPS | 50k–200k RPS |
| **Add to Cart** | 10–50 RPS | 200–500 RPS | 5k RPS |
| **Checkout/Pay** | 5–20 RPS | 100–300 RPS | 2k–5k RPS |
| **Search** | 100–500 RPS | 3k–7k RPS | 50k+ RPS |

### OTT / Video Streaming (e.g., Netflix, Hotstar)

*Note: Peak spikes during live events (e.g., sports) can be 10x normal.*

| Metric | Small | Medium | Large |
| :--- | :--- | :--- | :--- |
| **DAU** | 200k | 5M | 100M |
| **Peak Concurrent** | 20k | 500k | 10M |
| **Video Start** | 200–800 RPS | 5k–10k RPS | 50k–150k RPS |
| **Login/Profile** | 20–50 RPS | 200–300 RPS | 2k–5k RPS |
| **Search** | 50–100 RPS | 500–2k RPS | 20k+ RPS |
| **CDN Traffic** | 10 Gbps | 100 Gbps+ | 1 Tbps+ |

### Payments / UPI / Wallet (e.g., Stripe, PayPal)

*Target: 99.999% reliability, \<100ms latency.*

| Metric | Small | Medium | Large |
| :--- | :--- | :--- | :--- |
| **DAU** | 100k | 5M | 100M |
| **Peak Transactions** | 100–200 RPS | 2k–5k RPS | 10k–50k RPS |
| **Auth/OTP** | 200–400 RPS | 5k–10k RPS | 50k–100k RPS |

### Food Delivery (e.g., UberEats, DoorDash)

*Note: Huge peaks around meal times (12–2 PM & 7–10 PM).*

| Metric | Small | Medium | Large |
| :--- | :--- | :--- | :--- |
| **DAU** | 200k | 3M | 50M |
| **Peak Concurrent** | 20k | 300k | 5M |
| **Search** | 200–800 RPS | 3k–8k RPS | 50k RPS |
| **Place Order** | 20–50 RPS | 300–800 RPS | 5k–10k RPS |
| **Tracking Pings** | 500–2k RPS | 10k–30k RPS | 100k+ RPS |

### Social Networks (e.g., Twitter, Instagram)

*Ratio: Reads : Writes = 1000 : 1*

| Metric | Small | Medium | Large |
| :--- | :--- | :--- | :--- |
| **DAU** | 500k | 50M | 500M+ |
| **Feed Requests** | 500–2k RPS | 20k–100k RPS | 250k–1M RPS |
| **Like/Comment** | 20–100 RPS | 2k–5k RPS | 50k–200k RPS |
| **Notifications** | 200–500 RPS | 10k–50k RPS | 200k+ RPS |
| **Media Upload** | 100–300 RPS | 5k RPS | 50k+ RPS |

-----

## Quick Rules of Thumb

  * **Peak Concurrency Calculation:**
    $$Peak\_Concurrency = DAU \times 10\%$$

  * **Peak RPS Calculation:**
    $$Peak\_RPS = \frac{Peak\_Users}{5\text{ second window}}$$

  * **Read/Write Ratio:**
    $$Reads : Writes \approx 90:10 \text{ (or greater)}$$

  * **Load Factor:**
    $$Peak\_Load \approx 10 \times Average\_Load$$
