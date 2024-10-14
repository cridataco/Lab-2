document.addEventListener('DOMContentLoaded', function () {
    const submitButton = document.getElementById('submitButton');
    const imageInput = document.getElementById('imageInput');
    const watermarkText = document.getElementById('watermarkText');
    
    submitButton.addEventListener('click', async () => {
        const file = imageInput.files[0];
        const text = watermarkText.value;

        if (!file || !text) {
            alert('Por favor, selecciona una imagen y escribe un texto de marca de agua.');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);
        formData.append('watermark', text);

        try {
            const response = await fetch('http://localhost:5001/api/add-watermark', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Error en la solicitud: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Respuesta del servidor:', result);
            // Aquí puedes mostrar un mensaje de éxito o manejar la respuesta
        } catch (error) {
            console.error('Error al subir la imagen:', error);
            alert('Ocurrió un error al subir la imagen. Inténtalo de nuevo.');
        }
    });
});
