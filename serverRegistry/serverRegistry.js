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

app.use(express.json());
app.use(cors());

app.post('/register', (req, res) => {
  const { server } = req.body;
  if (!servers.includes(server)) {
    servers.push(server);
    serverHealth.set(server, 'UNKNOWN'); 
    console.log(`Servidor registrado: ${server}`);

    io.emit('updateServers', servers);
    res.sendStatus(200);
  } else {
    console.log(`El servidor ya está registrado: ${server}`);
    res.sendStatus(200);
  }
});

app.get('/servers', (req, res) => {
  res.json(servers);
});

const performHealthCheck = async () => {
  for (const server of servers) {
    try {
      await axios.get(`${server}/health`); 
      serverHealth.set(server, 'UP'); 
    } catch (error) {
      console.error(`Error en health check de ${server}:`, error.message);
      serverHealth.set(server, 'DOWN');
    }
  }

  io.emit('updateServers', servers.map(s => ({
    server: s,
    status: serverHealth.get(s),
    timestamp: new Date(),
  })));
};

setInterval(performHealthCheck, 5000);

app.get('/health-status', (req, res) => {
  const serverStatuses = servers.map(server => ({
    server,
    status: serverHealth.get(server) || 'UNKNOWN',
    timestamp: new Date(),
  }));
  res.json(serverStatuses);
});

server.listen(port, () => {
  console.log(`Server Registry ejecutándose en el puerto ${port}`);
});
