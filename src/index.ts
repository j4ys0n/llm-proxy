import dotenv from 'dotenv'
import express from 'express'
import path from 'path'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { NginxController } from './controllers/nginx'
import { LLMController } from './controllers/llm'
import { ApiKeyController } from './controllers/apikeys'
import { AnalyticsController } from './controllers/analytics'
import { tokenMiddleware, apiKeyMiddleware } from './utils/auth'
import { AuthController } from './controllers/auth'
import { log } from './utils/general'
import bodyParser from 'body-parser'

dotenv.config()

const app = express()
const port = process.env.PORT || 8080
const targetUrls = (process.env.TARGET_URLS || 'http://example.com').split(',').map((url) => url.trim())

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || true, // In production, set specific origins
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}
app.use(cors(corsOptions))
log('info', `CORS enabled with origin: ${corsOptions.origin}`)

// app.use(express.json())
const payloadLimit = process.env.PAYLOAD_LIMIT || '1mb'
app.use(bodyParser.json({ limit: payloadLimit }))
app.use(bodyParser.urlencoded({ extended: false, limit: payloadLimit }))
app.use(cookieParser())
log('info', `Payload limit is: ${payloadLimit}`)

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'static')))
log('info', 'Static file serving enabled at /static')

// Express routes
app.get('/', (req, res) => {
  res.send('LLM Proxy')
})

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'))
})

app.get('/keys', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'))
})

const authController = new AuthController({ app })
authController.registerRoutes()

const apiKeyController = new ApiKeyController({ app, requestHandlers: [ tokenMiddleware ] })
apiKeyController.registerRoutes()

const analyticsController = new AnalyticsController({ app, requestHandlers: [ tokenMiddleware ] })
analyticsController.registerRoutes()

const nginxController = new NginxController({ app, requestHandlers: [ tokenMiddleware ] })
nginxController.registerRoutes()
nginxController.start()

const llmController = new LLMController({ app, requestHandlers: [apiKeyMiddleware], targetUrls })
llmController.registerRoutes()

// Start the server
app.listen(port, () => {
  console.log(`Local server running at http://localhost:${port}`)
})

