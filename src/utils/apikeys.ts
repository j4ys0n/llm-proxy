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
  private keysCache: Map<string, ApiKey> = new Map()

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

      // Load keys into memory
      const data = await this.loadFromDisk()
      this.keysCache.clear()
      for (const key of data.keys) {
        this.keysCache.set(key.key, key)
      }

      this.isInitialized = true
      log('info', `Loaded ${this.keysCache.size} API keys into memory`)
    } catch (error) {
      log('error', 'Failed to initialize API key storage', error)
      throw error
    }
  }

  private async loadFromDisk(): Promise<{ keys: ApiKey[] }> {
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
    await this.initialize()
    return Array.from(this.keysCache.values())
  }

  public async getKeyByUsername(username: string): Promise<ApiKey | null> {
    await this.initialize()
    for (const key of this.keysCache.values()) {
      if (key.username === username) {
        return key
      }
    }
    return null
  }

  public async getKeyById(id: string): Promise<ApiKey | null> {
    await this.initialize()
    for (const key of this.keysCache.values()) {
      if (key.id === id) {
        return key
      }
    }
    return null
  }

  public async createKey(username: string): Promise<{ success: boolean; message: string; key?: ApiKey }> {
    await this.initialize()

    if (!username || username.trim().length === 0) {
      return { success: false, message: 'Username is required' }
    }

    // Check cache for existing username
    for (const key of this.keysCache.values()) {
      if (key.username === username.trim()) {
        return { success: false, message: 'API key already exists for this username' }
      }
    }

    const newKey: ApiKey = {
      id: crypto.randomBytes(16).toString('hex'),
      username: username.trim(),
      key: `sk-${crypto.randomBytes(32).toString('hex')}`,
      createdAt: new Date().toISOString()
    }

    // Write to disk
    const allKeys = Array.from(this.keysCache.values())
    allKeys.push(newKey)
    const writeSuccess = await this.safeWrite({ keys: allKeys })

    if (writeSuccess) {
      // Update cache
      this.keysCache.set(newKey.key, newKey)
      log('info', `Created API key for user: ${username}`)
      return { success: true, message: 'API key created successfully', key: newKey }
    } else {
      return { success: false, message: 'Failed to save API key' }
    }
  }

  public async deleteKey(id: string): Promise<{ success: boolean; message: string }> {
    await this.initialize()

    // Find key in cache
    let keyToDelete: ApiKey | null = null
    for (const key of this.keysCache.values()) {
      if (key.id === id) {
        keyToDelete = key
        break
      }
    }

    if (!keyToDelete) {
      return { success: false, message: 'API key not found' }
    }

    // Remove from cache and write to disk
    const allKeys = Array.from(this.keysCache.values()).filter(k => k.id !== id)
    const writeSuccess = await this.safeWrite({ keys: allKeys })

    if (writeSuccess) {
      // Update cache
      this.keysCache.delete(keyToDelete.key)
      log('info', `Deleted API key for user: ${keyToDelete.username}`)
      return { success: true, message: 'API key deleted successfully' }
    } else {
      return { success: false, message: 'Failed to delete API key' }
    }
  }

  public async validateKey(key: string): Promise<ApiKey | null> {
    await this.initialize()
    return this.keysCache.get(key) || null
  }
}
