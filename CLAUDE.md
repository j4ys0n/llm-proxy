# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview (llm-proxy)

`llm-proxy` is a small Node.js + TypeScript + Express service that:

- Issues JWT bearer tokens for an admin API (`POST /auth/token`).
- Manages Nginx configuration and TLS certificates (Let’s Encrypt via `certbot`, Cloudflare DNS challenge).
- Proxies OpenAI-style API requests under `/v1/*` to one of multiple upstream LLM endpoints.
- Aggregates upstream model lists into a single `GET /v1/models` endpoint.

Primary entrypoint: `src/index.ts`.

## CRITICAL: Engineering Standards & Operational Protocol

**THIS PROJECT REQUIRES TECHNICAL RIGOR. READ THIS SECTION COMPLETELY BEFORE MAKING ANY CODE CHANGES.**

### PRIMARY DIRECTIVE: VERIFICATION OVER ASSUMPTION

**THE MOST IMPORTANT RULE: VERIFY EVERYTHING BY READING THE ACTUAL CODE**

Before using ANY function, type, method, class, or import:

1. **READ THE SOURCE FILE** where it is defined
2. **VERIFY THE EXACT SIGNATURE** (parameters, return types, visibility)
3. **CONFIRM IT EXISTS** (do not assume based on naming conventions)
4. **UNDERSTAND ITS BEHAVIOR** (read the implementation if unclear)

**NEVER GUESS.** The only way to know for certain how something works is to read the code where it's defined.

### Verification Protocol for Code References

```
BEFORE using any import, function, type, or method:

STEP 1: LOCATE THE DEFINITION
- Read the file where it's defined
- If unsure of location, search the repo
- For third-party libraries, read their .d.ts or official docs

STEP 2: VERIFY THE SIGNATURE
- Parameter names, types, and order
- Return type
- Optional vs required
- Exported vs internal

STEP 3: UNDERSTAND THE BEHAVIOR
- Read implementation
- Identify edge cases + error conditions

STEP 4: VERIFY COMPATIBILITY
- Ensure intended usage matches the verified signature

IF ANY STEP FAILS OR IS UNCERTAIN:
- DO NOT PROCEED with assumptions
- Read more code and/or consult official docs
```

### TypeScript Standards (repo applicable)

- `.d.ts` files are the source of truth for third-party library types.
- Direct property access on union types `A | B` is forbidden unless that property exists on **all** union members.
- Prefer type narrowing (`typeof`, `instanceof`, `in`, custom type guards) over type assertions.
- Use `async/await` and handle promise rejections via `try/catch`.

## Repository Layout (verified)

- `src/index.ts` – Express bootstrap and route wiring.
- `src/controllers/auth.ts` – Token issuing endpoint.
- `src/controllers/nginx.ts` – Nginx admin API routes.
- `src/controllers/llm.ts` – `/v1/models` aggregation and request proxying.
- `src/utils/auth.ts` – `tokenMiddleware` (JWT bearer verification).
- `src/utils/nginx.ts` – `NginxManager` (nginx start/reload, config read/write, certbot obtain/renew).
- `src/static/nginx-server-template.conf` – Nginx server block template used by `write-default`.

## Development Commands (verified: `package.json`)

```bash
# Dev server
npm run dev

# Build
npm run build

# Start built output
npm start
```

Notes:
- `build` outputs to `dist/` and copies `src/static/` → `dist/static/`.
- `test` is a placeholder script that exits 1.

## Runtime Behavior (verified)

### Express bootstrap

Defined in `src/index.ts`:

- Loads env from `.env` via `dotenv.config()`.
- Uses `body-parser` JSON + urlencoded parsing with `PAYLOAD_LIMIT` (default: `1mb`).
- Listens on `PORT` (default: `8080`).

### Authentication

- `POST /auth/token` is **not** protected by `tokenMiddleware`.
- All `/nginx/*` and `/v1/*` routes configured in `src/index.ts` are protected by `tokenMiddleware`.

Token issuing behavior (`src/controllers/auth.ts`):
- Validates JSON body `{ username, password }` against `AUTH_USERNAME` / `AUTH_PASSWORD`.
- Signs an HS256 JWT using `JWT_SECRET`.

