const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Server } = require("socket.io");
const http = require("http");
const fs = require('fs');
const path = require('path');

const app = express();
const port = 5000;

const server = http.createServer(app);
const io = new Server(server);
const logFilePath = path.join(__dirname, 'server_logs.txt');

let servers = [];
let serverHealth = new Map();

app.use(express.json());
app.use(cors());

function writeLog(logEntry) {
  fs.appendFile(logFilePath, logEntry + '\n', (err) => {
    if (err) {
      console.error('Error al escribir el log:', err);
    }
  });
}

app.post('/register', async (req, res) => {
  const { server } = req.body;
  if (!servers.includes(server)) {
    servers.push(server);
    serverHealth.set(server, 'UNKNOWN');
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

app.get('/servers', (req, res) => {
  res.json(servers);
});

app.get('/logs', (req, res) => {
  fs.readFile(logFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Error al leer los logs');
    }
    res.send(data);
  });
});

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

      const logEntry = `${server} - - [${new Date().toISOString()}] "GET /health" ${response.status} ${response.statusText}`;
      writeLog(logEntry);

      io.emit('updateServers', servers.map(s => ({
        server: s,
        status: serverHealth.get(s),
        timestamp: new Date(),
      })));
    } catch (error) {
      serverHealth.set(server, 'DOWN');

      const logEntry = `${server} - - [${new Date().toISOString()}] "GET /health" 500 Error`;
      writeLog(logEntry);

      io.emit('updateServers', servers.map(s => ({
        server: s,
        status: serverHealth.get(s),
        timestamp: new Date(),
      })));
    }
  });
});

server.listen(port, () => {
  console.log(`Server Registry ejecutándose en el puerto ${port}`);
});
