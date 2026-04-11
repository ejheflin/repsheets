import { getStoredUser, silentRefresh } from './googleAuth'
import { AUTH_WORKER_URL } from '../config'

export class AuthExpiredError extends Error {
  constructor() {
    super('Session expired')
    this.name = 'AuthExpiredError'
  }
}

/**
 * Fetch wrapper that uses the stored token.
 * If worker is configured, auto-refreshes on 401 using the refresh token.
 * Otherwise throws AuthExpiredError for the UI to handle.
 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const user = getStoredUser()
  if (!user) throw new AuthExpiredError()

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${user.accessToken}`)

  const res = await fetch(url, { ...init, headers })

  if (res.status === 401 && AUTH_WORKER_URL) {
    // Try silent refresh with the worker
    const refreshed = await silentRefresh()
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed.accessToken}`)
      return fetch(url, { ...init, headers })
    }
  }

  if (res.status === 401) {
    throw new AuthExpiredError()
  }

  return res
}
