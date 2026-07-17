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
// Single-flight: many requests can 401 at once on app load; they must share
// one refresh instead of each hitting the worker (or GIS) independently.
let refreshInFlight: ReturnType<typeof silentRefresh> | null = null

function sharedSilentRefresh() {
  if (!refreshInFlight) {
    refreshInFlight = silentRefresh().finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const user = getStoredUser()
  if (!user) throw new AuthExpiredError()

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${user.accessToken}`)

  const res = await fetch(url, { ...init, headers })

  if (res.status === 401 && AUTH_WORKER_URL) {
    // Try silent refresh with the worker
    const refreshed = await sharedSilentRefresh()
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed.accessToken}`)
      const retry = await fetch(url, { ...init, headers })
      if (retry.status === 401) throw new AuthExpiredError()
      return retry
    }
  }

  if (res.status === 401) {
    throw new AuthExpiredError()
  }

  return res
}
