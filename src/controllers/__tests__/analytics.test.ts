import { Request, Response } from 'express'
import { AnalyticsController } from '../analytics'
import { RequestTracker } from '../../utils/requestTracker'

// Mock dependencies
jest.mock('../../utils/requestTracker')
jest.mock('../../utils/general', () => ({
  log: jest.fn()
}))

describe('AnalyticsController', () => {
  let controller: AnalyticsController
  let mockApp: any
  let mockRequestTracker: jest.Mocked<RequestTracker>
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>

  beforeEach(() => {
    mockApp = {
      get: jest.fn()
    }

    mockReq = {
      params: {},
      query: {}
    }

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    }

    // Create mock instance
    mockRequestTracker = {
      getRecords: jest.fn(),
      getLastWeekRecords: jest.fn(),
      trackRequest: jest.fn()
    } as any

    ;(RequestTracker as jest.Mock).mockImplementation(() => mockRequestTracker)

    controller = new AnalyticsController({
      app: mockApp,
      requestHandlers: []
    })

    jest.clearAllMocks()
  })

  describe('registerRoutes', () => {
    it('should register analytics routes', () => {
      controller.registerRoutes()

      expect(mockApp.get).toHaveBeenCalledWith(
        '/api/analytics/:keyId',
        expect.any(Function)
      )
    })
  })

  describe('getAnalytics', () => {
    const validApiKey = 'a'.repeat(64)

    it('should return last week records by default', async () => {
      const mockRecords = [
        { startTime: Date.now() - 1000, endTime: Date.now() },
        { startTime: Date.now() - 2000, endTime: Date.now() - 1000 }
      ]

      mockReq.params = { keyId: validApiKey }
      mockRequestTracker.getLastWeekRecords.mockResolvedValue(mockRecords)

      // Get the bound handler
      controller.registerRoutes()
      const handler = mockApp.get.mock.calls[0][1]
      await handler(mockReq, mockRes)

      expect(mockRequestTracker.getLastWeekRecords).toHaveBeenCalledWith(validApiKey)
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, records: mockRecords })
    })

    it('should return records for custom date range', async () => {
      const startDate = Date.now() - 10000
      const endDate = Date.now()
      const mockRecords = [
        { startTime: startDate + 1000, endTime: endDate - 1000 }
      ]

      mockReq.params = { keyId: validApiKey }
      mockReq.query = {
        startDate: startDate.toString(),
        endDate: endDate.toString()
      }
      mockRequestTracker.getRecords.mockResolvedValue(mockRecords)

      controller.registerRoutes()
      const handler = mockApp.get.mock.calls[0][1]
      await handler(mockReq, mockRes)

      expect(mockRequestTracker.getRecords).toHaveBeenCalledWith(validApiKey, startDate, endDate)
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, records: mockRecords })
    })

    it('should reject invalid API key format', async () => {
      mockReq.params = { keyId: 'invalid-key' }

      controller.registerRoutes()
      const handler = mockApp.get.mock.calls[0][1]
      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('Invalid API key format')
      })
    })

    it('should reject invalid start date', async () => {
      mockReq.params = { keyId: validApiKey }
      mockReq.query = {
        startDate: 'invalid',
        endDate: Date.now().toString()
      }

      controller.registerRoutes()
      const handler = mockApp.get.mock.calls[0][1]
      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('Invalid start date')
      })
    })

    it('should reject invalid end date', async () => {
      mockReq.params = { keyId: validApiKey }
      mockReq.query = {
        startDate: Date.now().toString(),
        endDate: 'invalid'
      }

      controller.registerRoutes()
      const handler = mockApp.get.mock.calls[0][1]
      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('Invalid end date')
      })
    })

    it('should reject start date after end date', async () => {
      const now = Date.now()
      mockReq.params = { keyId: validApiKey }
      mockReq.query = {
        startDate: now.toString(),
        endDate: (now - 10000).toString()
      }

      controller.registerRoutes()
      const handler = mockApp.get.mock.calls[0][1]
      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Start date must be before end date'
      })
    })

    it('should handle errors gracefully', async () => {
      mockReq.params = { keyId: validApiKey }
      mockRequestTracker.getLastWeekRecords.mockRejectedValue(new Error('Database error'))

      controller.registerRoutes()
      const handler = mockApp.get.mock.calls[0][1]
      await handler(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to retrieve analytics'
      })
    })
  })
})
