const express = require('express');
const cors = require('cors');

const app = express();
const port = 5000;

let servers = [];

app.use(express.json());
app.use(cors());

app.post('/register', (req, res) => {
  const { server } = req.body;
  if (!servers.includes(server)) {
    servers.push(server);
    console.log(`Servidor registrado: ${server}`);
    res.sendStatus(200);
  } else {
    console.log(`El servidor ya está registrado: ${server}`);
    res.sendStatus(200);
  }
});

app.get('/servers', (req, res) => {
  res.json(servers);
});

app.listen(port, () => {
  console.log(`Server Registry ejecutándose en el puerto ${port}`);
});
