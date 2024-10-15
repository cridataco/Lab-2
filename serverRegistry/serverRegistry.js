const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const port = 5000;

const server = http.createServer(app);
const io = new Server(server);

let servers = [];
let serverHealth = new Map();
let serverLogs = new Map();

app.use(express.json());
app.use(cors());

// Registrar servidor
app.post('/register', async (req, res) => {
  const { server } = req.body;
  if (!servers.includes(server)) {
    servers.push(server);
    serverHealth.set(server, 'UNKNOWN');
    serverLogs.set(server, []);
    console.log(`Servidor registrado: ${server}`);

    io.emit('updateServers', servers.map(s => ({
      server: s,
      status: serverHealth.get(s),
      timestamp: new Date(),
    })));

    try {
      const response = await axios.get(`${server}/health`);
      serverHealth.set(server, 'UP');
      console.log(`Servidor ${server} está UP`);
    } catch (error) {
      serverHealth.set(server, 'DOWN');
      console.log(`Servidor ${server} está DOWN`);
    }

    res.sendStatus(200);
  } else {
    console.log(`El servidor ya está registrado: ${server}`);
    res.sendStatus(200);
  }
});

// Obtener servidores
app.get('/servers', (req, res) => {
  const serversData = servers.map(server => ({
    server,
    status: serverHealth.get(server),
    timestamp: new Date(),
  }));
  res.json(serversData);
});

// Obtener logs
app.get('/logs', (req, res) => {
  const logs = [];
  serverLogs.forEach((logEntries, server) => {
    logEntries.forEach(entry => logs.push(entry));
  });
  res.json(logs);
});

// WebSocket
io.on('connection', (socket) => {
  console.log('Cliente conectado a WebSocket');

  socket.emit('updateServers', servers.map(s => ({
    server: s,
    status: serverHealth.get(s),
    timestamp: new Date(),
  })));

  socket.on('disconnect', () => {
    console.log('Cliente desconectado de WebSocket');
  });

  socket.on('healthCheck', async (server) => {
    try {
      const response = await axios.get(`${server}/health`);
      serverHealth.set(server, 'UP');
    } catch (error) {
      serverHealth.set(server, 'DOWN');
    }
    
    io.emit('updateServers', servers.map(s => ({
      server: s,
      status: serverHealth.get(s),
      timestamp: new Date(),
    })));
  });

  socket.on('logAction', (logObject) => {
    const server = logObject.remote_addr;
    const logEntry = `${server} - - [${new Date(logObject.time * 1000).toISOString()}] "${logObject.method} ${logObject.path} ${logObject.version}" ${logObject.response} ${logObject.bytesSent} "-" "${logObject.user_agent}"`;
    
    if (serverLogs.has(server)) {
      serverLogs.get(server).push(logObject);
    } else {
      serverLogs.set(server, [logObject]);
    }

    io.emit('logUpdate', logEntry);
  });
});

server.listen(port, () => {
  console.log(`Server Registry ejecutándose en el puerto ${port}`);
});
