import { Express, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { log } from '../utils/general'

const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret'
const authUsername = process.env.AUTH_USERNAME || 'admin'
const authPassword = process.env.AUTH_PASSWORD || 'secure_password'

export class AuthController {
  private app: Express

  constructor({ app }: { app: Express }) {
    this.app = app
  }

  public registerRoutes(): void {
    this.app.post('/auth/token', this.getToken.bind(this))
    log('info', 'AuthController initialized')
  }

  private getToken(req: Request, res: Response): void {
    const { username, password } = req.body
    if (username === authUsername && password === authPassword) {
      const token = jwt.sign({ username }, jwtSecret, { algorithm: 'HS256' })
      log('info', `token generated for ${username}`)
      res.json({ token })
    } else {
      res.status(401).json({ error: 'Invalid credentials' })
    }
  }
}
