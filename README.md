# LLM Proxy

Manages Nginx for reverse proxy to multiple LLMs, with TLS & Bearer Auth tokens. Deployed with docker.

## Features

- **LLM API Aggregation**: Aggregates multiple OpenAI-type LLM APIs into a single endpoint
- **API Key Management**: Web-based UI for creating and managing API keys with user associations
- **Request Analytics**: Track and analyze API usage per key with CSV-based storage
- **TLS/SSL Support**: Automatic Let's Encrypt certificates via certbot with Cloudflare DNS validation
- **Nginx Reverse Proxy**: Production-grade reverse proxy with IP restriction
- **Secure Authentication**: HttpOnly cookie-based JWT authentication for web UI, Bearer tokens for API
- **Input Validation**: Comprehensive request validation using Joi
- **CORS Configuration**: Configurable cross-origin resource sharing with credential support
- **Request Tracking**: Per-API-key request analytics with success/failure tracking

***All requests to `/v1/*` are proxied to the LLM APIs except for `/v1/models`***

`/v1/models` is a special endpoint that returns the aggregated list of models available from all configured LLM APIs.

## Quick Start

### Prerequisites

1. **Cloudflare Account** (free): Create an API Token with "Zone", "DNS", "Edit" permissions
2. **DNS Setup**: Point your domain to your server's IP address
3. **Port Forwarding**: Forward port 443 on your router

### Installation

1. Create required files (see below)
2. Start with docker-compose: `docker-compose up -d`
3. Access web UI at `http://your-server-ip:8080/admin`
4. Configure certificates and nginx (see Routes section)

## Configuration

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.6'

services:
  llmp:
    image: ghcr.io/j4ys0n/llm-proxy:latest
    container_name: llmp
    hostname: llmp
    restart: unless-stopped
    ports:
      - 8080:8080
      - 443:443
    volumes:
      - .env:/app/.env
      - ./data:/app/data
      - ./cloudflare_credentials:/opt/cloudflare/credentials
      - ./nginx:/etc/nginx/conf.d
      - ./certs:/etc/letsencrypt
```

### Environment Variables

Create `.env`:

```bash
# Server Configuration
PORT=8080                                    # Node.js listen port (don't change if using default nginx config)
PAYLOAD_LIMIT=1mb                            # Maximum request payload size

# LLM API Endpoints
TARGET_URLS=http://localhost:1234,http://192.168.1.100:1234|api-key-here
# Format: url1,url2|api-key,url3
# /v1 path is optional and will be added automatically
# API keys are optional, separated by |

# Authentication
JWT_SECRET=randomly_generated_secret_change_this  # REQUIRED: Use a strong, random secret
AUTH_USERNAME=admin                               # Web UI admin username
AUTH_PASSWORD=secure_password_change_this         # Web UI admin password

# CORS (Optional)
CORS_ORIGIN=true                            # Set to specific origin in production (e.g., https://yourdomain.com)

# Environment
NODE_ENV=production                         # Set to 'production' for HTTPS-only cookies
```

### Cloudflare Credentials

Create `cloudflare_credentials`:

```bash
dns_cloudflare_api_token = your_token_here
```

## Security Practices

### Secret Management

**CRITICAL**: The following secrets must be changed from defaults:

- `JWT_SECRET`: Use a cryptographically strong random string (minimum 32 characters)
  - Generate with: `openssl rand -base64 32`
  - Rotate periodically (requires re-authentication of all users)
- `AUTH_PASSWORD`: Use a strong password (minimum 12 characters, mixed case, numbers, symbols)

**Best Practices**:
- Never commit `.env` files to version control
- In production, use a secrets management service (HashiCorp Vault, AWS Secrets Manager, etc.)
- Restrict file permissions: `chmod 600 .env cloudflare_credentials`
- Use different secrets for development and production
- Rotate API keys regularly
- Monitor failed authentication attempts

### Cookie Security

The application uses HttpOnly cookies for web UI authentication:
- `httpOnly: true` - Prevents JavaScript access (XSS protection)
- `secure: true` (production) - HTTPS-only transmission
- `sameSite: 'strict'` - CSRF protection
- 24-hour expiration

### API Key Security

- API keys are 64-character hex strings (cryptographically random)
- Stored with username associations for audit trails
- Can be revoked instantly (in-memory validation)
- All API requests tracked per key

### Network Security

- Admin routes (`/auth`, `/nginx`, `/api/keys`, `/api/analytics`) are IP-restricted via nginx
- CIDR group configuration allows granular access control
- CORS configured with credential support
- Input validation on all endpoints

## Web Interface

Access the management UI at:
- `http://your-server-ip:8080/admin` (before TLS setup)
- `https://your.domain.com/admin` (after TLS setup)

