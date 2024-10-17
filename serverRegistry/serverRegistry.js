const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const port = 5000;

app.use(cors({
    origin: 'http://localhost:8000',
    methods: ['GET', 'POST'],
    credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:8000',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

let servers = [];
let serverHealth = new Map();
let serverLogs = new Map();

app.use(express.json());

const logAction = (req, res, server, status) => {
    const logEntry = `${req.ip} - - [${new Date().toISOString()}] "${req.method} ${req.originalUrl} ${req.protocol.toUpperCase()}/${req.httpVersion}" ${status} ${res.get('Content-Length') || 0} "-" "${req.get('User-Agent')}"`;
    const logObject = {
        remote_addr: req.ip,
        time: Math.floor(new Date().getTime() / 1000).toString(),
        method: req.method,
        path: req.originalUrl,
        version: `${req.protocol.toUpperCase()}/${req.httpVersion}`,
        response: status.toString(),
        bytesSent: res.get('Content-Length') || 0,
        user_agent: req.get('User-Agent')
    };

    console.log(logEntry);
    console.log(JSON.stringify(logObject));
    io.emit('logAction', { server, log: logObject });

    if (serverLogs.has(server)) {
        serverLogs.get(server).push(logObject);
    } else {
        serverLogs.set(server, [logObject]);
    }
    console.log(`Log almacenado para ${server}:`, logObject);
};

const performHealthCheck = async (server) => {
  if (serverHealth.get(server) === 'RESTART') {
    io.emit('healthCheck', { server, status: 'RESTART' });
    return 'RESTART';
  }
    try {
        const response = await axios.get(`${server}/health`);
        serverHealth.set(server, 'UP');
        io.emit('healthCheck', { server, status: 'UP' });
        return 'UP';
      } catch (error) {
        serverHealth.set(server, 'DOWN');
        io.emit('healthCheck', { server, status: 'DOWN' });
        return 'DOWN';
      }
};

app.post('/register', async (req, res) => {
    const { server } = req.body;
    if (!servers.includes(server)) {
        servers.push(server);
        serverHealth.set(server, 'UNKNOWN');
        serverLogs.set(server, []);
        console.log(`Servidor registrado: ${server}`);
        try {
      const response = await axios.get(`${server}/health`);
      serverHealth.set(server, 'UP');
      console.log(`Servidor ${server} está UP`);
    } catch (error) {
      serverHealth.set(server, 'DOWN');
      console.log(`Servidor ${server} está DOWN`);
    } finally {
      io.emit('updateServers', servers.map(s => ({
        server: s,
        status: serverHealth.get(s),
        timestamp: new Date(),
      })));
    }

        res.sendStatus(200);
    } else {
        console.log(`El servidor ya está registrado: ${server}`);
        res.sendStatus(200);
    }
});

app.get('/servers', (req, res) => {
    const serversData = servers.map(server => ({
        server,
        status: serverHealth.get(server),
        timestamp: new Date(),
    }));
    res.json(serversData);
});

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

setInterval(async () => {
  servers.forEach(async (server) => {
    await performHealthCheck(server)
  });
  const mapObject = Object.fromEntries(serverHealth);

  axios.post('http://localhost:5001/health-check', mapObject)
    .then((response) => {
        console.log(response.data);
    })
    .catch((error) => {
        console.error(error);
  });
  servers.forEach(async (server) => {
   if ((await performHealthCheck(server)) === 'DOWN') {
    serverHealth.set(server, 'RESTART');
   }
  });
}, 10000);



server.listen(port, () => {
    console.log(`Server Registry ejecutándose en el puerto ${port}`);
});
