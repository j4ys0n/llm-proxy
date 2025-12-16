import fs from 'fs-extra'
import path from 'path'
import { ApiKeyManager } from '../apikeys'

describe('ApiKeyManager', () => {
  let manager: ApiKeyManager
  let testFilePath: string

  beforeEach(() => {
    // Use a unique test file for each test
    testFilePath = path.join(__dirname, `test-apikeys-${Date.now()}.json`)
    manager = new ApiKeyManager(testFilePath)
  })

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.remove(testFilePath)
      await fs.remove(`${testFilePath}.lock`)
      await fs.remove(path.dirname(testFilePath))
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('createKey', () => {
    it('should create a new API key', async () => {
      const result = await manager.createKey('testuser')

      expect(result.success).toBe(true)
      expect(result.key).toBeDefined()
      expect(result.key?.username).toBe('testuser')
      expect(result.key?.key).toMatch(/^sk-[a-f0-9]{64}$/)
      expect(result.key?.id).toBeDefined()
      expect(result.key?.createdAt).toBeDefined()
    })

    it('should reject empty username', async () => {
      const result = await manager.createKey('')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Username is required')
    })

    it('should reject duplicate username', async () => {
      await manager.createKey('testuser')
      const result = await manager.createKey('testuser')

      expect(result.success).toBe(false)
      expect(result.message).toBe('API key already exists for this username')
    })

    it('should trim whitespace from username', async () => {
      const result = await manager.createKey('  testuser  ')

      expect(result.success).toBe(true)
      expect(result.key?.username).toBe('testuser')
    })
  })

  describe('listKeys', () => {
    it('should return empty array when no keys exist', async () => {
      const keys = await manager.listKeys()

      expect(keys).toEqual([])
    })

    it('should return all created keys', async () => {
      await manager.createKey('user1')
      await manager.createKey('user2')
      await manager.createKey('user3')

      const keys = await manager.listKeys()

      expect(keys).toHaveLength(3)
      expect(keys.map(k => k.username)).toEqual(['user1', 'user2', 'user3'])
    })
  })

  describe('getKeyByUsername', () => {
    it('should return null when key does not exist', async () => {
      const key = await manager.getKeyByUsername('nonexistent')

      expect(key).toBeNull()
    })

    it('should return the key when it exists', async () => {
      const created = await manager.createKey('testuser')
      const fetched = await manager.getKeyByUsername('testuser')

      expect(fetched).toBeDefined()
      expect(fetched?.username).toBe('testuser')
      expect(fetched?.id).toBe(created.key?.id)
    })
  })

  describe('getKeyById', () => {
    it('should return null when key does not exist', async () => {
      const key = await manager.getKeyById('nonexistent')

      expect(key).toBeNull()
    })

    it('should return the key when it exists', async () => {
      const created = await manager.createKey('testuser')
      const fetched = await manager.getKeyById(created.key!.id)

      expect(fetched).toBeDefined()
      expect(fetched?.username).toBe('testuser')
      expect(fetched?.id).toBe(created.key?.id)
    })
  })

  describe('deleteKey', () => {
    it('should return error when key does not exist', async () => {
      const result = await manager.deleteKey('nonexistent')

      expect(result.success).toBe(false)
      expect(result.message).toBe('API key not found')
    })

    it('should delete existing key', async () => {
      const created = await manager.createKey('testuser')
      const deleteResult = await manager.deleteKey(created.key!.id)

      expect(deleteResult.success).toBe(true)

      const keys = await manager.listKeys()
      expect(keys).toHaveLength(0)
    })

    it('should only delete the specified key', async () => {
      const created1 = await manager.createKey('user1')
      await manager.createKey('user2')
      await manager.createKey('user3')

      await manager.deleteKey(created1.key!.id)

      const keys = await manager.listKeys()
      expect(keys).toHaveLength(2)
      expect(keys.map(k => k.username)).toEqual(['user2', 'user3'])
    })
  })

  describe('validateKey', () => {
    it('should return null for invalid key', async () => {
      const result = await manager.validateKey('invalid-key')

      expect(result).toBeNull()
    })

    it('should return key data for valid key', async () => {
      const created = await manager.createKey('testuser')
      const validated = await manager.validateKey(created.key!.key)

      expect(validated).toBeDefined()
      expect(validated?.username).toBe('testuser')
      expect(validated?.id).toBe(created.key?.id)
    })
  })
})
