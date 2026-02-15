# Use official Node.js runtime as base image
FROM node:lts-alpine

# Set working directory inside container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Create a non-root user to run the app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /usr/src/app

# Switch to non-root user
USER nodejs

# Expose the port your app runs on (change if needed)
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]