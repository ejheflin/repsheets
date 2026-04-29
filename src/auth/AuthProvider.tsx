import { createContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { AuthUser } from '../types'
import { getStoredUser, initLogin, logout as doLogout, upgradeStoredToken, handleRedirectCode } from './googleAuth'
import { GOOGLE_CLIENT_ID, SCOPES, SCOPE_VERSION } from '../config'

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

  // Silently request a fresh token when the stored one predates a scope change
  useEffect(() => {
    if (!user || (user.scopeVersion ?? 0) >= SCOPE_VERSION || upgradeAttempted.current) return
    upgradeAttempted.current = true

    const tryUpgrade = () => {
      if (!window.google?.accounts?.oauth2) { setTimeout(tryUpgrade, 500); return }
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
    if (user) { doLogout(user.accessToken).then(() => setUser(null)) }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
