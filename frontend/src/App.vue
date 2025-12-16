<template>
  <div id="app">
    <div class="header">
      <h1>API Key Management</h1>
      <p class="subtitle">Manage API keys for LLM Proxy</p>
      <div v-if="isAuthenticated" class="header-actions">
        <div class="user-info">Logged in as: {{ username }}</div>
        <button @click="logout" class="logout">Logout</button>
      </div>
    </div>

    <!-- Login Form -->
    <div v-if="!isAuthenticated" class="login-form">
      <h2>Login</h2>
      <div v-if="loginError" class="alert error">{{ loginError }}</div>
      <form @submit.prevent="login">
        <div class="form-group">
          <label for="username">Username</label>
          <input
            type="text"
            id="username"
            v-model="loginUsername"
            required
          >
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input
            type="password"
            id="password"
            v-model="loginPassword"
            required
          >
        </div>
        <button type="submit" :disabled="isLoading">
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </button>
      </form>
    </div>

    <!-- API Key Management -->
    <div v-else>
      <!-- Create Form -->
      <div class="create-form">
        <h2>Create New API Key</h2>
        <div v-if="createError" class="alert error">{{ createError }}</div>
        <div v-if="createSuccess" class="alert success">{{ createSuccess }}</div>
        <form @submit.prevent="createKey">
          <div class="form-group">
            <label for="newUsername">Username</label>
            <input
              type="text"
              id="newUsername"
              v-model="newUsername"
              required
              placeholder="Enter username for API key"
            >
          </div>
          <button type="submit" :disabled="isLoading">
            {{ isLoading ? 'Creating...' : 'Create API Key' }}
          </button>
        </form>
      </div>

      <!-- Keys List -->
      <div class="keys-list">
        <h2>Existing API Keys</h2>
        <div v-if="listError" class="alert error">{{ listError }}</div>

        <div v-if="isLoadingKeys" class="loading">Loading API keys...</div>

        <div v-else-if="keys.length === 0" class="empty-state">
          No API keys found. Create one above to get started.
        </div>

        <div v-else>
          <div
            v-for="key in keys"
            :key="key.id"
            class="key-item"
          >
            <div class="key-info">
              <div class="key-username">{{ key.username }}</div>
              <div class="key-value">{{ key.key }}</div>
              <div class="key-date">Created: {{ formatDate(key.createdAt) }}</div>
            </div>
            <div class="key-actions">
              <button @click="copyToClipboard(key.key)" class="copy-btn">
                Copy
              </button>
              <button @click="deleteKey(key.id)" class="secondary" :disabled="isLoading">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// Authentication state
const isAuthenticated = ref(false)
const token = ref('')
const username = ref('')
const loginUsername = ref('')
const loginPassword = ref('')
const loginError = ref('')

// Loading states
const isLoading = ref(false)
const isLoadingKeys = ref(false)

// API Key management state
const newUsername = ref('')
const createError = ref('')
const createSuccess = ref('')
const listError = ref('')
const keys = ref([])

// API helper function
const apiCall = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (isAuthenticated.value && token.value) {
    headers['Authorization'] = `Bearer ${token.value}`
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  if (response.status === 401) {
    isAuthenticated.value = false
    token.value = ''
    username.value = ''
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    throw new Error('Unauthorized - please login again')
  }

  return response
}

// Authentication functions
const login = async () => {
  loginError.value = ''
  isLoading.value = true

  try {
    const response = await fetch('/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: loginUsername.value,
        password: loginPassword.value
      })
    })

    const data = await response.json()

    if (response.ok && data.token) {
      token.value = data.token
      username.value = loginUsername.value
      isAuthenticated.value = true
      localStorage.setItem('token', data.token)
      localStorage.setItem('username', loginUsername.value)
      loginPassword.value = ''
      await loadKeys()
    } else {
      loginError.value = data.error || 'Login failed'
    }
  } catch (error) {
    loginError.value = 'Network error. Please try again.'
  } finally {
    isLoading.value = false
  }
}

