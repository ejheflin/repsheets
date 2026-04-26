import { GOOGLE_CLIENT_ID, SCOPES, AUTH_WORKER_URL } from '../config'
import type { AuthUser } from '../types'

const TOKEN_KEY = 'repsheets_token'
const USER_KEY = 'repsheets_user'
const REFRESH_TOKEN_KEY = 'repsheets_refresh_token'
const TOKEN_TIME_KEY = 'repsheets_token_time'

declare global {
  interface Window {
    gapi: {
      load: (module: string, config: { callback: () => void; onerror?: (err: unknown) => void }) => void
    }
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token: string; error?: string }) => void
            error_callback?: (error: { type: string }) => void
          }) => {
            requestAccessToken: (opts?: { prompt?: string }) => void
          }
          initCodeClient: (config: {
            client_id: string
            scope: string
            ux_mode: string
            callback: (response: { code: string; error?: string }) => void
            error_callback?: (error: { type: string }) => void
          }) => {
            requestCode: () => void
          }
          revoke: (token: string, callback: () => void) => void
        }
      }
      picker?: {
        PickerBuilder: { new(): PickerBuilderInstance }
        ViewId: { SPREADSHEETS: string }
        Action: { PICKED: string; CANCEL: string }
      }
    }
  }
  interface PickerBuilderInstance {
    addView(viewId: string): PickerBuilderInstance
    setOAuthToken(token: string): PickerBuilderInstance
    setDeveloperKey(key: string): PickerBuilderInstance
    setCallback(cb: (data: PickerCallbackData) => void): PickerBuilderInstance
    build(): { setVisible(visible: boolean): void }
  }
  interface PickerCallbackData {
    action: string
    docs?: Array<{ id: string; name: string; mimeType: string }>
  }
}

export function getStoredUser(): AuthUser | null {
  const json = localStorage.getItem(USER_KEY)
  if (!json) return null
  try { return JSON.parse(json) } catch { return null }
}

function storeUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  localStorage.setItem(TOKEN_KEY, user.accessToken)
  localStorage.setItem(TOKEN_TIME_KEY, String(Date.now()))
}

function storeRefreshToken(token: string) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

function clearStored() {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(TOKEN_TIME_KEY)
}

async function fetchUserInfo(accessToken: string): Promise<Omit<AuthUser, 'accessToken'>> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch user info')
  const data = await res.json()
  return { email: data.email, name: data.name, picture: data.picture }
}

// Check if we should use the authorization code flow (worker available)
function useCodeFlow(): boolean {
  return !!AUTH_WORKER_URL
}

// === Authorization Code Flow (with worker) ===

async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch(`${AUTH_WORKER_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: window.location.origin,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Token exchange failed')
  }
  return res.json()
}

export async function silentRefresh(): Promise<AuthUser | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken || !AUTH_WORKER_URL) return null

  try {
    const res = await fetch(`${AUTH_WORKER_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: refreshToken,
        client_id: GOOGLE_CLIENT_ID,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()

    const info = await fetchUserInfo(data.access_token)
    const user: AuthUser = { ...info, accessToken: data.access_token }
    storeUser(user)
    return user
  } catch {
    return null
  }
}

// === Implicit Grant Flow (fallback, no worker) ===

export function initLogin(onSuccess: (user: AuthUser) => void, onError: (err: string) => void) {
  if (useCodeFlow()) {
    // Authorization code flow
    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      ux_mode: 'popup',
      callback: async (response) => {
        if (response.error) { onError(response.error); return }
        try {
          const tokens = await exchangeCode(response.code)
          storeRefreshToken(tokens.refresh_token)
          const info = await fetchUserInfo(tokens.access_token)
          const user: AuthUser = { ...info, accessToken: tokens.access_token }
          storeUser(user)
          onSuccess(user)
        } catch (e) { console.error('Code exchange error:', e); onError(String(e)) }
      },
      error_callback: (error) => { onError(error.type) },
    })
    client.requestCode()
  } else {
    // Implicit grant flow (original)
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (response) => {
        if (response.error) { onError(response.error); return }
        try {
          const info = await fetchUserInfo(response.access_token)
          const user: AuthUser = { ...info, accessToken: response.access_token }
          storeUser(user)
          onSuccess(user)
        } catch (e) { console.error('Login error:', e); onError(String(e)) }
      },
      error_callback: (error) => { onError(error.type) },
    })
    client.requestAccessToken()
  }
}

export function refreshToken(): Promise<AuthUser | null> {
  // Try worker-based refresh first
  if (useCodeFlow()) {
    return silentRefresh()
  }

  // Fallback: GIS implicit refresh
  return new Promise((resolve) => {
    const tryRefresh = (silent: boolean) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (response) => {
          if (response.error) {
            if (silent) { tryRefresh(false) } else { resolve(null) }
            return
          }
          try {
            const info = await fetchUserInfo(response.access_token)
            const user: AuthUser = { ...info, accessToken: response.access_token }
            storeUser(user)
            resolve(user)
          } catch { resolve(null) }
        },
        error_callback: () => {
          if (silent) { tryRefresh(false) } else { resolve(null) }
        },
      })
      client.requestAccessToken(silent ? { prompt: '' } : {})
    }
    tryRefresh(true)
  })
}

export function isTokenExpiringSoon(): boolean {
  const timeStr = localStorage.getItem(TOKEN_TIME_KEY)
  if (!timeStr) return true
  const elapsed = Date.now() - Number(timeStr)
  return elapsed > 45 * 60 * 1000 // 45 minutes
}

export function logout(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    clearStored()
    window.google.accounts.oauth2.revoke(accessToken, () => { resolve() })
  })
}
