const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const axios = require("axios");

const app = express();
const port = process.env.MONITORPORT || 8000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

let servers = [];
let serverHealth = new Map();
let serverLogs = new Map();

const socket = require('socket.io-client')('http://localhost:5000');

socket.on('connect', () => {
  console.log('Conectado al Server Registry via WebSocket');
});

socket.on('updateServers', (serverInfo) => {
  servers = serverInfo.map(s => s.server);
  serverInfo.forEach(({ server, status }) => {
    serverHealth.set(server, status);
  });
  emitServerUpdates();
});

socket.on('healthCheck', ({ server, status }) => {
  serverHealth.set(server, status);
  emitServerUpdates();
});

socket.on('logAction', ({ server, log }) => {
  if (serverLogs.has(server)) {
    serverLogs.get(server).push(log);
  } else {
    serverLogs.set(server, [log]);
  }
  emitLogUpdates();
});

function emitServerUpdates() {
  const serverInfo = servers.map(s => ({
    server: s,
    status: serverHealth.get(s),
    timestamp: new Date(),
  }));
  io.emit('updateServers', serverInfo);
}

function emitLogUpdates() {
  const logEntries = Array.from(serverLogs.entries()).flatMap(([server, logs]) => logs.map(log => ({
    server,
    ...log
  })));
  io.emit('logUpdate', logEntries);
}

io.on('connection', (socket) => {
  console.log('Monitor conectado al servidor WebSocket');
  emitServerUpdates();
  emitLogUpdates();

  socket.on('disconnect', () => {
    console.log('Monitor desconectado del servidor WebSocket');
  });

  socket.on('performHealthCheck', async () => {
    for (const server of servers) {
      try { 
        console.log(server);
        const response = await axios.get(`${server}/health`);
        serverHealth.set(server, 'UP');
      } catch (error) {
        serverHealth.set(server, 'DOWN');
      }
    }
    emitServerUpdates();
  });
});

server.listen(port, () => {
  console.log(`Monitor ejecutándose en el puerto ${port}`);
});
