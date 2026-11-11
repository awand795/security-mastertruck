FROM node:20-slim

WORKDIR /app

# Copy only Linux x64 C++ Native ONNX Runtime + JPEG decoder from local node_modules (zero network install)
COPY node_modules ./node_modules

# Copy ANPR server + models
COPY server ./server

# Copy pre-built frontend assets
COPY dist ./dist

ENV PORT=80
EXPOSE 80

CMD ["node", "server/anpr-server.mjs"]
