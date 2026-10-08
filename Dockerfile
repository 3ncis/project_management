FROM node:22-bookworm-slim

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy your source code
COPY . .

# Force the server to listen on all IP addresses so Docker can route traffic
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

# Run exactly like you do on your local machine
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]