FROM node:20-slim

WORKDIR /app

# Copy only Linux x64 C++ Native ONNX Runtime + JPEG decoder from local node_modules (zero network install)
COPY node_modules ./node_modules

# Copy pre-built frontend assets and ANPR server + models
COPY dist ./dist
COPY server ./server

ENV PORT=80
EXPOSE 80

CMD ["node", "server/anpr-server.mjs"]