### Features

1. **Login**: HttpOnly cookie-based authentication
2. **API Key Management**:
   - Create keys with username association
   - View all keys with creation dates
   - Copy keys to clipboard
   - Delete/revoke keys
3. **Analytics Dashboard**:
   - View request statistics per API key
   - Last week of data displayed by default
   - Custom date range filtering
   - Success/failure indicators
   - Elapsed time per request

## API Endpoints

### Authentication

#### POST `/auth/login`
Cookie-based login for web UI (recommended).

**Request**:
```json
{
  "username": "admin",
  "password": "secure_password"
}
```

**Response**:
```json
{
  "success": true,
  "username": "admin"
}
```

Sets `auth_token` HttpOnly cookie.

#### POST `/auth/logout`
Clears authentication cookie.

**Response**:
```json
{
  "success": true
}
```

#### POST `/auth/token` (Legacy)
Returns JWT token in JSON (for API clients).

**Request**:
```json
{
  "username": "admin",
  "password": "secure_password"
}
```

**Response**:
```json
{
  "token": "jwt_token_here"
}
```

### API Key Management

*All endpoints require authentication (cookie or Bearer token).*

#### GET `/api/keys`
List all API keys.

**Response**:
```json
{
  "success": true,
  "keys": [
    {
      "id": "unique_id",
      "key": "64_char_hex_string",
      "username": "user1",
      "createdAt": "2025-12-17T00:00:00.000Z"
    }
  ]
}
```

#### POST `/api/keys`
Create a new API key.

**Request**:
```json
{
  "username": "user1"
}
```

**Validation**:
- Username: 3-50 characters, alphanumeric only

**Response**:
```json
{
  "success": true,
  "key": {
    "id": "unique_id",
    "key": "64_char_hex_string",
    "username": "user1",
    "createdAt": "2025-12-17T00:00:00.000Z"
  }
}
```

#### DELETE `/api/keys/:id`
Delete an API key (instant revocation).

**Response**:
```json
{
  "success": true,
  "message": "API key deleted successfully"
}
```

### Analytics

#### GET `/api/analytics/:keyId?startDate=X&endDate=Y`
Get request analytics for an API key.

**Parameters**:
- `keyId`: API key (64-char hex string)
- `startDate`: (Optional) Start timestamp in epoch milliseconds
- `endDate`: (Optional) End timestamp in epoch milliseconds

**Response**:
```json
{
  "success": true,
  "records": [
    {
      "startTime": 1734400000000,
      "endTime": 1734400001234
    },
    {
      "startTime": 1734400002000,
      "endTime": null
    }
  ]
}
```

**Notes**:
- Without date range, returns last 7 days
- `endTime: null` indicates failed request
- Timestamps in epoch milliseconds

### Nginx Management

*All endpoints require authentication via Bearer token.*

#### POST `/nginx/certificates/obtain`
Obtain Let's Encrypt certificates.

**Request**:
```json
{
  "domains": ["your.domain.com"]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Certificates obtained successfully."
}
```

#### GET `/nginx/certificates/renew`
Renew all certificates.

#### POST `/nginx/config/write-default`
Write default nginx config with IP restrictions.

**Request**:
```json
{
  "domain": "your.domain.com",
  "cidrGroups": ["192.168.1.0/24"]
}
```

**CIDR Examples**:
- `192.168.1.0/24` - Allows 192.168.1.1 through 192.168.1.254
- `192.168.1.111/32` - Only allows 192.168.1.111
- Multiple groups supported for complex networks

**Response**:
```json
{
  "success": true,
  "message": "Default config written successfully"
}
```

#### GET `/nginx/reload`
Reload nginx configuration.

#### GET `/nginx/config/get`
Get current nginx config as string.

#### POST `/nginx/config/update`
Update nginx config with custom configuration.

**Request**:
```json
{
  "config": "nginx_config_string_here"
}
```

