import { Express, Request, Response, RequestHandler } from 'express'
import { RequestTracker } from '../utils/requestTracker'
import { log } from '../utils/general'
import { validate, apiKeySchema, timestampSchema } from '../utils/validation'
import Joi from 'joi'

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
    // Validate keyId
    const keyValidation = validate<string>(apiKeySchema, req.params.keyId)
    if (keyValidation.error || !keyValidation.value) {
      res.status(400).json({ success: false, message: keyValidation.error || 'Invalid key ID' })
      return
    }
    const validKeyId = keyValidation.value

    // Validate date parameters if provided
    let startDate: number | undefined
    let endDate: number | undefined

    if (req.query.startDate) {
      const startValidation = validate<number>(timestampSchema, parseInt(req.query.startDate as string, 10))
      if (startValidation.error || !startValidation.value) {
        res.status(400).json({ success: false, message: `Invalid start date: ${startValidation.error}` })
        return
      }
      startDate = startValidation.value
    }

    if (req.query.endDate) {
      const endValidation = validate<number>(timestampSchema, parseInt(req.query.endDate as string, 10))
      if (endValidation.error || !endValidation.value) {
        res.status(400).json({ success: false, message: `Invalid end date: ${endValidation.error}` })
        return
      }
      endDate = endValidation.value
    }

    // Validate date range if both provided
    if (startDate && endDate && startDate >= endDate) {
      res.status(400).json({ success: false, message: 'Start date must be before end date' })
      return
    }

    try {
      let records

      if (startDate && endDate) {
        records = await this.requestTracker.getRecords(validKeyId, startDate, endDate)
      } else {
        // Default to last week
        records = await this.requestTracker.getLastWeekRecords(validKeyId)
      }

      res.json({ success: true, records })
    } catch (error) {
      log('error', 'Failed to get analytics', error)
      res.status(500).json({ success: false, message: 'Failed to retrieve analytics' })
    }
  }
}
