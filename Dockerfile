FROM node:20-alpine

WORKDIR /app

# Install lightweight server-side ONNX runtime + JPEG decoder
RUN npm init -y && npm install onnxruntime-web jpeg-js && npm cache clean --force

# Copy pre-built frontend assets and ANPR server + models
COPY dist ./dist
COPY server ./server

ENV PORT=80
EXPOSE 80

CMD ["node", "server/anpr-server.mjs"]
