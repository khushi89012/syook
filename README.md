# Encrypted Time Series

Backend application that generates an encrypted data stream (Emitter), receives and decrypts it (Listener), validates integrity, stores in MongoDB (minute-bucketed time series), and streams saved data to a small frontend in real time.

## Architecture

- **Emitter** (Node.js): Generates 49–499 encrypted messages per batch (random), each with `name`, `origin`, `destination` from `data.json` and a SHA-256 `secret_key`. Encrypts with AES-256-CTR, sends a pipe-separated stream over TCP to the Listener every 10s.
- **Listener** (Node.js): TCP server receives the stream, decrypts each message, validates `secret_key`, discards invalid entries, adds a timestamp, and stores valid readings in MongoDB (one document per minute with an array of readings). HTTP server serves the frontend and Socket.IO for real-time push.
- **Frontend**: Single page at `http://localhost:3001` showing live readings and success rate (total received vs valid decoded).

## Prerequisites

- Node.js 18+
- MongoDB (local or Docker)

## Run locally

1. Start MongoDB (e.g. `mongod` or Docker: `docker run -p 27017:27017 mongo:7`).

2. Start the Listener (TCP + HTTP + Socket.IO):
   ```bash
   cd listener && npm install && npm start
   ```
   Listener: TCP `9000`, HTTP + UI `3001`.

3. Start the Emitter (connects to Listener, sends every 10s):
   ```bash
   cd emitter && npm install && npm start
   ```

4. Open **http://localhost:3001** for the frontend (real-time table + success rate).

## Environment variables

| Service   | Variable               | Default                          |
|----------|------------------------|----------------------------------|
| Listener | `MONGO_URI`            | `mongodb://localhost:27017`      |
| Listener | `LISTENER_TCP_PORT`    | `9000`                           |
| Listener | `LISTENER_HTTP_PORT`   | `3001`                           |
| Listener | `ENCRYPTION_PASSPHRASE` | `encrypted-timeseries-secret-key` |
| Emitter  | `LISTENER_HOST`        | `localhost`                      |
| Emitter  | `LISTENER_PORT`        | `9000`                           |
| Emitter  | `ENCRYPTION_PASSPHRASE` | same as Listener                 |

## Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3001  
- MongoDB: localhost:27017  
- Emitter connects to Listener over the Docker network and sends every 10s.

## Tests

```bash
cd emitter && node --test test/
cd listener && node --test test/
```

(Listener tests do not require MongoDB; they only test stream decryption and validation.)

## Data flow

1. Emitter builds N messages (49 ≤ N ≤ 499), each: `{ name, origin, destination, secret_key }` with `secret_key = SHA256(JSON.stringify({ name, origin, destination }))`, then encrypts with AES-256-CTR and joins with `|`.
2. Listener receives the string, splits by `|`, decrypts each token, parses JSON, checks `secret_key`. Invalid or tampered messages are discarded.
3. Valid messages get a `timestamp`, are bucketed by minute, and stored in MongoDB. Each document keyed by minute contains an array of `readings` with `name`, `origin`, `destination`, `timestamp`.
4. Listener pushes new readings and aggregate stats (total received, total valid, success rate) to the frontend via Socket.IO.

## Git

Use frequent, small commits (e.g. one per feature or fix) and clear messages.
