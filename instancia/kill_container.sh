#!/bin/bash
CONTAINER_ID=$(basename $(cat /proc/self/cgroup | grep 'docker' | sed 's/^.*\///'))

echo "Eliminando contenedor: $CONTAINER_ID"
docker rm -f $CONTAINER_ID