Token verification behavior (`src/utils/auth.ts`):
- Requires `Authorization: Bearer <token>`.
- Uses `jwt.verify(..., { algorithms: ['HS256'], ignoreExpiration: true })`.
  - Expiration is not enforced by this middleware; treat `JWT_SECRET` rotation as the primary invalidation mechanism.

### LLM proxying + model aggregation

Defined in `src/controllers/llm.ts`:

- `GET /v1/models` returns an aggregated list from upstreams.
- Upstream model lists are refreshed in a loop (every 60 seconds) via `cacheModels()`.
- Proxy forwarding is implemented in `forwardPostRequest()` and only triggers when:
  - `req.method === 'POST'`
  - path starts with `v1` or `/v1`
  - `req.body.model` exists
  - `TARGET_URLS` is non-empty

Upstream selection:
- `TARGET_URLS` is comma-separated.
- Each entry may be `http(s)://host:port[/v1]|api-key`.
- Upstream models are cached by `md5(model.id)`.
- Incoming request chooses upstream by hashing `req.body.model` with `md5` and looking up that hash in `modelCache`.
- If no cached match exists, falls back to the first `TARGET_URLS` entry.

Request forwarding:
- Uses axios with `responseType: 'stream'` and pipes upstream response to the client.
- If upstream entry includes `|api-key`, outgoing request sets `Authorization: Bearer <api-key>` (overriding any incoming Authorization header).

### Nginx management and certificates

Routes are defined in `src/controllers/nginx.ts` and backed by `src/utils/nginx.ts`.

Protected routes:
- `GET /nginx/reload`
- `POST /nginx/config/update` (expects `{ config: string }`)
- `GET /nginx/config/get`
- `GET /nginx/config/get-default`
- `POST /nginx/config/write-default` (expects `{ domain: string, cidrGroups: string[] }`)
- `POST /nginx/certificates/obtain` (expects `{ domains: string[] }`)
- `GET /nginx/certificates/renew`

Template behavior (`src/static/nginx-server-template.conf` + `NginxManager.writeDefaultTemplate()`):
- Replaces `{{domainName}}` with the requested domain.
- Replaces `{{allowedIPs}}` with a list of `allow <cidr>;` entries.
- Adds `deny all;` after the allow list for the `/(auth|nginx)/*` location.

Cert issuance behavior (`NginxManager.obtainCertificates()`):
- Uses `certbot certonly ... --preferred-challenges dns-01`.
- When called with `cloudflare === true` (current controller always passes `true`):
  - Adds `--dns-cloudflare --dns-cloudflare-credentials /opt/cloudflare/credentials`.
- The command currently hardcodes the email as `email@email.com`.

## Environment Variables (verified)

From `src/index.ts`, `src/controllers/auth.ts`, `src/utils/auth.ts`, and `example.env`:

- `PORT` (default `8080`)
- `PAYLOAD_LIMIT` (default `1mb`)
- `TARGET_URLS` (comma-separated upstreams; each may include `|api-key`)
- `JWT_SECRET`
- `AUTH_USERNAME`
- `AUTH_PASSWORD`

## Docker / Deployment (verified)

- `Dockerfile` installs: `nginx`, `certbot`, `python3-certbot-dns-cloudflare`.
- Image exposes ports `8080` (Node) and `443` (Nginx).
- `docker-compose.yml` mounts:
  - `.env` → `/app/.env`
  - `./cloudflare_credentials` → `/opt/cloudflare/credentials`
  - `./nginx` → `/etc/nginx/conf.d`
  - `./certs` → `/etc/letsencrypt`

## Common Gotchas (repo-specific)

- The Node app only forwards **POST** requests and only when `req.body.model` is present; other requests fall through.
- `tokenMiddleware` uses `ignoreExpiration: true`.
- `TARGET_URLS` parsing (`getPath()`) falls back to base `http://localhost` and path `/v1` when URL parsing fails.
- Nginx is started by Node via `exec('nginx')` (`NginxController.start()` → `NginxManager.start()`).
