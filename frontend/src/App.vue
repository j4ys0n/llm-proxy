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
          <input type="text" id="username" v-model="loginUsername" required>
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" v-model="loginPassword" required>
        </div>
        <button type="submit" :disabled="isLoading">
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </button>
      </form>
    </div>

    <!-- Main Content (after login) -->
    <div v-else>
      <!-- Tabs -->
      <div class="tabs">
        <button
          :class="['tab', { active: activeTab === 'keys' }]"
          @click="activeTab = 'keys'">
          API Keys
        </button>
        <button
          :class="['tab', { active: activeTab === 'analytics' }]"
          @click="activeTab = 'analytics'">
          Analytics
        </button>
      </div>

      <!-- Keys Tab -->
      <div v-if="activeTab === 'keys'">
        <div class="create-form">
          <h2>Create New API Key</h2>
          <div v-if="createError" class="alert error">{{ createError }}</div>
          <div v-if="createSuccess" class="alert success">{{ createSuccess }}</div>
          <form @submit.prevent="createKey">
            <div class="form-group">
              <label for="newUsername">Username</label>
              <input type="text" id="newUsername" v-model="newUsername" required placeholder="Enter username for API key">
            </div>
            <button type="submit" :disabled="isLoading">
              {{ isLoading ? 'Creating...' : 'Create API Key' }}
            </button>
          </form>
        </div>

        <div class="keys-list">
          <h2>Existing API Keys</h2>
          <div v-if="listError" class="alert error">{{ listError }}</div>
          <div v-if="isLoadingKeys" class="loading">Loading API keys...</div>
          <div v-else-if="keys.length === 0" class="empty-state">
            No API keys found. Create one above to get started.
          </div>
          <div v-else>
            <div v-for="key in keys" :key="key.id" class="key-item">
              <div class="key-info">
                <div class="key-username">{{ key.username }}</div>
                <div class="key-value">{{ key.key }}</div>
                <div class="key-date">Created: {{ formatDate(key.createdAt) }}</div>
              </div>
              <div class="key-actions">
                <button @click="copyToClipboard(key.key)" class="copy-btn">Copy</button>
                <button @click="deleteKey(key.id)" class="secondary" :disabled="isLoading">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Analytics Tab -->
      <div v-if="activeTab === 'analytics'" class="analytics-view">
        <div class="analytics-controls">
          <h2>Request Analytics</h2>
          <div class="controls-row">
            <div class="form-group">
              <label for="keySelect">Select API Key</label>
              <select id="keySelect" v-model="selectedKeyId" @change="loadAnalytics">
                <option value="">-- Select a key --</option>
                <option v-for="key in keys" :key="key.id" :value="key.key">
                  {{ key.username }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="startDate">Start Date</label>
              <input type="datetime-local" id="startDate" v-model="startDate">
            </div>
            <div class="form-group">
              <label for="endDate">End Date</label>
              <input type="datetime-local" id="endDate" v-model="endDate">
            </div>
            <div class="form-group">
              <label>&nbsp;</label>
              <button @click="loadAnalytics" :disabled="!selectedKeyId || isLoadingAnalytics">
                {{ isLoadingAnalytics ? 'Loading...' : 'Load Data' }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="analyticsError" class="alert error">{{ analyticsError }}</div>

        <div v-if="isLoadingAnalytics" class="loading">Loading analytics...</div>

        <div v-else-if="analyticsRecords.length === 0 && selectedKeyId" class="empty-state">
          No analytics data found for the selected period.
        </div>

        <div v-else-if="analyticsRecords.length > 0" class="analytics-table">
          <table>
            <thead>
              <tr>
                <th>Start Time</th>
                <th>Elapsed (ms)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(record, index) in analyticsRecords" :key="index">
                <td>{{ formatAnalyticsDate(record.startTime) }}</td>
                <td>{{ calculateElapsed(record) }}</td>
                <td>
                  <span :class="['status-badge', record.endTime === null ? 'failed' : 'success']">
                    {{ record.endTime === null ? 'Failed' : 'Success' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="analytics-summary">
            <strong>Total Requests:</strong> {{ analyticsRecords.length }} |
            <strong>Successful:</strong> {{ successfulRequests }} |
            <strong>Failed:</strong> {{ failedRequests }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'

// Authentication state
const isAuthenticated = ref(false)
const username = ref('')
const loginUsername = ref('')
const loginPassword = ref('')
const loginError = ref('')

// Loading states
const isLoading = ref(false)
const isLoadingKeys = ref(false)
const isLoadingAnalytics = ref(false)

// API Key management state
const newUsername = ref('')
const createError = ref('')
const createSuccess = ref('')
const listError = ref('')
const keys = ref([])

// Tab state
const activeTab = ref('keys')

// Analytics state
const selectedKeyId = ref('')
const startDate = ref('')
const endDate = ref('')
const analyticsRecords = ref([])
const analyticsError = ref('')

// Computed properties
const successfulRequests = computed(() => {
  return analyticsRecords.value.filter(r => r.endTime !== null).length
})

const failedRequests = computed(() => {
  return analyticsRecords.value.filter(r => r.endTime === null).length
})

// API helper function
const apiCall = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include' // Include cookies in requests
  })

  if (response.status === 401) {
    isAuthenticated.value = false
    username.value = ''
    throw new Error('Unauthorized - please login again')
  }

  return response
}

// Authentication functions
const login = async () => {
  loginError.value = ''
  isLoading.value = true

  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies
      body: JSON.stringify({
        username: loginUsername.value,
        password: loginPassword.value
      })
    })

    const data = await response.json()

    if (response.ok && data.success) {
      username.value = data.username
      isAuthenticated.value = true
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

const logout = async () => {
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include'
    })
  } catch (error) {
    console.error('Logout error:', error)
  }

  isAuthenticated.value = false
  username.value = ''
  keys.value = []
  analyticsRecords.value = []
  selectedKeyId.value = ''
  activeTab.value = 'keys'
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

