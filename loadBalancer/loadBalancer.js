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
let serverHealth = new Map(); // Mapa para almacenar el estado de cada servidor

// Función para obtener la lista de servidores desde el Server Registry cada 5 segundos
const fetchServersFromRegistry = async () => {
  try {
    const response = await axios.get('http://localhost:5000/servers'); // Server Registry
    servers = response.data;
    console.log("Servidores actualizados:", servers);
  } catch (error) {
    console.error("Error al obtener servidores del registry:", error.message);
  }
};

setInterval(fetchServersFromRegistry, 5000);

const healthCheckInterval = 5000; 
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
};

setInterval(performHealthCheck, healthCheckInterval);

const balanceLoad = async (req, res) => {
  if (servers.length === 0) {
    return res.status(503).send("No hay servidores disponibles");
  }

  const server = servers[currentIndex];
  currentIndex = (currentIndex + 1) % servers.length;

  try {
    const response = await axios({
      method: req.method,
      url: `${server}${req.url}`,
      data: req.body,
      headers: req.headers,
      timeout: 10000,
    });

    return res.send(response.data);
  } catch (error) {
    console.error(`Error al enviar solicitud al servidor ${server}:`, error.message);
    res.status(500).send("Error en el servidor balanceado");
  }
};

// Crear nuevas instancias (simuladas) y añadirlas al monitoreo
app.post('/create-instance', (req, res) => {
  const instancePort = 5000 + servers.length;  // Asignamos puertos dinámicamente
  const newServer = `http://localhost:${instancePort}`;

  servers.push(newServer);
  serverHealth.set(newServer, 'UNKNOWN'); // Estado inicial desconocido

  // Simular el registro de la instancia con el monitor
  axios.post('http://localhost:6000/register', { server: newServer })
    .then(() => {
      res.status(200).send(`New instance created on port ${instancePort}`);
    })
    .catch((error) => {
      console.error(`Error registering instance with monitor: ${error.message}`);
      res.status(500).send(`Error creating instance: ${error.message}`);
    });
});

// Endpoint para obtener el estado actual de los servidores monitoreados
app.get('/monitor', (req, res) => {
  const serverStatuses = servers.map(server => ({
    server,
    status: serverHealth.get(server) || 'UNKNOWN',
    timestamp: new Date(),
  }));
  res.json(serverStatuses);
});

app.use('/api', balanceLoad);

app.listen(port, () => {
  console.log(`Balanceador de carga ejecutándose en el puerto ${port}`);
});
