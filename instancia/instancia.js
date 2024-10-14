const express = require('express');
const bodyParser = require('body-parser');
const sharp = require('sharp');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const port = process.env.PORT || 9200;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.get('/health', (req, res) => {
    res.sendStatus(200);
});

app.post('/add-watermark', upload.single('image'), async (req, res) => {
    try {
        const { buffer } = req.file;
        const { watermarkText } = req.body; 

        if (!buffer || !watermarkText) {
            return res.status(400).send('Faltan datos');
        }

        const image = sharp(buffer);
        const { width, height } = await image.metadata();
        
        const watermarkedImage = await image
            .composite([{
                input: Buffer.from(
                    `<svg width="${width}" height="${height}">
                        <text x="10" y="50" font-size="40" fill="white">${watermarkText}</text>
                    </svg>`
                ),
                gravity: 'southeast'
            }])
            .png()
            .toBuffer();

        const base64Image = watermarkedImage.toString('base64');
        res.json({ watermarkedImage: base64Image });
    } catch (error) {
        console.error('Error al agregar la marca de agua:', error);
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
