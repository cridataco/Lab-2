const ip = '172.20.10.4';

document.addEventListener('DOMContentLoaded', function () {
    const submitButton = document.getElementById('submitButton');
    const killContainerButton = document.getElementById('killContainerButton');
    const upContainerButton = document.getElementById('upContainerButton');
    const imageInput = document.getElementById('imageInput');
    const watermarkText = document.getElementById('watermarkText');

    upContainerButton.addEventListener('click', async () => {
      console.log("Levantando contenedor...");
  
      try {
        const response = await fetch(`http://${ip}:5001/deploy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
  
        const result = await response.json();
  
        if (result.success) {
          alert(result.message);
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        console.error('Error al desplegar el contenedor:', error);
        alert('Error al desplegar el contenedor: ' + error.message);
      }
    });

    killContainerButton.addEventListener('click', async () => {
        console.log("Tumbar instancia");
        try {
            const response = await fetch(`http://${ip}:5001/api/chaos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error en la solicitud: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Instancia caída:", data.message);
            alert(`Instancia caída: ${data.message}`);
        } catch (error) {
            console.error("Error al tumbar la instancia:", error);
            alert(`Error al tumbar la instancia: ${error.message}`);
        }
    });
    
    submitButton.addEventListener('click', async () => {
        const file = imageInput.files[0];
        const text = watermarkText.value;

        if (!file || !text) {
            alert('Por favor, selecciona una imagen y escribe un texto de marca de agua.');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);  
        formData.append('watermarkText', text);  
        try {
            
            const response = await fetch(`http://${ip}:5001/api/add-watermark`, {
                method: 'POST',
                body: formData,
            });
            
            if (!response.ok) {
                throw new Error(`Error en la solicitud: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Respuesta del servidor:', result);

            const img = document.createElement('img');
            img.src = `data:image/png;base64,${result.watermarkedImage}`;  
            document.getElementById('serverData').innerHTML = '';
            document.getElementById('serverData').appendChild(img);

        } catch (error) {
            console.error('Error al subir la imagen:', error);
            alert('Ocurrió un error al subir la imagen. Inténtalo de nuevo.');
        }
    });
});
