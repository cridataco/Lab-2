const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const axios = require("axios");

const app = express();
const port = process.env.MONITORPORT || 3000;

const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.static('public')); 

let servers = [];
let logs = [];

const serverRegistryURL = "http://localhost:5000";

async function fetchServers() {
  try {
    const response = await axios.get(`${serverRegistryURL}/servers`);
    servers = response.data;
    io.emit("updateServers", servers); 
  } catch (error) {
    console.error("Error fetching servers:", error);
  }
}

async function fetchLogs() {
  try {
    const response = await axios.get(`${serverRegistryURL}/logs`);
    logs = response.data;
    io.emit("updateLogs", logs); 
  } catch (error) {
    console.error("Error fetching logs:", error);
  }
}

io.on("connection", (socket) => {
  console.log("Monitor conectado");

  socket.emit("updateServers", servers);
  socket.emit("updateLogs", logs);

  socket.on("disconnect", () => {
    console.log("Monitor desconectado");
  });
});

setInterval(() => {
  fetchServers();
  fetchLogs();
}, 5000);

server.listen(port, () => {
  console.log(`Monitor ejecutándose en el puerto ${port}`);
});
