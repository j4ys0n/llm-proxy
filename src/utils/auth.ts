import { NextFunction, Request, Response, RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { log } from './general'
import { ApiKeyManager } from './apikeys'
import { RequestTracker } from './requestTracker'


const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret'
const apiKeyManager = new ApiKeyManager()
const requestTracker = new RequestTracker()


export const tokenMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  // Try to get token from cookie first, then fall back to Authorization header
  let token: string | undefined

  // Check cookie (preferred for web UI)
  if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token
  }
  // Fall back to Authorization header (for API clients)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
        ignoreExpiration: true
      })
      ;(req as any).user = decoded
      next()
    } catch (error) {
      log('error', `Token verification failed: ${(error as any).toString()}`)
      res.status(401).json({ error: 'Invalid token' })
    }
  } else {
    log('warn', 'Authentication required: no token found')
    res.status(401).json({ error: 'Authentication required' })
  }
}

export const apiKeyMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.split(' ')[1]

    try {
      const validKey = await apiKeyManager.validateKey(apiKey)

      if (validKey) {
        ;(req as any).apiKey = validKey

        // Track request start time
        const startTime = Date.now()

        // Track response completion
        const originalEnd = res.end.bind(res)
        let responseSent = false

        res.end = function(...args: any[]): any {
          if (!responseSent) {
            responseSent = true
            const endTime = Date.now()

            // Track successful completion
            requestTracker.trackRequest(apiKey, startTime, endTime).catch(err => {
              log('error', 'Failed to track request', err)
            })
          }
          return originalEnd(...args)
        } as any

        // Track errors
        res.on('error', () => {
          if (!responseSent) {
            responseSent = true
            // Track failed request
            requestTracker.trackRequest(apiKey, startTime, null).catch(err => {
              log('error', 'Failed to track failed request', err)
            })
          }
        })

        next()
      } else {
        log('warn', `Invalid API key attempted: ${apiKey.substring(0, 10)}...`)
        res.status(401).json({ error: 'Invalid API key' })
      }
    } catch (error) {
      log('error', `API key validation error: ${(error as any).toString()}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  } else {
    log('warn', 'API key missing in Authorization header')
    res.status(401).json({ error: 'Missing API key' })
  }
}