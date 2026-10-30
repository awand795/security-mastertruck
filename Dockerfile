# ==========================================
# STAGE 1: Build Frontend Assets
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ==========================================
# STAGE 2: Production Server + C++ ONNX ANPR Engine
# ==========================================
FROM node:20-slim

WORKDIR /app

# Install only lightweight production runtime for C++ ONNX + JPEG decoding
RUN npm init -y && npm install onnxruntime-node jpeg-js && npm cache clean --force

# Copy compiled frontend assets and ANPR server + models
COPY --from=builder /app/dist ./dist
COPY server ./server

ENV PORT=80
EXPOSE 80

CMD ["node", "server/anpr-server.mjs"]