const logout = () => {
  isAuthenticated.value = false
  token.value = ''
  username.value = ''
  keys.value = []
  localStorage.removeItem('token')
  localStorage.removeItem('username')
}

// API Key management functions
const loadKeys = async () => {
  listError.value = ''
  isLoadingKeys.value = true

  try {
    const response = await apiCall('/api/keys')
    const data = await response.json()

    if (data.success) {
      keys.value = data.keys
    } else {
      listError.value = data.message || 'Failed to load API keys'
    }
  } catch (error) {
    listError.value = error.message || 'Failed to load API keys'
  } finally {
    isLoadingKeys.value = false
  }
}

const createKey = async () => {
  createError.value = ''
  createSuccess.value = ''
  isLoading.value = true

  try {
    const response = await apiCall('/api/keys', {
      method: 'POST',
      body: JSON.stringify({ username: newUsername.value })
    })

    const data = await response.json()

    if (data.success) {
      createSuccess.value = `API key created successfully for ${newUsername.value}`
      newUsername.value = ''
      await loadKeys()
      setTimeout(() => { createSuccess.value = '' }, 5000)
    } else {
      createError.value = data.message || 'Failed to create API key'
    }
  } catch (error) {
    createError.value = error.message || 'Failed to create API key'
  } finally {
    isLoading.value = false
  }
}

const deleteKey = async (id) => {
  if (!confirm('Are you sure you want to delete this API key?')) {
    return
  }

  isLoading.value = true

  try {
    const response = await apiCall(`/api/keys/${id}`, {
      method: 'DELETE'
    })

    const data = await response.json()

    if (data.success) {
      await loadKeys()
    } else {
      alert(data.message || 'Failed to delete API key')
    }
  } catch (error) {
    alert(error.message || 'Failed to delete API key')
  } finally {
    isLoading.value = false
  }
}

// Utility functions
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    alert('API key copied to clipboard!')
  } catch (error) {
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    alert('API key copied to clipboard!')
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

// Lifecycle
onMounted(() => {
  const savedToken = localStorage.getItem('token')
  const savedUsername = localStorage.getItem('username')

  if (savedToken && savedUsername) {
    token.value = savedToken
    username.value = savedUsername
    isAuthenticated.value = true
    loadKeys()
  }
})
</script>

<style scoped>
* {
  box-sizing: border-box;
}

#app {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  color: #333;
  line-height: 1.6;
}

.header {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

h1 {
  font-size: 28px;
  margin-bottom: 10px;
}

.subtitle {
  color: #666;
  font-size: 14px;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
}

.user-info {
  color: #666;
  font-size: 14px;
}

.login-form,
.create-form,
.keys-list {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

h2 {
  margin-bottom: 20px;
  font-size: 20px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #555;
}

input[type="text"],
input[type="password"] {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s;
}

input[type="text"]:focus,
input[type="password"]:focus {
  outline: none;
  border-color: #4CAF50;
}

button {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover {
  background: #45a049;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

button.secondary {
  background: #f44336;
}

button.secondary:hover {
  background: #da190b;
}

button.logout {
  background: #666;
}

button.logout:hover {
  background: #555;
}

button.copy-btn {
  background: #2196F3;
  padding: 6px 12px;
  font-size: 12px;
  margin-right: 10px;
}

button.copy-btn:hover {
  background: #1976D2;
}

.alert {
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.alert.error {
  background: #ffebee;
  color: #c62828;
  border-left: 4px solid #c62828;
}

.alert.success {
  background: #e8f5e9;
  color: #2e7d32;
  border-left: 4px solid #2e7d32;
}

.key-item {
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: box-shadow 0.2s;
}

.key-item:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.key-info {
  flex: 1;
}

.key-username {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 8px;
  color: #333;
}

.key-value {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #666;
  background: #f5f5f5;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 8px;
  word-break: break-all;
}

.key-date {
  font-size: 12px;
  color: #999;
}

.key-actions {
  margin-left: 20px;
}

.empty-state,
.loading {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
