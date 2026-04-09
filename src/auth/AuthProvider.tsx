import { createContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { AuthUser } from '../types'
import { getStoredUser, initLogin, refreshToken as doRefresh, logout as doLogout, isTokenExpiringSoon } from './googleAuth'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: () => void
  logout: () => void
  refreshToken: () => Promise<AuthUser | null>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null, isLoading: true, login: () => {}, logout: () => {},
  refreshToken: () => Promise.resolve(null),
})

const CHECK_INTERVAL_MS = 5 * 60 * 1000 // check every 5 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshing = useRef(false)

  useEffect(() => {
    const stored = getStoredUser()
    if (stored) {
      setUser(stored)
      // If token is already expiring, refresh immediately on load
      if (isTokenExpiringSoon()) {
        doRefresh().then((refreshed) => {
          if (refreshed) setUser(refreshed)
        })
      }
    }
    setIsLoading(false)
  }, [])

  // Proactive refresh timer — checks every 5 minutes if token is nearing expiry
  useEffect(() => {
    if (!user) return
    const interval = setInterval(async () => {
      if (refreshing.current) return
      if (isTokenExpiringSoon()) {
        refreshing.current = true
        const refreshed = await doRefresh()
        if (refreshed) setUser(refreshed)
        refreshing.current = false
      }
    }, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user])

  const login = useCallback(() => {
    initLogin((u) => setUser(u), (err) => console.error('Auth error:', err))
  }, [])

  const logout = useCallback(() => {
    if (user) { doLogout(user.accessToken).then(() => setUser(null)) }
  }, [user])

  const refreshToken = useCallback(async () => {
    const refreshed = await doRefresh()
    if (refreshed) {
      setUser(refreshed)
    }
    return refreshed
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  )
}
