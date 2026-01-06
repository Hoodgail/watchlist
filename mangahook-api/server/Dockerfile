FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Set environment variables
ENV PORT=3202
ENV NODE_ENV=production

# Expose port
EXPOSE 3202

# Start the server
CMD ["node", "app.js"]
