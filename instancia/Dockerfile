FROM node:18

WORKDIR /app

COPY package*.json ./

COPY .env ./

COPY kill_container.sh /app/

RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "/app/instancia.js"]
