import { NextFunction, Request, Response, RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { log } from './general'


const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret'


export const tokenMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
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
    log('warn', 'Authorization header missing or invalid')
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }
}