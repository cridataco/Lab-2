FROM node:18

RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    lsb-release \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | apt-key add - \
    && echo "deb [arch=amd64] https://download.docker.com/linux/debian $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y docker-ce-cli

WORKDIR /app

COPY package*.json ./

COPY .env ./

COPY kill_container.sh /app/

RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "/app/instancia.js"]
