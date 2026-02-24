const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server: SocketIOServer } = require('socket.io');
const { connect: connectDb, close: closeDb } = require('./db');
const { processAndPersist } = require('./stream-handler');

const TCP_PORT = Number(process.env.LISTENER_TCP_PORT) || 9000;
const HTTP_PORT = Number(process.env.LISTENER_HTTP_PORT) || 3001;

let io;
let totalReceived = 0;
let totalValid = 0;

function createHttpServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', tcpPort: TCP_PORT }));
      return;
    }
    if (req.url === '/' || req.url === '/index.html') {
      const file = path.join(__dirname, 'public', 'index.html');
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Error loading page');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return server;
}

function createTcpServer() {
  const server = net.createServer((socket) => {
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      buffer += chunk;
      const idx = buffer.indexOf('\n');
      if (idx !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line) {
          handleStream(line).catch((err) => {
            console.error('[Listener] Stream handling error:', err.message);
          });
        }
      }
    });
    socket.on('error', (err) => {
      console.error('[Listener] Socket error:', err.message);
    });
  });
  return server;
}

async function handleStream(stream) {
  try {
    const { total, validCount, saved } = await processAndPersist(stream, io);
    totalReceived += total;
    totalValid += validCount;
    const successRate = totalReceived > 0 ? ((totalValid / totalReceived) * 100).toFixed(2) : '0.00';
    console.log(`[Listener] Processed ${total} messages, ${validCount} valid, ${saved} saved. Success rate: ${successRate}%`);
    if (io) {
      io.emit('stats', {
        totalReceived,
        totalValid,
        successRate: parseFloat(successRate),
      });
    }
  } catch (err) {
    console.error('[Listener] handleStream error:', err.message);
    throw err;
  }
}

const RETRY_MS = 3000;

async function connectDbWithRetry() {
  for (;;) {
    try {
      await connectDb();
      console.log('[Listener] MongoDB connected');
      return;
    } catch (err) {
      console.error('[Listener] MongoDB connection failed (is MongoDB running?). Retrying in', RETRY_MS / 1000, 's...', err.message);
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }
}

async function main() {
  const httpServer = createHttpServer();
  io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });
  io.on('connection', (socket) => {
    socket.emit('stats', {
      totalReceived,
      totalValid,
      successRate: totalReceived > 0 ? parseFloat(((totalValid / totalReceived) * 100).toFixed(2)) : 0,
    });
  });

  const tcpServer = createTcpServer();

  httpServer.listen(HTTP_PORT, () => {
    console.log(`[Listener] HTTP + Socket.IO on port ${HTTP_PORT}`);
  });

  tcpServer.listen(TCP_PORT, () => {
    console.log(`[Listener] TCP server on port ${TCP_PORT}`);
  });

  // Connect to MongoDB in background; retry until success so startup is not blocked
  connectDbWithRetry().catch((err) => {
    console.error('[Listener] MongoDB connect loop error:', err);
  });

  const shutdown = () => {
    tcpServer.close();
    httpServer.close();
    closeDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start listener:', err);
  process.exit(1);
});
