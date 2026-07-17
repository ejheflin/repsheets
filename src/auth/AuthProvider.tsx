import { createContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { AuthUser } from '../types'
import { getStoredUser, initLogin, logout as doLogout, upgradeStoredToken, handleRedirectCode } from './googleAuth'
import { GOOGLE_CLIENT_ID, SCOPES, SCOPE_VERSION, AUTH_WORKER_URL } from '../config'

const UPGRADE_ATTEMPT_KEY = 'repsheets_scope_upgrade_attempted'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: () => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue>({
  user: null, isLoading: true, login: () => {}, logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const upgradeAttempted = useRef(false)

  useEffect(() => {
    const init = async () => {
      const redirectUser = await handleRedirectCode()
      if (redirectUser) {
        setUser(redirectUser)
        setIsLoading(false)
        return
      }
      const stored = getStoredUser()
      if (stored) setUser(stored)
      setIsLoading(false)
    }
    init()
  }, [])

  // Request fresh credentials when the stored ones predate a scope change
  useEffect(() => {
    if (!user || (user.scopeVersion ?? 0) >= SCOPE_VERSION || upgradeAttempted.current) return
    upgradeAttempted.current = true

    // Code flow: only a fresh code exchange re-mints the refresh token with
    // the new scopes — an implicit access-token upgrade would silently revert
    // to the old scopes on the next hourly refresh
    if (AUTH_WORKER_URL) {
      // Once per session: if the user cancels the consent redirect, don't
      // bounce them to Google again on every reload
      if (sessionStorage.getItem(UPGRADE_ATTEMPT_KEY) === String(SCOPE_VERSION)) return
      sessionStorage.setItem(UPGRADE_ATTEMPT_KEY, String(SCOPE_VERSION))
      let redirectPolls = 0
      const tryRedirect = () => {
        if (!window.google?.accounts?.oauth2) {
          if (++redirectPolls < 20) setTimeout(tryRedirect, 500)
          return
        }
        initLogin(() => {}, (err) => console.error('Scope upgrade failed:', err))
      }
      tryRedirect()
      return
    }

    // Implicit fallback (no worker): mint a broader access token in place
    let upgradePolls = 0
    const tryUpgrade = () => {
      if (!window.google?.accounts?.oauth2) {
        if (++upgradePolls < 20) setTimeout(tryUpgrade, 500)
        return
      }
      window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response: { access_token: string; error?: string }) => {
          if (response.error) return
          const updated = upgradeStoredToken(response.access_token)
          if (updated) setUser(updated)
        },
        error_callback: () => {},
      }).requestAccessToken({ prompt: '' })
    }

    tryUpgrade()
  }, [user])

  const login = useCallback(() => {
    initLogin(
      (u) => setUser(u),
      (err) => console.error('Auth error:', err)
    )
  }, [])

  const logout = useCallback(() => {
    if (user) { doLogout(user.accessToken).finally(() => setUser(null)) }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
