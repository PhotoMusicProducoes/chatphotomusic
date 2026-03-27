# 1. Imagem oficial do Node.js (leve e estável)
FROM node:18-alpine

# 2. Define o diretório de trabalho dentro do container
WORKDIR /app

# 3. Copia apenas os arquivos de dependências primeiro (para cache)
COPY package*.json ./

# 4. Instala as dependências
RUN npm install --production

# 5. Copia o restante do código do bot
COPY . .

# 6. Expõe a porta usada pelo bot (Fly.io usa 8080 por padrão)
EXPOSE 8080

# 7. Comando para iniciar o bot
CMD ["node", "index.js"]
