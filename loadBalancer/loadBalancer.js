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

const balanceLoad = async (req, res) => {
  if (servers.length === 0) {
    return res.status(503).send("No hay servidores disponibles");
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

        const logEntry = `${server} - - [${new Date().toISOString()}] "POST /add-watermark" ${response.status} Success`;
        socket.emit('logAction', logEntry);

        return res.json(response.data);
      } catch (error) {
        console.error(`Error al enviar solicitud al servidor ${server}:`, error.message);
        
        const logEntry = `${server} - - [${new Date().toISOString()}] "POST /add-watermark" 500 Error`;
        socket.emit('logAction', logEntry);

        serverHealth.set(server, 'DOWN'); 
      }
    }
  }

  return res.status(503).send("No hay servidores disponibles");
};

socket.on('connect', () => {
  console.log('Conectado al Server Registry vía WebSocket');
});

socket.on('disconnect', () => {
  console.log('Desconectado del Server Registry');
});

app.post('/api/add-watermark', upload.single('image'), balanceLoad);

app.listen(port, () => {
  console.log(`Balanceador de carga ejecutándose en el puerto ${port}`);
});
