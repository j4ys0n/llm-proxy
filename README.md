# LLM Proxy

Manages Nginx for reverse proxy to multiple LLMs, with TLS & Bearer Auth tokens. Deployed with docker.

- Aggregates multiple OpenAI-type LLM APIs
- Supports cloudflare domains
- Uses Let's Encrypt for TLS certificates
- Uses certbot for certificate issuance and renewal
- Uses Nginx as a public-domain reverse proxy to add TLS
- Uses JWT for bearer authentication