FROM node:22-slim
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js admin.html ./
COPY public ./public
EXPOSE 3000
CMD ["node", "--no-warnings=ExperimentalWarning", "server.js"]
