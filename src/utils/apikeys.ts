import fs from 'fs-extra'
import crypto from 'crypto'
import path from 'path'
import { log } from './general'

export interface ApiKey {
  id: string
  username: string
  key: string
  createdAt: string
}

export class ApiKeyManager {
  private filePath: string
  private lockFile: string
  private isInitialized: boolean = false

  constructor(filePath: string = './data/apikeys.json') {
    this.filePath = path.resolve(filePath)
    this.lockFile = `${this.filePath}.lock`
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      await fs.ensureDir(path.dirname(this.filePath))

      const exists = await fs.pathExists(this.filePath)
      if (!exists) {
        await fs.writeJson(this.filePath, { keys: [] }, { spaces: 2 })
        log('info', `Created API keys file at ${this.filePath}`)
      }

      this.isInitialized = true
    } catch (error) {
      log('error', 'Failed to initialize API key storage', error)
      throw error
    }
  }

  private async acquireLock(maxRetries: number = 10, retryDelay: number = 100): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await fs.writeFile(this.lockFile, process.pid.toString(), { flag: 'wx' })
        return
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error('Failed to acquire lock on API keys file')
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await fs.remove(this.lockFile)
    } catch (error) {
      log('warn', 'Failed to release lock file', error)
    }
  }

  private async safeRead(): Promise<{ keys: ApiKey[] }> {
    await this.initialize()

    try {
      await this.acquireLock()
      const data = await fs.readJson(this.filePath)
      await this.releaseLock()

      if (!data.keys || !Array.isArray(data.keys)) {
        return { keys: [] }
      }

      return data
    } catch (error) {
      await this.releaseLock()
      log('error', 'Failed to read API keys file', error)
      return { keys: [] }
    }
  }

  private async safeWrite(data: { keys: ApiKey[] }): Promise<boolean> {
    await this.initialize()

    try {
      await this.acquireLock()
      await fs.writeJson(this.filePath, data, { spaces: 2 })
      await this.releaseLock()
      return true
    } catch (error) {
      await this.releaseLock()
      log('error', 'Failed to write API keys file', error)
      return false
    }
  }

  public async listKeys(): Promise<ApiKey[]> {
    const data = await this.safeRead()
    return data.keys
  }

  public async getKeyByUsername(username: string): Promise<ApiKey | null> {
    const data = await this.safeRead()
    const key = data.keys.find(k => k.username === username)
    return key || null
  }

  public async getKeyById(id: string): Promise<ApiKey | null> {
    const data = await this.safeRead()
    const key = data.keys.find(k => k.id === id)
    return key || null
  }

  public async createKey(username: string): Promise<{ success: boolean; message: string; key?: ApiKey }> {
    if (!username || username.trim().length === 0) {
      return { success: false, message: 'Username is required' }
    }

    const data = await this.safeRead()

    const existing = data.keys.find(k => k.username === username)
    if (existing) {
      return { success: false, message: 'API key already exists for this username' }
    }

    const newKey: ApiKey = {
      id: crypto.randomBytes(16).toString('hex'),
      username: username.trim(),
      key: `sk-${crypto.randomBytes(32).toString('hex')}`,
      createdAt: new Date().toISOString()
    }

    data.keys.push(newKey)
    const writeSuccess = await this.safeWrite(data)

    if (writeSuccess) {
      log('info', `Created API key for user: ${username}`)
      return { success: true, message: 'API key created successfully', key: newKey }
    } else {
      return { success: false, message: 'Failed to save API key' }
    }
  }

  public async deleteKey(id: string): Promise<{ success: boolean; message: string }> {
    const data = await this.safeRead()

    const index = data.keys.findIndex(k => k.id === id)
    if (index === -1) {
      return { success: false, message: 'API key not found' }
    }

    const deletedKey = data.keys[index]
    data.keys.splice(index, 1)

    const writeSuccess = await this.safeWrite(data)

    if (writeSuccess) {
      log('info', `Deleted API key for user: ${deletedKey.username}`)
      return { success: true, message: 'API key deleted successfully' }
    } else {
      return { success: false, message: 'Failed to delete API key' }
    }
  }

  public async validateKey(key: string): Promise<ApiKey | null> {
    const data = await this.safeRead()
    const apiKey = data.keys.find(k => k.key === key)
    return apiKey || null
  }
}
