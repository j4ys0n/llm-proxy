import { Express, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { log } from '../utils/general'
import { validate, loginSchema } from '../utils/validation'

const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret'
const authUsername = process.env.AUTH_USERNAME || 'admin'
const authPassword = process.env.AUTH_PASSWORD || 'secure_password'

export class AuthController {
  private app: Express

  constructor({ app }: { app: Express }) {
    this.app = app
  }

  public registerRoutes(): void {
    this.app.post('/auth/login', this.login.bind(this))
    this.app.post('/auth/logout', this.logout.bind(this))
    // Legacy endpoint for backwards compatibility
    this.app.post('/auth/token', this.getToken.bind(this))
    log('info', 'AuthController initialized')
  }

  private login(req: Request, res: Response): void {
    const validation = validate<{ username: string; password: string }>(loginSchema, req.body)

    if (validation.error || !validation.value) {
      res.status(400).json({ error: validation.error || 'Validation failed' })
      return
    }

    const { username, password } = validation.value

    if (username === authUsername && password === authPassword) {
      const token = jwt.sign({ username }, jwtSecret, { algorithm: 'HS256' })

      // Set HttpOnly cookie
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      })

      log('info', `User logged in: ${username}`)
      res.json({ success: true, username })
    } else {
      res.status(401).json({ error: 'Invalid credentials' })
    }
  }

  private logout(req: Request, res: Response): void {
    res.clearCookie('auth_token')
    log('info', 'User logged out')
    res.json({ success: true })
  }

  // Legacy endpoint - still returns token in JSON for backwards compatibility
  private getToken(req: Request, res: Response): void {
    const validation = validate<{ username: string; password: string }>(loginSchema, req.body)

    if (validation.error || !validation.value) {
      res.status(400).json({ error: validation.error || 'Validation failed' })
      return
    }

    const { username, password } = validation.value

    if (username === authUsername && password === authPassword) {
      const token = jwt.sign({ username }, jwtSecret, { algorithm: 'HS256' })
      log('info', `token generated for ${username} (legacy endpoint)`)
      res.json({ token })
    } else {
      res.status(401).json({ error: 'Invalid credentials' })
    }
  }
}
