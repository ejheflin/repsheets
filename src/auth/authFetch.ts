import { refreshToken } from './googleAuth'
import { getStoredUser } from './googleAuth'

/**
 * Fetch wrapper that auto-refreshes the token on 401 and retries once.
 * Uses the stored token, so callers don't need to pass it.
 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const user = getStoredUser()
  if (!user) throw new Error('Not authenticated')

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${user.accessToken}`)

  const res = await fetch(url, { ...init, headers })

  if (res.status === 401) {
    const refreshed = await refreshToken()
    if (!refreshed) throw new Error('Token refresh failed — please log in again')

    headers.set('Authorization', `Bearer ${refreshed.accessToken}`)
    return fetch(url, { ...init, headers })
  }

  return res
}
