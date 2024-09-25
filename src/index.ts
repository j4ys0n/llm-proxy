import dotenv from 'dotenv'
import express from 'express'
import { NginxController } from './controllers/nginx'
import { LLMController } from './controllers/llm'
import { tokenMiddleware } from './utils/auth'
import { AuthController } from './controllers/auth'
import { log } from './utils/general'
import bodyParser from 'body-parser'

dotenv.config()

const app = express()
const port = process.env.PORT || 8080
const targetUrls = (process.env.TARGET_URLS || 'http://example.com').split(',').map((url) => url.trim())

// app.use(express.json())
const payloadLimit = process.env.PAYLOAD_LIMIT || '1mb'
app.use(bodyParser.json({ limit: payloadLimit }))
app.use(bodyParser.urlencoded({ extended: false, limit: payloadLimit }))
app.use(bodyParser.json())
log('info', `Payload limit is: ${payloadLimit}`)

// Express routes
app.get('/', (req, res) => {
  res.send('LLM Proxy')
})

const authController = new AuthController({ app })
authController.registerRoutes()

const nginxController = new NginxController({ app, requestHandlers: [ tokenMiddleware ] })
nginxController.registerRoutes()
nginxController.start()

const llmController = new LLMController({ app, requestHandlers: [tokenMiddleware ], targetUrls })
llmController.registerRoutes()

// Start the server
app.listen(port, () => {
  console.log(`Local server running at http://localhost:${port}`)
})

