FROM node:20-slim

WORKDIR /app

# Install C++ Native ONNX Runtime (onnxruntime-node) + JPEG decoder
RUN npm init -y && npm install onnxruntime-node jpeg-js && npm cache clean --force

# Copy pre-built frontend assets and ANPR server + models
COPY dist ./dist
COPY server ./server

ENV PORT=80
EXPOSE 80

CMD ["node", "server/anpr-server.mjs"]
