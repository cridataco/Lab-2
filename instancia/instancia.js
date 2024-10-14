const express = require('express');
const bodyParser = require('body-parser');
const Jimp = require('jimp');  
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 9200; 

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.get('/health', (req, res) => {
    res.sendStatus(200);
});

app.post('/add-watermark', async (req, res) => {
    try {
        const { image, watermarkText } = req.body;  

        if (!image || !watermarkText) {
            return res.status(400).send('Faltan datos');
        }

        // Convertir la imagen base64 a un buffer
        const buffer = Buffer.from(image.split(',')[1], 'base64');

        // Cargar la imagen y agregar la marca de agua usando Jimp
        const loadedImage = await Jimp.read(buffer);
        const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
        loadedImage.print(font, 10, 10, watermarkText);  // Imprimir la marca de agua en la esquina superior izquierda

        // Convertir la imagen de vuelta a base64
        const watermarkedImage = await loadedImage.getBase64Async(Jimp.MIME_PNG);

        // Enviar la imagen con la marca de agua
        res.json({ watermarkedImage });
    } catch (error) {
        console.error('Error al agregar marca de agua:', error);
        res.status(500).send('Error al procesar la imagen');
    }
});

const registerWithRegistry = async () => {
    const registryUrl = 'http://localhost:5000/register'; 
    const serverUrl = `http://localhost:${port}`;

    try {
        await axios.post(registryUrl, { server: serverUrl });
        console.log(`Instancia registrada en el Server Registry: ${serverUrl}`);
    } catch (error) {
        console.error('Error al registrar la instancia:', error.message);
    }
};

app.listen(port, () => {
    console.log(`Instancia ejecutándose en el puerto ${port}`);
    registerWithRegistry(); 
});