#### GET `/nginx/config/get-default`
Get default nginx config template.

### LLM Proxy Endpoints

#### GET `/v1/models`
Aggregated model list from all configured LLM APIs.

*Requires API key in Authorization header.*

**Headers**:
```
Authorization: Bearer your_api_key_here
```

**Response**:
```json
{
  "object": "list",
  "data": [
    {
      "id": "model-name",
      "object": "model",
      "created": 1234567890,
      "owned_by": "organization"
    }
  ]
}
```

#### POST `/v1/*`
All other `/v1/*` requests are proxied to configured LLM APIs.

*Requires API key in Authorization header.*

**Request Routing**:
1. Extracts model from request body
2. Hashes model ID to select upstream API
3. Forwards request with streaming support
4. Tracks start/end time and success/failure

## Setup Flow

1. Start container with `docker-compose up -d`
2. Access web UI: `http://your-server-ip:8080/admin`
3. Login with `AUTH_USERNAME` and `AUTH_PASSWORD`
4. Use API to obtain certificates:
   ```bash
   curl -X POST http://192.168.1.100:8080/nginx/certificates/obtain \
     -H "Authorization: Bearer $(curl -X POST http://192.168.1.100:8080/auth/token \
       -H "Content-Type: application/json" \
       -d '{"username":"admin","password":"secure_password"}' | jq -r '.token')" \
     -H "Content-Type: application/json" \
     -d '{"domains":["your.domain.com"]}'
   ```
5. Write default config:
   ```bash
   curl -X POST http://192.168.1.100:8080/nginx/config/write-default \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"domain":"your.domain.com","cidrGroups":["192.168.1.0/24"]}'
   ```
6. Reload nginx:
   ```bash
   curl http://192.168.1.100:8080/nginx/reload \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
7. Access at `https://your.domain.com/admin`

## Development

### Prerequisites
- Node.js 18+
- Yarn

### Commands

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# Development mode (auto-reload)
yarn dev

# Build
yarn build

# Start production build
yarn start
```

### Testing

Tests use Jest with ts-jest:
- Unit tests for utilities (`src/utils/__tests__`)
- Controller tests (`src/controllers/__tests__`)
- Run with `yarn test`

### Project Structure

```
llm-proxy/
├── src/
│   ├── controllers/      # Route controllers
│   │   ├── analytics.ts  # Analytics endpoints
│   │   ├── apikeys.ts    # API key management
│   │   ├── auth.ts       # Authentication
│   │   ├── llm.ts        # LLM proxy logic
│   │   └── nginx.ts      # Nginx management
│   ├── utils/           # Utilities
│   │   ├── apikeys.ts   # API key manager
│   │   ├── auth.ts      # Auth middleware
│   │   ├── general.ts   # Logging
│   │   ├── nginx.ts     # Nginx manager
│   │   ├── requestTracker.ts  # Analytics tracker
│   │   └── validation.ts      # Input validation
│   ├── static/          # Static assets
│   └── index.ts         # App entry point
├── frontend/            # Vue 3 UI
│   └── src/
│       └── App.vue      # Main component
└── Dockerfile           # Multi-stage build

## Troubleshooting

### Authentication Issues
- Ensure `JWT_SECRET` is set and consistent
- Check cookie settings (secure flag requires HTTPS)
- Verify CORS origin matches your domain

### Certificate Issues
- Verify Cloudflare API token has DNS edit permissions
- Check domain DNS points to correct IP
- Ensure port 443 is forwarded

### API Key Issues
- Keys are validated in-memory (restart clears validation cache)
- Deleted keys are immediately invalid
- Check Authorization header format: `Bearer <key>`

### Analytics Not Recording
- Verify API key is valid
- Check file permissions on data directory
- Review logs for tracking errors

## License

Apache-2.0

## Version

Current version: 1.6.1

### Changelog

**v1.6.1**:
- Security improvements: HttpOnly cookie auth, input validation
- Fixed clipboard implementation
- Added CORS configuration
- Comprehensive test coverage
- Documentation updates

**v1.6.0**:
- API key management with Vue 3 frontend
- Request analytics and tracking
- In-memory API key caching
- Per-key request history with CSV storage

**v1.5.x**:
- Initial release with JWT auth
- Nginx management
- LLM API aggregation
