# Use lightweight Node image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy rest of the code
COPY . .

# Expose port
EXPOSE 4000

# Start the service
CMD ["npm", "start"]