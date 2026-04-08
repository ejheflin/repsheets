import { GOOGLE_CLIENT_ID, SCOPES } from '../config'
import type { AuthUser } from '../types'

const TOKEN_KEY = 'repsheets_token'
const USER_KEY = 'repsheets_user'

declare global {
  interface Window {
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
          revoke: (token: string, callback: () => void) => void
        }
      }
    }
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
}

function clearStored() {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

async function fetchUserInfo(accessToken: string): Promise<Omit<AuthUser, 'accessToken'>> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch user info')
  const data = await res.json()
  return { email: data.email, name: data.name, picture: data.picture }
}

export function initLogin(onSuccess: (user: AuthUser) => void, onError: (err: string) => void) {
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

export async function trySilentRefresh(): Promise<AuthUser | null> {
  return new Promise((resolve) => {
    const stored = getStoredUser()
    if (!stored) { resolve(null); return }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (response) => {
        if (response.error) { clearStored(); resolve(null); return }
        try {
          const info = await fetchUserInfo(response.access_token)
          const user: AuthUser = { ...info, accessToken: response.access_token }
          storeUser(user)
          resolve(user)
        } catch { clearStored(); resolve(null) }
      },
      error_callback: () => { clearStored(); resolve(null) },
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export function logout(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    clearStored()
    window.google.accounts.oauth2.revoke(accessToken, () => { resolve() })
  })
}
