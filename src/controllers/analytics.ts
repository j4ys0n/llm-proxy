import { Express, Request, Response, RequestHandler } from 'express'
import { RequestTracker } from '../utils/requestTracker'
import { log } from '../utils/general'

export class AnalyticsController {
  private app: Express
  private requestTracker: RequestTracker
  private requestHandlers: RequestHandler[]

  constructor({ app, requestHandlers }: { app: Express; requestHandlers: RequestHandler[] }) {
    this.app = app
    this.requestHandlers = requestHandlers
    this.requestTracker = new RequestTracker()
  }

  public registerRoutes(): void {
    this.app.get('/api/analytics/:keyId', ...this.requestHandlers, this.getAnalytics.bind(this))
    log('info', 'AnalyticsController initialized')
  }

  private async getAnalytics(req: Request, res: Response): Promise<void> {
    const { keyId } = req.params
    const { startDate, endDate } = req.query

    if (!keyId) {
      res.status(400).json({ success: false, message: 'Key ID is required' })
      return
    }

    try {
      let records

      if (startDate && endDate) {
        const start = parseInt(startDate as string, 10)
        const end = parseInt(endDate as string, 10)
        records = await this.requestTracker.getRecords(keyId, start, end)
      } else {
        // Default to last week
        records = await this.requestTracker.getLastWeekRecords(keyId)
      }

      res.json({ success: true, records })
    } catch (error) {
      log('error', 'Failed to get analytics', error)
      res.status(500).json({ success: false, message: 'Failed to retrieve analytics' })
    }
  }
}
