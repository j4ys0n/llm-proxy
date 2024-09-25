import dotenv from 'dotenv'
import express from 'express'
import bodyParser from 'body-parser'
import { NginxController } from './controllers/nginx'
import { LLMController } from './controllers/llm'
import { tokenMiddleware } from './utils/auth'
import { AuthController } from './controllers/auth'
import { log } from './utils/general'

dotenv.config()

const app = express()
const port = process.env.PORT || 8080
const targetUrls = (process.env.TARGET_URLS || 'http://example.com').split(',').map((url) => url.trim())

app.use(express.json())

const payloadLimit = process.env.PAYLOAD_LIMIT || '1mb'
//support application/json type post data (default limit is 100kb)
app.use(bodyParser.json({ limit: payloadLimit }))
//support application/x-www-form-urlencoded post data (default limit is 100kb)
app.use(bodyParser.urlencoded({ limit: payloadLimit, extended: false }))
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

