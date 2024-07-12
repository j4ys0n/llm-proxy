import { Express, Request, Response, RequestHandler } from 'express'
import { NginxManager } from '../utils/nginx'
import { log } from '../utils/general'

export class NginxController {
  private app: Express
  private nginxManager = new NginxManager()
  private requestHandlers: RequestHandler[]

  constructor({ app, requestHandlers }: { app: Express; requestHandlers: RequestHandler[] }) {
    this.app = app
    this.requestHandlers = requestHandlers
  }

  public registerRoutes(): void {
    this.app.post('/nginx/reload', ...this.requestHandlers, this.reloadNginx.bind(this))
    this.app.post('/nginx/config/update', ...this.requestHandlers, this.updateConfig.bind(this))
    this.app.get('/nginx/config/get', ...this.requestHandlers, this.getConfig.bind(this))
    this.app.get('/nginx/config/get-default', ...this.requestHandlers, this.getDefaultConfig.bind(this))
    this.app.get('/nginx/config/write-default', ...this.requestHandlers, this.writeDefaultConfig.bind(this))
    this.app.get('/nginx/certificates/obtain', ...this.requestHandlers, this.obtainCertificates.bind(this))
    this.app.get('/nginx/certificates/renew', ...this.requestHandlers, this.renewCertificates.bind(this))
    log('info', 'NginxController initialized')
  }

  public async start(): Promise<void> {
    const { success, message } = await this.nginxManager.start()
  }

  private async reloadNginx(req: Request, res: Response): Promise<void> {
    const { success, message } = await this.nginxManager.reload()
    const status = success ? 200 : 500
    res.status(status).json({ success, message })
  }

  private async updateConfig(req: Request, res: Response): Promise<void> {
    const { success, message } = await this.nginxManager.updateConfig(req.body)
    const status = success ? 200 : 500
    res.status(status).json({ success, message })
  }

  private async getConfig(req: Request, res: Response): Promise<void> {
    const { success, message, config } = await this.nginxManager.getConfig()
    const status = success ? 200 : 500
    res.status(status).json({ success, message, config })
  }

  private async getDefaultConfig(req: Request, res: Response): Promise<void> {
    const { success, message, config } = await this.nginxManager.getTemplate()
    if (success && config) {
      res.json({ success, config })
    } else {
      res.status(500).json({ success, message })
    }
  }

  private async writeDefaultConfig(req: Request, res: Response): Promise<void> {
    const { success, message } = await this.nginxManager.writeDefaultTemplate()
    if (success) {
      res.json({ success, message: 'Default config written successfully' })
    } else {
      res.status(500).json({ success, message })
    }
  }

  private async obtainCertificates(req: Request, res: Response): Promise<void> {
    const { success, message } = await this.nginxManager.obtainCertificates(true)
    const status = success ? 200 : 500
    res.status(status).json({ success, message })
  }

  private async renewCertificates(req: Request, res: Response): Promise<void> {
    const { success, message } = await this.nginxManager.renewCertificates()
    const status = success ? 200 : 500
    res.status(status).json({ success, message })
  }
}