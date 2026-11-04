# Node.js Express Backend Production Dockerfile
FROM node:18-alpine

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy package manifests
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy server application source
COPY . .

# Create uploads and logs directories
RUN mkdir -p uploads logs && chown -R node:node /app

# Use non-root node user for security
USER node

EXPOSE 5000

CMD ["node", "server.js"]
