import { Express, Request, Response, RequestHandler } from 'express'
import { ApiKeyManager } from '../utils/apikeys'
import { log } from '../utils/general'

export class ApiKeyController {
  private app: Express
  private apiKeyManager: ApiKeyManager
  private requestHandlers: RequestHandler[]

  constructor({ app, requestHandlers }: { app: Express; requestHandlers: RequestHandler[] }) {
    this.app = app
    this.requestHandlers = requestHandlers
    this.apiKeyManager = new ApiKeyManager()
  }

  public registerRoutes(): void {
    this.app.get('/api/keys', ...this.requestHandlers, this.listKeys.bind(this))
    this.app.post('/api/keys', ...this.requestHandlers, this.createKey.bind(this))
    this.app.delete('/api/keys/:id', ...this.requestHandlers, this.deleteKey.bind(this))
    this.app.get('/api/keys/validate/:key', ...this.requestHandlers, this.validateKey.bind(this))
    log('info', 'ApiKeyController initialized')
  }

  private async listKeys(req: Request, res: Response): Promise<void> {
    try {
      const keys = await this.apiKeyManager.listKeys()
      res.json({ success: true, keys })
    } catch (error) {
      log('error', 'Failed to list API keys', error)
      res.status(500).json({ success: false, message: 'Failed to list API keys' })
    }
  }

  private async createKey(req: Request, res: Response): Promise<void> {
    const { username } = req.body

    if (!username) {
      res.status(400).json({ success: false, message: 'Username is required' })
      return
    }

    try {
      const result = await this.apiKeyManager.createKey(username)
      const status = result.success ? 200 : 400
      res.status(status).json(result)
    } catch (error) {
      log('error', 'Failed to create API key', error)
      res.status(500).json({ success: false, message: 'Failed to create API key' })
    }
  }

  private async deleteKey(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    if (!id) {
      res.status(400).json({ success: false, message: 'Key ID is required' })
      return
    }

    try {
      const result = await this.apiKeyManager.deleteKey(id)
      const status = result.success ? 200 : 404
      res.status(status).json(result)
    } catch (error) {
      log('error', 'Failed to delete API key', error)
      res.status(500).json({ success: false, message: 'Failed to delete API key' })
    }
  }

  private async validateKey(req: Request, res: Response): Promise<void> {
    const { key } = req.params

    if (!key) {
      res.status(400).json({ success: false, message: 'API key is required' })
      return
    }

    try {
      const apiKey = await this.apiKeyManager.validateKey(key)
      if (apiKey) {
        res.json({ success: true, valid: true, username: apiKey.username })
      } else {
        res.json({ success: true, valid: false })
      }
    } catch (error) {
      log('error', 'Failed to validate API key', error)
      res.status(500).json({ success: false, message: 'Failed to validate API key' })
    }
  }
}
