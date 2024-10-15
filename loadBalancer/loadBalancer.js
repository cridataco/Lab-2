const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const { io } = require("socket.io-client");
const multer = require("multer");
const FormData = require('form-data');

const app = express();
const port = process.env.MIDDLEWAREPORT || 5001;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

let servers = [];
let serverHealth = new Map();
let currentIndex = 0;

const socket = io("http://localhost:5000", {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on('updateServers', (updatedServers) => {
  servers = updatedServers.map(s => s.server);
  serverHealth = new Map(updatedServers.map(s => [s.server, s.status]));
  console.log("Servidores actualizados vía WebSockets:", servers, serverHealth);
});

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
  socket.emit('logAction', logObject);
};

const balanceLoad = async (req, res) => {
  if (servers.length == 0) {
    const status = 503;
    res.status(status).send("No hay servidores disponibles");
    logAction(req, res, "N/A", status);
    return;
  }

  let attempts = 0;
  while (attempts < servers.length) {
    let server = servers[currentIndex];
    currentIndex = (currentIndex + 1) % servers.length;
    attempts++;
    if (serverHealth.get(server) == 'UP') {
      try {
        const formData = new FormData();
        formData.append('image', req.file.buffer, req.file.originalname);
        formData.append('watermarkText', req.body.watermarkText);

        const response = await axios.post(`${server}/add-watermark`, formData, {
          headers: {
            ...formData.getHeaders(),
          },
        });

        logAction(req, res, server, response.status);
        return res.json(response.data);
      } catch (error) {
        console.error(`Error al enviar solicitud al servidor ${server}:`, error.message);
        
        logAction(req, res, server, 500);
        serverHealth.set(server, 'DOWN'); 
      }
    }
  }

  const status = 503;
  res.status(status).send("No hay servidores disponibles");
  logAction(req, res, "N/A", status);
};

socket.on('connect', () => {
  console.log('Conectado al Server Registry vía WebSocket');
});

socket.on('disconnect', () => {
  console.log('Desconectado del Server Registry');
});

const tumbarContenedor = async (server) => {
  try {
    console.log(`Intentando tumbar el contenedor en ${server}`);
    const response = await axios.get(`${server}/shutdown`);
    console.log(`Contenedor en ${server} apagado correctamente:`, response.data);
  } catch (error) {
    console.error(`Error al intentar tumbar el contenedor en ${server}:`, error.message);
  }
};

app.post('/api/add-watermark', upload.single('image'), balanceLoad);

app.post('/api/chaos', async (req, res) => {
  if (servers.length === 0) {
    return res.status(503).send("No hay servidores disponibles para caer.");
  }

  // Seleccionar una instancia al azar
  const randomIndex = Math.floor(Math.random() * servers.length);
  const randomServer = servers[randomIndex];

  // Tumbar esa instancia
  await tumbarContenedor(randomServer);

  res.json({ message: `Instancia en ${randomServer} fue tumbada.` });
});

app.post('/api/kill-container', upload.single('image'), balanceLoad);

app.listen(port, () => {
  console.log(`Balanceador de carga ejecutándose en el puerto ${port}`);
});
