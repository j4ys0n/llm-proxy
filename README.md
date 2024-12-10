# LLM Proxy

Manages Nginx for reverse proxy to multiple LLMs, with TLS & Bearer Auth tokens. Deployed with docker.

- Aggregates multiple OpenAI-type LLM APIs
- Supports cloudflare domains
- Uses Let's Encrypt for TLS certificates
- Uses certbot for certificate issuance and renewal
- Uses Nginx as a public-domain reverse proxy to add TLS
- Uses JWT for bearer authentication
- Auth & nginx enpoints are IP restricted.

***All requests to `/v1/*` are proxied to the LLM APIs except for `/v1/models`***

`/v1/models` is a special endpoint that returns the list of models available from all LLM APIs.

## How to use

Docker compose is going to be the easiest way to get up and running, but you could also manually run the docker image. Before you do anything else, if you don't have a cloudflare account, sign up now - it's free. You will need to create an API Token with the "Zone", "DNS", "Edit" permissions. This will be used when issuing your certs to verify that you own the domain you want to use for TLS. After you have your key, set up a new DNS record to point to your IP address. This can be proxied on the cloudflare end.

After this, you'll set up your files, start the container, hit a few routes and you'll be good to go!

#### **Don't forget to forward port 443 on your router!**

I'll use `localhost`, `192.168.1.100` or `your.domain.com` as an examples, but fill these in with your domain or IP address.
You can also add api keys if you need to. like `http://192.168.1.100:1234|api-key-here`.

### Files

Here's what you'll need in your docker-compose file:
```yaml
version: '3.6'

services:
  llmp:
    image: ghcr.io/j4ys0n/llm-proxy:1.5.4
    container_name: llmp
    hostname: llmp
    restart: unless-stopped
    ports:
      - 8080:8080
      - 443:443
    volumes:
      - .env:/app/.env # environment variables
      - ./data:/app/data # any data that the app needs to persist
      - ./cloudflare_credentials:/opt/cloudflare/credentials # cloudflare api token
      - ./nginx:/etc/nginx/conf.d # nginx configs
      - ./certs:/etc/letsencrypt # tsl certificates
```

Here's what your `.env` file should look like:
```bash
PORT=8080 # node.js listen port. right now nginx is hard coded, so don't change this.
TARGET_URLS=http://localhost:1234,http://192.168.1.100:1234|api-key-here # list of api endpoints (/v1 is optional)
JWT_SECRET=randomly_generated_secret # secret for JWT token generation, change this!
AUTH_USERNAME=admin
AUTH_PASSWORD=secure_password # super basic auth credentials for the admin interface
```

Here's what your cloudflare_credendials file should look like
```bash
dns_cloudflare_api_token = your_token_here
```

### Routes

You'll need to use the local, unsecured endpoints to get set up initially. The `/auth/token` endpoint is the only endpoint that does't need an Authorization header and token.

Generate tokens.

`POST http://192.168.1.100:8080/auth/token`
```json
{
    "username": "admin",
    "password": "secure_password"
}
```
response:
```json
{
    "token": "generated_token_here"
}
```

#### All of the routes below need a bearer token in the Authorization header.
`Authorization: Bearer generated_token_here`

Get TLS certificates.

`POST http://192.168.1.100:8080/nginx/certificates/obtain`
```json
{
    "domains": ["your.domain.com"]
}
```
response:
```json
{
    "success": true,
    "message": "Certificates obtained successfully."
}
```

Write default config with your domain. (this should be sufficient for you, fill in your domain and cider groups)

Note: you can add multiple CIDR groups if you have multiple internal IP ranges you want admin functions to be accessible to. This is all of the routes that start with `/auth` or `/nginx`.

Hint: `192.168.1.0/24` will allow all IPs from `192.168.1.1` - `192.168.1.254`. `192.168.1.111/32` will only allow `192.168.1.111`.

`POST http://192.168.1.100:8080/nginx/config/write-default`
```json
{
    "domain": "your.domain.com",
    "cidrGroups": ["192.168.1.0/24"]
}
```
response:
```json
{
    "success": true,
    "message": "Default config written successfully"
}
```

Reload nginx to apply changes.
`GET http://192.168.1.100:8080/nginx/reload`
response:
```json
{
    "success": true,
    "message": "Nginx configuration reloaded successfully."
}
```

***If you made it here, you should be good to go!***

Other available endpoints (these will be documented better in the future)

`GET /nginx/config/get` - get current nginx config as a string.

`POST /nginx/config/update` - update the nginx config with a custom domain.
Body: `{ "config": string }`

`GET /nginx/config/get-default` - get default nginx config template.

`GET /nginx/certificates/renew` - renew certificates for your domains.