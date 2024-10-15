#!/bin/bash

CONTAINER_NAME=$1
SUDO_PASSWORD=$2

echo "$SUDO_PASSWORD" | sudo -S docker stop "$CONTAINER_NAME" &&
echo "$SUDO_PASSWORD" | sudo -S docker rm "$CONTAINER_NAME"

if [ $? -ne 0 ]; then
  echo "Error al detener o eliminar el contenedor $CONTAINER_NAME"
  exit 1
fi

echo "Contenedor $CONTAINER_NAME detenido y eliminado."