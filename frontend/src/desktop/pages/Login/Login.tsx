import { useState, type JSX } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Box, Flex, Heading, Text, Button, Card, TextField } from '@radix-ui/themes'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Login.module.css'

export const Login = (): JSX.Element => {
  const login = useBoundStore((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from || '/'
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const validate = () => {
    const e: typeof errors = {}
    if (!email) e.email = 'Email is required'
    else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) e.email = 'Invalid email'
    if (!password) e.password = 'Password is required'
    else if (password.length < 6) e.password = 'Minimum 6 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await login(email, password)
      navigate(from)
    } catch (error: any) {
      const detail = error.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => e.msg).join('; ')
        : detail || 'Login failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box className={styles.page}>
      <Card size="3" className={styles.card}>
        <Flex direction="column" gap="6">
          <Box className={styles.header}>
            <Flex justify="center" mb="4">
              <Box className={styles.logo}>F</Box>
            </Flex>
            <Heading size="7" align="center">
              Welcome back
            </Heading>
            <Text size="2" color="gray" align="center" mt="1">
              Sign in to your account
            </Text>
          </Box>

          <form onSubmit={onSubmit}>
            <Flex direction="column" gap="4">
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Email
                </Text>
                <TextField.Root
                  color={errors.email ? 'red' : undefined}
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setErrors((p) => ({ ...p, email: undefined }))
                  }}
                  autoComplete="email"
                  className={styles.input}
                />
                {errors.email && (
                  <Text size="1" color="red">
                    {errors.email}
                  </Text>
                )}
              </Flex>

              <Flex direction="column" gap="1">
                <Flex justify="between" align="center">
                  <Text size="2" weight="medium">
                    Password
                  </Text>
                  <Link to="/forgot-password" className={styles.forgotLink}>
                    Forgot?
                  </Link>
                </Flex>
                <TextField.Root
                  color={errors.password ? 'red' : undefined}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrors((p) => ({ ...p, password: undefined }))
                  }}
                  autoComplete="current-password"
                  className={styles.input}
                >
                  <TextField.Slot side="right">
                    <Button
                      variant="ghost"
                      size="1"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </TextField.Slot>
                </TextField.Root>
                {errors.password && (
                  <Text size="1" color="red">
                    {errors.password}
                  </Text>
                )}
              </Flex>

              <Button type="submit" size="3" loading={loading} mt="2">
                Sign in
              </Button>
            </Flex>
          </form>

          <Text size="2" color="gray" align="center">
            Don&apos;t have an account?{' '}
            <Link to="/register" className={styles.footerLink}>
              Sign up
            </Link>
          </Text>
        </Flex>
      </Card>
    </Box>
  )
}
