# Use an official Node.js runtime as the base image
FROM node:18.20.3-bullseye

# Install Nginx
RUN apt-get update && apt-get install -y nginx certbot python3-certbot-dns-cloudflare

# Create directory for Nginx configuration files
RUN mkdir -p /etc/nginx/conf.d/

# Create directory for Let's Encrypt certificates
RUN mkdir -p /etc/letsencrypt/

# Make sure Nginx has the right permissions to run
RUN chown -R www-data:www-data /var/lib/nginx

# Create app directory
WORKDIR /app

# Bundle app source
COPY . .

# Install backend dependencies
RUN yarn install

# Install frontend dependencies and build frontend
WORKDIR /app/frontend
RUN yarn install && yarn build

# Build backend
WORKDIR /app
RUN yarn build

# Expose port 8080 & 443
EXPOSE 8080 443

# Remove the default Nginx configuration file
RUN rm /etc/nginx/sites-enabled/default

# Copy a custom Nginx configuration file
COPY nginx.conf /etc/nginx/nginx.conf




# Start Node.js app
CMD ["node", "dist/index.js"]