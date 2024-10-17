require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const { io } = require("socket.io-client");
const multer = require("multer");
const FormData = require('form-data');
const { Client } = require('ssh2');
const os = require('os');

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

function getRandomPort() {
    let port;
    do {
        port = Math.floor(Math.random() (5000 - 3000 + 1)) + 3000;
    } while (usedPorts.has(port));
    usedPorts.add(port);
    return port;
}

function getWifiIP() {
    const networkInterfaces = os.networkInterfaces();
    let wifiInterfaceNames = ['Wi-Fi', 'WLAN', 'wlan0', 'en0'];
    let wifiIP = null;

    for (let iface of wifiInterfaceNames) {
        if (networkInterfaces[iface]) {
            networkInterfaces[iface].forEach((ifaceDetails) => {
                if (ifaceDetails.family === 'IPv4' && !ifaceDetails.internal) {
                    wifiIP = ifaceDetails.address;
                }
            });
        }
    }

    return wifiIP ? wifiIP : 'WiFi interface not found or not connected';
}

app.post('/deploy', async (req, res) => {
    const hostIp = getWifiIP();
    const randomServer = getRandomServer();
    const randomPort = getRandomPort();
    const dockerCommand = `sudo docker run -d -p ${randomPort}:${randomPort} --name ${randomPort} -e PORT=${randomPort} -e HOST_IP=${hostIp} -e LOCAL_IP=${randomServer.ip} imagen`;
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
                    servers.push(`http://${randomServer.ip}:${randomPort}`);
                    serverHealth.set(`http://${randomServer.ip}:${randomPort}`, 'UP');
                    res.status(200).json({ message: 'Comando Docker ejecutado con éxito', output: output });
                } else {
                    console.error(`Error al ejecutar el comando Docker: ${errorOutput}`);
                    res.status(500).json({ message: 'Error al ejecutar el comando Docker', error: errorOutput });
                }
            });
        });
    }).connect({
        host: randomServer.ip,
        port: 22,
        username: randomServer.user,
        password: randomServer.password
    });
});

socket.on("connect", () => {
    console.log("Conectado al servidor de registro.");
});

socket.on("disconnect", () => {
    console.log("Desconectado del servidor de registro.");
});

socket.on("healthCheck", (data) => {
    console.log(`Verificación de salud recibida para el servidor: ${data.server}, estado: ${data.status}`);
    serverHealth.set(data.server, data.status);
});

socket.on("updateServers", (data) => {
    servers = data.map(serverData => serverData.server);
    servers.forEach(server => {
        if (!serverHealth.has(server)) {
            serverHealth.set(server, 'UNKNOWN');
        }
    });
    console.log("Lista de servidores actualizada:", servers);
});

socket.on("logAction", (data) => {
    console.log(`Log recibido para el servidor: ${data.server}`, data.log);
    if (serverLogs.has(data.server)) {
        serverLogs.get(data.server).push(data.log);
    } else {
        serverLogs.set(data.server, [data.log]);
    }
});

const chooseServer = () => {
    const availableServers = servers.filter(server => serverHealth.get(server) === 'UP');
    if (availableServers.length === 0) {
        return null;
    }
    const server = availableServers[currentIndex];
    currentIndex = (currentIndex + 1) % availableServers.length;
    return server;
};

app.use(async (req, res, next) => {
    const server = chooseServer();
    if (!server) {
        return res.status(503).json({ message: 'No hay servidores disponibles' });
    }

    const targetURL = `${server}${req.originalUrl}`;
    const method = req.method.toLowerCase();
    const config = {
        url: targetURL,
        method,
        headers: req.headers,
        responseType: 'stream',
        data: req.body
    };

    try {
        const response = await axios(config);
        res.set(response.headers);
        response.data.pipe(res);
        response.data.on('end', () => {
            logAction(req, res, server, response.status);
        });
    } catch (error) {
        logAction(req, res, server, error.response ? error.response.status : 500);
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : 'Error interno del servidor');
    }
});

app.post("/health-check", (req, res) => {
    const healthData = req.body;
    for (const server in healthData) {
        serverHealth.set(server, healthData[server]);
    }
    res.json({ message: "Health check data received" });
});

app.listen(port, () => {
    console.log(`Middleware server listening on port ${port}`);
});
