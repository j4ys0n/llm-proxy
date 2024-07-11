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
    this.app.post('/nginx/update-config', ...this.requestHandlers, this.updateConfig.bind(this))
    this.app.get('/nginx/config', ...this.requestHandlers, this.getConfig.bind(this))
    this.app.get('/nginx/obtain-certificates', ...this.requestHandlers, this.obtainCertificates.bind(this))
    this.app.get('/nginx/renew-certificates', ...this.requestHandlers, this.renewCertificates.bind(this))
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