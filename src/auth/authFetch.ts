import { getStoredUser } from './googleAuth'

export class AuthExpiredError extends Error {
  constructor() {
    super('Session expired')
    this.name = 'AuthExpiredError'
  }
}

/**
 * Fetch wrapper that uses the stored token.
 * Throws AuthExpiredError on 401 so the UI can prompt re-auth.
 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const user = getStoredUser()
  if (!user) throw new AuthExpiredError()

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${user.accessToken}`)

  const res = await fetch(url, { ...init, headers })

  if (res.status === 401) {
    throw new AuthExpiredError()
  }

  return res
}
