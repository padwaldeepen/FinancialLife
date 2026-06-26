import { useState, type JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Box, Flex, Heading, Text, Button, TextField } from '@radix-ui/themes'
import toast from 'react-hot-toast'
import { useBoundStore } from '../../../store/index.ts'
import styles from './Login.module.css'

export const Login = (): JSX.Element => {
  const login = useBoundStore((s) => s.login)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      toast.success('Logged in')
      navigate('/')
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
      <Box className={styles.card}>
        <Flex direction="column" gap="6">
          <Box className={styles.header}>
            <Flex justify="center" mb="3">
              <Box className={styles.logo}>F</Box>
            </Flex>
            <Heading size="6" align="center">
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
                  id="mob-email"
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
                <Text size="2" weight="medium">
                  Password
                </Text>
                <TextField.Root
                  color={errors.password ? 'red' : undefined}
                  id="mob-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrors((p) => ({ ...p, password: undefined }))
                  }}
                  autoComplete="current-password"
                  className={styles.input}
                />
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
      </Box>
    </Box>
  )
}
