# Use an official Node.js runtime as the base image
FROM node:18

# Install Nginx
RUN apt-get update && apt-get install -y nginx certbot python3-certbot-nginx

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . .

RUN yarn && yarn build

# Expose port 80 & 443
EXPOSE 8080 443

# Remove the default Nginx configuration file
RUN rm /etc/nginx/sites-enabled/default

# Copy a custom Nginx configuration file
COPY nginx.conf /etc/nginx/nginx.conf

# Make sure Nginx has the right permissions to run
RUN chown -R www-data:www-data /var/lib/nginx

# Create directory for Let's Encrypt certificates
RUN mkdir -p /etc/letsencrypt

# Start Node.js app
CMD ["node", "dist/index.js"]