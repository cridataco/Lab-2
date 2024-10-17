require("dotenv").config();
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

const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const serversRegisters = [
  {
    ip: process.env.SERVER_1_IP,
    port: process.env.SERVER_1_PORT,
    user: process.env.SERVER_1_USER,
    serverName: process.env.SERVER_1_INSTANS_NAME
  },
];

// Función para seleccionar un servidor aleatorio
function getRandomServer() {
  const randomIndex = Math.floor(Math.random() * serversRegisters.length);
  return serversRegisters[randomIndex];
}

async function installDependencies(ssh) {
  const installDocker = `
    if ! command -v docker &> /dev/null; then
      echo "Docker no está instalado. Instalando Docker..."
      sudo apt-get update
      sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
      sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
      sudo apt-get update
      sudo apt-get install -y docker-ce
    else
      echo "Docker ya está instalado."
    fi
  `;
  const installGit = `
    if ! command -v git &> /dev/null; then
      echo "Git no está instalado. Instalando Git..."
      sudo apt-get update
      sudo apt-get install -y git
    else
      echo "Git ya está instalado."
    fi
  `;

  await ssh.execCommand(installDocker);
  await ssh.execCommand(installGit);
}

app.post('/deploy', async (req, res) => {
  console.log('xd')
  const randomServer = getRandomServer();
  console.log(randomServer);

  try {
    await ssh.connect({
      host: randomServer.ip,
      port: randomServer.port,
      username: randomServer.user,
    });
    console.log(`Conectado al servidor: ${randomServer.ip}`);
    
    await installDependencies(ssh);
    console.log(`1`);
    
    const repoUrl = 'https://github.com/cridataco/Lab-2';
    const dockerCommand = `docker run -it -p ${randomServer.port}:${randomServer.port} --name ${randomServer.serverName} -e PORT=${randomServer.port} instancia1`;
    
    const result = await ssh.execCommand(`git clone ${repoUrl} && ${dockerCommand}`, { cwd: '/home/usuario/' });
    console.log(`2`);

    if (result.stderr) {
      throw new Error(`Error al ejecutar el comando: ${result.stderr}`);
    }

    console.log('Repositorio clonado y Docker levantado:', result.stdout);
    res.json({ success: true, message: 'Instancia desplegada correctamente.' });
  } catch (err) {
    console.error('Error en la conexión o comando:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    ssh.dispose(); // Cerrar la conexión SSH
  }
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

// Función para balancear la carga
const balanceLoad = async (req, res) => {
  if (servers.length === 0) {
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
    if (serverHealth.get(server) === 'UP') {
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

socket.on('updateServers', (updatedServers) => {
  servers = updatedServers.map(s => s.server);
  serverHealth = new Map(updatedServers.map(s => [s.server, s.status]));
  console.log("Servidores actualizados vía WebSockets:", servers, serverHealth);
});

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
