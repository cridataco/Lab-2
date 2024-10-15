#!/bin/bash

# Variables
SERVER="user@remote-server-ip"
APP_PATH="/path/to/remote/directory"
IMAGE_NAME="express-backend"
TIMESTAMP=$(date +%s) # Para generar un nombre único para el contenedor
CONTAINER_NAME="express-backend-instance-$TIMESTAMP"

# Acceder al servidor vía SSH
ssh $SERVER << EOF
  # Cambiar a la carpeta de la aplicación
  cd $APP_PATH

  # Construir la imagen de Docker (sin eliminar contenedores anteriores)
  docker build -t $IMAGE_NAME .

  # Levantar una nueva instancia del contenedor con un nombre único
  docker run -d --name $CONTAINER_NAME -p 3000:3000 $IMAGE_NAME
EOF

echo "Nueva instancia de la aplicación desplegada con el nombre: $CONTAINER_NAME"
