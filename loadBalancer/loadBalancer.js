require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const { io } = require("socket.io-client");
const multer = require("multer");
const FormData = require('form-data');
const { Client } = require('ssh2');

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
const usedPorts = new Set();

const socket = io("http://localhost:5000", {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const serversRegisters = [
  {
    ip: process.env.SERVER_1_IP,
    user: process.env.SERVER_1_USER,
    password: process.env.SERVER_1_PASSWORD,
  },
];

function getRandomServer() {
  const randomIndex = Math.floor(Math.random() * serversRegisters.length);
  return serversRegisters[randomIndex];
} 


// Función para generar un puerto aleatorio no repetido entre 3000 y 5000
function getRandomPort() {
  let port;
  do {
    port = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000; // Genera un puerto entre 3000 y 5000
  } while (usedPorts.has(port)); // Si el puerto ya está en uso, genera otro
  usedPorts.add(port);
  return port;
}

app.post('/deploy', async (req, res) => {
  const randomServer = getRandomServer();
  const randomPort = getRandomPort();
  const dockerCommand = `sudo docker run -d -p ${randomPort}:${randomPort} --name ${randomPort} -e PORT=${randomPort} instancia`;
  const conn = new Client();
  conn.on('ready', () => {
    console.log(`Conectado al servidor SSH. Ejecutando comando Docker: ${dockerCommand}`);
    conn.exec(dockerCommand, { pty: true }, (err, stream) => {
      if (err) {
          console.error(`Error al ejecutar el comando Docker: ${err.message}`);
          return res.status(500).json({ message: 'Error al ejecutar el comando Docker', error: err.message });
      }
      let output = '';
      let errorOutput = '';
      stream.on('data', (data) => {
          output += data.toString();
      });
      stream.stderr.on('data', (data) => {
          errorOutput += data.toString();
      });
      stream.on('close', (code, signal) => {
          conn.end();
  
          if (code === 0) {
              console.log(`Comando Docker ejecutado con éxito: ${output}`);
              res.status(200).json({ message: 'Instancia de Docker desplegada con éxito', output });
          } else {
              console.error(`El comando Docker falló con código: ${code}, señal: ${signal}`);
              res.status(500).json({ message: 'Error al desplegar la instancia de Docker', error: errorOutput });
          }
      });
  });
  }).on('error', (err) => {
    console.error(`Error de conexión SSH: ${err.message}`);
    res.status(500).json({ message: 'Error de conexión SSH', error: err.message });
  }).connect({
    host: randomServer.ip,
    port: 22,
    username: randomServer.user,
    password: randomServer.password
  });
});


app.post('/kill', async (req, res) => {
  const randomServer = getRandomServer();
  const randomInstacia = getRandomInstancia();
  // const randomPort = getRandomPort();
  // const dockerCommand = `docker rm -f CONTAINER_NAME`;
  // const conn = new Client();
  // conn.on('ready', () => {
  //   console.log(`Conectado al servidor SSH. Ejecutando comando Docker: ${dockerCommand}`);
  //   conn.exec(dockerCommand, { pty: true }, (err, stream) => {
  //     if (err) {
  //         console.error(`Error al ejecutar el comando Docker: ${err.message}`);
  //         return res.status(500).json({ message: 'Error al ejecutar el comando Docker', error: err.message });
  //     }
  //     let output = '';
  //     let errorOutput = '';
  //     stream.on('data', (data) => {
  //         output += data.toString();
  //     });
  //     stream.stderr.on('data', (data) => {
  //         errorOutput += data.toString();
  //     });
  //     stream.on('close', (code, signal) => {
  //         conn.end();
  
  //         if (code === 0) {
  //             console.log(`Comando Docker ejecutado con éxito: ${output}`);
  //             res.status(200).json({ message: 'Instancia de Docker desplegada con éxito', output });
  //         } else {
  //             console.error(`El comando Docker falló con código: ${code}, señal: ${signal}`);
  //             res.status(500).json({ message: 'Error al desplegar la instancia de Docker', error: errorOutput });
  //         }
  //     });
  // });
  // }).on('error', (err) => {
  //   console.error(`Error de conexión SSH: ${err.message}`);
  //   res.status(500).json({ message: 'Error de conexión SSH', error: err.message });
  // }).connect({
  //   host: randomServer.ip,
  //   port: 22,
  //   username: randomServer.user,
  //   password: randomServer.password
  // });
});

function getRandomInstancia() {
  // Filtrar servidores que están "UP"
  const activeServers = Array.from(serverHealth.entries()).filter(([server, status]) => status === 'UP');

  // Verificar si hay servidores activos disponibles
  if (activeServers.length === 0) {
      throw new Error('No hay servidores disponibles que estén "UP".');
  }

  // Seleccionar un índice aleatorio
  const randomIndex = Math.floor(Math.random() * activeServers.length);

  // Retornar el servidor y su estado correspondiente
  return activeServers[randomIndex];
}

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
  console.log(`Intentando tumbar el contenedor en ${server}`);
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
  console.log(`Intentando tumbar el contenedor generic`);
  if (servers.length === 0) {
    return res.status(503).send("No hay servidores disponibles para caer.");
  }

  const randomIndex = Math.floor(Math.random() * servers.length);
  const randomServer = servers[randomIndex];

  await tumbarContenedor(randomServer);

  res.json({ message: `Instancia en ${randomServer} fue tumbada.` });
});

app.post('/api/kill-container', upload.single('image'), balanceLoad);

app.listen(port, () => {
  console.log(serversRegisters);
  console.log(process.env.SERVER_1_IP);
  console.log(`Balanceador de carga ejecutándose en el puerto ${port}`);
});
