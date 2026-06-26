import type { ReactNode } from 'react'
import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api'

interface User {
  id: number
  email: string
  username: string
  full_name?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string, fullName?: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      // Verify token and get user info
      verifyToken()
    } else {
      setLoading(false)
    }
  }, [token])

  const verifyToken = async () => {
    try {
      const response = await api.get('/api/auth/me')
      setUser(response.data)
    } catch (error) {
      console.error('Token verification failed:', error)
      logout()
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/api/auth/login', {
        email,
        password,
      })

      const { access_token, user_id, email: userEmail } = response.data

      setToken(access_token)
      // Get user info from the token response
      const userData = {
        id: user_id,
        email: userEmail,
        username: '', // Will be fetched from /me endpoint
        full_name: '',
      }
      setUser(userData)
      localStorage.setItem('token', access_token)

      // Fetch complete user info
      const userResponse = await api.get('/api/auth/me')
      setUser(userResponse.data)
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const register = async (email: string, username: string, password: string, fullName?: string) => {
    try {
      const response = await api.post('/api/auth/register', {
        email,
        username,
        password,
        full_name: fullName,
      })

      const { access_token, user_id, email: userEmail } = response.data

      setToken(access_token)
      // Get user info from the token response
      const userData = {
        id: user_id,
        email: userEmail,
        username: username,
        full_name: fullName || '',
      }
      setUser(userData)
      localStorage.setItem('token', access_token)
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
  }

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
