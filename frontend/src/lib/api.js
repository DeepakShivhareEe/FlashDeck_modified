const DEFAULT_API_BASE_URL =
  typeof window !== 'undefined'
    ? (window.location.hostname.endsWith('vercel.app')
        ? '/api'
        : `${window.location.protocol}//${window.location.hostname}:8000`)
    : 'http://127.0.0.1:8000'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '')
const AUTH_TOKEN_KEY = 'flashdeck_auth_token'
const DEBUG_API = import.meta.env.DEV || String(import.meta.env.VITE_DEBUG_API || '').toLowerCase() === 'true'

function buildUrl(path) {
  return `${API_BASE_URL}${path}`
}

export function getApiBaseUrl() {
  return API_BASE_URL
}

export function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token) {
  try {
    if (!token) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      return
    }
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  } catch {
    // Ignore storage errors for non-browser contexts.
  }
}

export async function requestJson(path, options = {}, retries = 1, timeoutMs = 30000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const url = buildUrl(path)
  const method = options.method || 'GET'

  try {
    const token = getAuthToken()
    const headers = {
      ...(options.headers || {}),
    }
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`
    }

    if (DEBUG_API) {
      console.info(`[API] ${method} ${url}`)
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    })

    if (DEBUG_API) {
      console.info(`[API] ${method} ${url} -> ${response.status}`)
    }

    if (!response.ok) {
      const body = await safeReadJson(response)
      const message = body?.detail || body?.message || `Request failed with status ${response.status}`
      throw new Error(message)
    }

    return await safeReadJson(response)
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`)
    }
    if (error instanceof TypeError && /failed to fetch/i.test(error.message || '')) {
      throw new Error(`Failed to fetch ${url}. Check backend availability, API base URL, and CORS settings.`)
    }
    if (retries > 0) {
      return requestJson(path, options, retries - 1, timeoutMs)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function requestBlob(path, options = {}, timeoutMs = 30000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const url = buildUrl(path)
  const method = options.method || 'GET'

  try {
    const token = getAuthToken()
    const headers = {
      ...(options.headers || {}),
    }
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`
    }

    if (DEBUG_API) {
      console.info(`[API] ${method} ${url}`)
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    })

    if (DEBUG_API) {
      console.info(`[API] ${method} ${url} -> ${response.status}`)
    }

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`
      try {
        const body = await response.json()
        message = body?.detail || body?.message || message
      } catch {
        // Keep default message.
      }
      throw new Error(message)
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const blob = await response.blob()
    return { blob, contentType }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`)
    }
    if (error instanceof TypeError && /failed to fetch/i.test(error.message || '')) {
      throw new Error(`Failed to fetch ${url}. Check backend availability, API base URL, and CORS settings.`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function safeReadJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}
