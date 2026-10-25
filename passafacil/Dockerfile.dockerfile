# language: Dockerfile, file: Dockerfile
FROM node:20-alpine

WORKDIR /app

# Instala dependências necessárias para compilar o better-sqlite3 no Alpine
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --production

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]