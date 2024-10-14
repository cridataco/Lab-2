const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const { io } = require("socket.io-client");  

const app = express();
const port = process.env.MIDDLEWAREPORT || 5001;

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

let servers = [];
let serverHealth = new Map();
let currentIndex = 0;

const socket = io("http://localhost:5000"); 

socket.on('updateServers', (updatedServers) => {
  servers = updatedServers.map(s => s.server);
  serverHealth = new Map(updatedServers.map(s => [s.server, s.status]));
  console.log("Servidores actualizados vía WebSockets:", servers, serverHealth);
});

const balanceLoad = async (req, res) => {
  if (servers.length === 0) {
    return res.status(503).send("No hay servidores disponibles");
  }

  let server = servers[currentIndex];
  currentIndex = (currentIndex + 1) % servers.length;

  if (serverHealth.get(server) !== 'UP') {
    return res.status(503).send(`Servidor ${server} no disponible`);
  }

  try {
    const response = await axios.post(`${server}/add-watermark`, req.body);
    return res.json(response.data); 
  } catch (error) {
    console.error(`Error al enviar solicitud al servidor ${server}:`, error.message);
    return res.status(500).send(`Error en el servidor ${server}`);
  }
};

app.post('/api/add-watermark', balanceLoad);

app.listen(port, () => {
  console.log(`Balanceador de carga ejecutándose en el puerto ${port}`);
});
