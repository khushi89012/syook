const net = require('net');
const path = require('path');
const fs = require('fs');
const { buildEncryptedStream } = require('./message-builder');

const LISTENER_HOST = process.env.LISTENER_HOST || 'localhost';
const LISTENER_PORT = Number(process.env.LISTENER_PORT) || 9000;
const PASSPHRASE = process.env.ENCRYPTION_PASSPHRASE || 'encrypted-timeseries-secret-key';
const INTERVAL_MS = 10 * 1000; // 10 seconds

let data;
try {
  const dataPath = path.join(__dirname, 'data.json');
  const raw = fs.existsSync(dataPath)
    ? fs.readFileSync(dataPath, 'utf8')
    : fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf8');
  data = JSON.parse(raw);
} catch (err) {
  console.error('Failed to load data.json:', err.message);
  process.exit(1);
}

function connectAndSend() {
  const client = net.createConnection(
    { host: LISTENER_HOST, port: LISTENER_PORT },
    () => {
      const stream = buildEncryptedStream(data, PASSPHRASE);
      client.write(stream + '\n', (err) => {
        if (err) {
          console.error('Write error:', err.message);
        } else {
          console.log(`[Emitter] Sent stream (${stream.split('|').length} messages) at ${new Date().toISOString()}`);
        }
        client.end();
      });
    }
  );

  client.on('error', (err) => {
    console.error('[Emitter] Connection error:', err.message);
  });

  client.on('close', (hadError) => {
    if (hadError) {
      console.error('[Emitter] Connection closed with error');
    }
  });
}

console.log(`[Emitter] Connecting to ${LISTENER_HOST}:${LISTENER_PORT}, sending every ${INTERVAL_MS / 1000}s`);
connectAndSend();
setInterval(connectAndSend, INTERVAL_MS);