// Analytics functions
const loadAnalytics = async () => {
  if (!selectedKeyId.value) return

  analyticsError.value = ''
  isLoadingAnalytics.value = true

  try {
    let url = `/api/analytics/${selectedKeyId.value}`
    const params = new URLSearchParams()

    if (startDate.value) {
      params.append('startDate', new Date(startDate.value).getTime().toString())
    }
    if (endDate.value) {
      params.append('endDate', new Date(endDate.value).getTime().toString())
    }

    if (params.toString()) {
      url += `?${params.toString()}`
    }

    const response = await apiCall(url)
    const data = await response.json()

    if (data.success) {
      analyticsRecords.value = data.records
    } else {
      analyticsError.value = data.message || 'Failed to load analytics'
    }
  } catch (error) {
    analyticsError.value = error.message || 'Failed to load analytics'
  } finally {
    isLoadingAnalytics.value = false
  }
}

// Utility functions
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    alert('API key copied to clipboard!')
  } catch (error) {
    // Fallback: navigator.clipboard requires HTTPS in most browsers
    // Log error and show helpful message
    console.error('Clipboard copy failed:', error)
    alert(`Failed to copy. Please copy manually: ${text}`)
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

const formatAnalyticsDate = (epochMs) => {
  const date = new Date(epochMs)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
}

const calculateElapsed = (record) => {
  if (record.endTime === null) {
    return 'N/A'
  }
  return record.endTime - record.startTime
}

// Lifecycle
onMounted(async () => {
  // Try to load keys to check if user is authenticated via cookie
  try {
    const response = await fetch('/api/keys', {
      credentials: 'include'
    })

    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        isAuthenticated.value = true
        keys.value = data.keys
        // Note: username is not available without additional API call
        // Could add /api/me endpoint if needed
      }
    }
  } catch (error) {
    // Not authenticated, show login form
    console.log('Not authenticated on mount')
  }
})
</script>

<style scoped>
* {
  box-sizing: border-box;
}

#app {
  max-width: 1200px;
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

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.tab {
  background: white;
  border: 2px solid #e0e0e0;
  color: #666;
  padding: 12px 24px;
  border-radius: 8px 8px 0 0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  background: #f5f5f5;
  border-color: #4CAF50;
}

.tab.active {
  background: white;
  border-color: #4CAF50;
  border-bottom-color: white;
  color: #4CAF50;
  font-weight: 600;
}

.login-form,
.create-form,
.keys-list,
.analytics-view,
.analytics-controls {
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
input[type="password"],
input[type="datetime-local"],
select {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s;
}

input[type="text"]:focus,
input[type="password"]:focus,
input[type="datetime-local"]:focus,
select:focus {
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

.controls-row {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1.5fr 1fr;
  gap: 15px;
  align-items: end;
}

.analytics-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

thead {
  background: #f5f5f5;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

th {
  font-weight: 600;
  color: #555;
}

tbody tr:hover {
  background: #f9f9f9;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.success {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-badge.failed {
  background: #ffebee;
  color: #c62828;
}

.analytics-summary {
  margin-top: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 14px;
}
</style>
