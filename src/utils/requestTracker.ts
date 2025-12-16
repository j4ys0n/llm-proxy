import fs from 'fs-extra'
import path from 'path'
import { log } from './general'

export interface RequestRecord {
  startTime: number  // epoch ms
  endTime: number | null  // epoch ms or null if failed
}

export class RequestTracker {
  private dataDir: string
  private cache: Map<string, RequestRecord[]> = new Map()
  private readonly ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

  constructor(dataDir: string = './data/analytics') {
    this.dataDir = path.resolve(dataDir)
  }

  private async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.dataDir)
    } catch (error) {
      log('error', 'Failed to initialize request tracker', error)
      throw error
    }
  }

  private getFilePath(apiKey: string): string {
    // Use MD5 hash of API key as filename to avoid filesystem issues
    const crypto = require('crypto')
    const hash = crypto.createHash('md5').update(apiKey).digest('hex')
    return path.join(this.dataDir, `${hash}.csv`)
  }

  private async loadKeyData(apiKey: string): Promise<void> {
    const filePath = this.getFilePath(apiKey)

    try {
      const exists = await fs.pathExists(filePath)
      if (!exists) {
        this.cache.set(apiKey, [])
        return
      }

      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.trim().split('\n')

      // Skip header
      const records: RequestRecord[] = []
      const oneWeekAgo = Date.now() - this.ONE_WEEK_MS

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const [startTime, endTime] = line.split(',')
        const start = parseInt(startTime, 10)

        // Only keep last week in memory
        if (start >= oneWeekAgo) {
          records.push({
            startTime: start,
            endTime: endTime === 'null' ? null : parseInt(endTime, 10)
          })
        }
      }

      this.cache.set(apiKey, records)
      log('info', `Loaded ${records.length} records for API key (last week)`)
    } catch (error) {
      log('error', `Failed to load data for API key`, error)
      this.cache.set(apiKey, [])
    }
  }

  public async trackRequest(apiKey: string, startTime: number, endTime: number | null): Promise<void> {
    await this.initialize()

    // Ensure cache is loaded for this key
    if (!this.cache.has(apiKey)) {
      await this.loadKeyData(apiKey)
    }

    const record: RequestRecord = { startTime, endTime }

    // Add to cache
    const records = this.cache.get(apiKey) || []
    records.push(record)
    this.cache.set(apiKey, records)

    // Append to CSV file
    const filePath = this.getFilePath(apiKey)
    const csvLine = `${startTime},${endTime === null ? 'null' : endTime}\n`

    try {
      const exists = await fs.pathExists(filePath)
      if (!exists) {
        // Create file with header
        await fs.writeFile(filePath, 'startTime,endTime\n' + csvLine)
      } else {
        // Append to existing file
        await fs.appendFile(filePath, csvLine)
      }
    } catch (error) {
      log('error', `Failed to write request record`, error)
    }
  }

  public async getRecords(apiKey: string, startDate?: number, endDate?: number): Promise<RequestRecord[]> {
    await this.initialize()

    const filePath = this.getFilePath(apiKey)
    const exists = await fs.pathExists(filePath)

    if (!exists) {
      return []
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.trim().split('\n')

      const records: RequestRecord[] = []

      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const [startTime, endTime] = line.split(',')
        const start = parseInt(startTime, 10)

        // Filter by date range if provided
        if (startDate && start < startDate) continue
        if (endDate && start > endDate) continue

        records.push({
          startTime: start,
          endTime: endTime === 'null' ? null : parseInt(endTime, 10)
        })
      }

      return records
    } catch (error) {
      log('error', `Failed to read records for API key`, error)
      return []
    }
  }

  public async getLastWeekRecords(apiKey: string): Promise<RequestRecord[]> {
    const oneWeekAgo = Date.now() - this.ONE_WEEK_MS
    return this.getRecords(apiKey, oneWeekAgo)
  }

  public async cleanupOldData(apiKey: string): Promise<void> {
    // This can be called periodically to clean up old data from CSV files
    const filePath = this.getFilePath(apiKey)
    const exists = await fs.pathExists(filePath)

    if (!exists) return

    try {
      const oneWeekAgo = Date.now() - this.ONE_WEEK_MS
      const records = await this.getRecords(apiKey)

      // Filter to keep only last week
      const recentRecords = records.filter(r => r.startTime >= oneWeekAgo)

      // Rewrite file with only recent records
      let content = 'startTime,endTime\n'
      for (const record of recentRecords) {
        content += `${record.startTime},${record.endTime === null ? 'null' : record.endTime}\n`
      }

      await fs.writeFile(filePath, content)

      // Update cache
      this.cache.set(apiKey, recentRecords)

      log('info', `Cleaned up old data for API key, kept ${recentRecords.length} records`)
    } catch (error) {
      log('error', `Failed to cleanup old data`, error)
    }
  }
}
