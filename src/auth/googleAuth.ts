import { GOOGLE_CLIENT_ID, SCOPES, SCOPE_VERSION, AUTH_WORKER_URL } from '../config'
import type { AuthUser } from '../types'

const TOKEN_KEY = 'repsheets_token'
const USER_KEY = 'repsheets_user'
const REFRESH_TOKEN_KEY = 'repsheets_refresh_token'
const TOKEN_TIME_KEY = 'repsheets_token_time'
const OAUTH_STATE_KEY = 'repsheets_oauth_state'

// CSRF protection: the redirect must echo back a nonce we generated, so an
// attacker can't log the user into an attacker-controlled account via ?code=
function generateOAuthState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function isIOSPWA(): boolean {
  return !!(window.navigator as unknown as { standalone?: boolean }).standalone
}

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
            hint?: string
            callback: (response: { access_token: string; error?: string }) => void
            error_callback?: (error: { type: string }) => void
          }) => {
            requestAccessToken: (opts?: { prompt?: string }) => void
          }
          initCodeClient: (config: {
            client_id: string
            scope: string
            ux_mode: string
            redirect_uri?: string
            state?: string
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

function storeRefreshToken(token: string | undefined) {
  // Google omits refresh_token on re-consent; never clobber a valid one
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

function getRefreshToken(): string | null {
  const token = localStorage.getItem(REFRESH_TOKEN_KEY)
  // Older builds could store the literal string "undefined"
  if (!token || token === 'undefined' || token === 'null') {
    if (token) localStorage.removeItem(REFRESH_TOKEN_KEY)
    return null
  }
  return token
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
function isCodeFlowEnabled(): boolean {
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
    // Worker/proxy failures can return HTML — don't assume a JSON body
    let message = `Token exchange failed (${res.status})`
    try {
      const err = await res.json()
      if (err.error) message = err.error
    } catch {}
    throw new Error(message)
  }
  return res.json()
}

export const AUTH_ERROR_KEY = 'repsheets_auth_error'

export async function silentRefresh(): Promise<AuthUser | null> {
  const storedRefreshToken = getRefreshToken()
  if (storedRefreshToken && AUTH_WORKER_URL) {
    try {
      const res = await fetch(`${AUTH_WORKER_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: storedRefreshToken,
          client_id: GOOGLE_CLIENT_ID,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const info = await fetchUserInfo(data.access_token)
        const existing = getStoredUser()
        const user: AuthUser = { ...info, accessToken: data.access_token, scopeVersion: existing?.scopeVersion }
        storeUser(user)
        return user
      }
      if (res.status === 400 || res.status === 401) {
        // invalid_grant — token revoked or expired; stop retrying it forever
        localStorage.removeItem(REFRESH_TOKEN_KEY)
      }
    } catch {
      // fall through to GIS silent refresh
    }
  }

  if (!isIOSPWA()) return null

  // iOS PWA has no refresh token; use GIS silent token grant against the device's active Google session
  return new Promise((resolve) => {
    try {
      const existing = getStoredUser()
      window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        hint: existing?.email,
        callback: async (response) => {
          if (response.error) { resolve(null); return }
          try {
            const info = await fetchUserInfo(response.access_token)
            const user: AuthUser = { ...info, accessToken: response.access_token, scopeVersion: existing?.scopeVersion }
            storeUser(user)
            resolve(user)
          } catch { resolve(null) }
        },
        error_callback: () => { resolve(null) },
      }).requestAccessToken({ prompt: 'none' })
    } catch { resolve(null) }
  })
}

export async function handleRedirectCode(): Promise<AuthUser | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return null

  // Clean OAuth params from URL before any async work
  const clean = new URL(window.location.href)
  ;['code', 'scope', 'authuser', 'prompt', 'error', 'state'].forEach((k) => clean.searchParams.delete(k))
  window.history.replaceState({}, '', clean.pathname + clean.search)

  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY)
  sessionStorage.removeItem(OAUTH_STATE_KEY)
  if (!expectedState || params.get('state') !== expectedState) {
    sessionStorage.setItem(AUTH_ERROR_KEY, '1')
    return null
  }

  if (params.get('error')) {
    sessionStorage.setItem(AUTH_ERROR_KEY, '1')
    return null
  }

  try {
    const tokens = await exchangeCode(code)
    storeRefreshToken(tokens.refresh_token)
    const info = await fetchUserInfo(tokens.access_token)
    const user: AuthUser = { ...info, accessToken: tokens.access_token, scopeVersion: SCOPE_VERSION }
    storeUser(user)
    sessionStorage.removeItem(AUTH_ERROR_KEY)
    return user
  } catch (e) {
    console.error('Code exchange failed:', e)
    sessionStorage.setItem(AUTH_ERROR_KEY, '1')
    return null
  }
}

// === Implicit Grant Flow (fallback, no worker) ===

export function initLogin(onSuccess: (user: AuthUser) => void, onError: (err: string) => void) {
  if (isCodeFlowEnabled()) {
    if (isIOSPWA() && window.location.protocol !== 'https:') {
      // Local dev iOS PWA: redirect requires https, fall back to token client
      window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        hint: getStoredUser()?.email,
        callback: async (response) => {
          if (response.error) { onError(response.error); return }
          try {
            const info = await fetchUserInfo(response.access_token)
            const user: AuthUser = { ...info, accessToken: response.access_token, scopeVersion: SCOPE_VERSION }
            storeUser(user)
            onSuccess(user)
          } catch (e) { onError(String(e)) }
        },
        error_callback: (error) => { onError(error.type) },
      }).requestAccessToken()
      return
    }
    // Redirect flow for all other cases (iOS PWA on HTTPS + all regular browsers)
    const state = generateOAuthState()
    sessionStorage.setItem(OAUTH_STATE_KEY, state)
    window.google.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      ux_mode: 'redirect',
      redirect_uri: window.location.origin,
      state,
      callback: () => {},
      error_callback: (error) => { onError(error.type) },
    }).requestCode()
    return
  }
  // Implicit grant flow (fallback, no worker)
  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: async (response) => {
      if (response.error) { onError(response.error); return }
      try {
        const info = await fetchUserInfo(response.access_token)
        const user: AuthUser = { ...info, accessToken: response.access_token, scopeVersion: SCOPE_VERSION }
        storeUser(user)
        onSuccess(user)
      } catch (e) { console.error('Login error:', e); onError(String(e)) }
    },
    error_callback: (error) => { onError(error.type) },
  })
  client.requestAccessToken()
}

export function upgradeStoredToken(accessToken: string): AuthUser | null {
  const user = getStoredUser()
  if (!user) return null
  const updated: AuthUser = { ...user, accessToken, scopeVersion: SCOPE_VERSION }
  storeUser(updated)
  return updated
}

export function logout(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    clearStored()
    // Revocation is best-effort — never leave the UI logged in because GIS
    // wasn't loaded (offline PWA launch) or its callback never fired
    try {
      window.google.accounts.oauth2.revoke(accessToken, () => resolve())
      setTimeout(resolve, 2000)
    } catch {
      resolve()
    }
  })
}
