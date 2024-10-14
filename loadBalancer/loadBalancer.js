const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const port = process.env.MIDDLEWAREPORT || 5001;

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

let servers = [];
let currentIndex = 0;

const fetchServersFromRegistry = async () => {
  try {
    const response = await axios.get('http://localhost:5000/servers'); 
    servers = response.data;
    console.log("Servidores actualizados:", servers);
  } catch (error) {
    console.error("Error al obtener servidores del registry:", error.message);
  }
};

setInterval(fetchServersFromRegistry, 5000);

const balanceLoad = async (req, res) => {
  if (servers.length === 0) {
    return res.status(503).send("No hay servidores disponibles");
  }

  let server = servers[currentIndex];
  currentIndex = (currentIndex + 1) % servers.length;

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
