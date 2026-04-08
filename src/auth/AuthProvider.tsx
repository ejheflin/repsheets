import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { AuthUser } from '../types'
import { getStoredUser, initLogin, refreshToken as doRefresh, logout as doLogout } from './googleAuth'

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredUser()
    if (stored) {
      setUser(stored)
    }
    setIsLoading(false)
  }, [])

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
