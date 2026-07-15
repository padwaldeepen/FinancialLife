import { useState, type JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Box, Flex, Heading, Text, Button, TextField } from '@radix-ui/themes'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Register.module.css'

export const Register = (): JSX.Element => {
  const register = useBoundStore((s) => s.register)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{
    fullName?: string
    username?: string
    email?: string
    password?: string
    confirmPassword?: string
  }>({})

  const validate = () => {
    const e: typeof errors = {}
    if (!fullName) e.fullName = 'Full name is required'
    else if (fullName.trim().length < 2) e.fullName = 'Minimum 2 characters'
    if (!username) e.username = 'Username is required'
    else if (username.trim().length < 3) e.username = 'Minimum 3 characters'
    else if (!/^[a-zA-Z0-9_]+$/.test(username))
      e.username = 'Letters, numbers, and underscores only'
    if (!email) e.email = 'Email is required'
    else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) e.email = 'Invalid email'
    if (!password) e.password = 'Password is required'
    else if (password.length < 8) e.password = 'Minimum 8 characters'
    else if (!/[A-Z]/.test(password)) e.password = 'Include at least one uppercase letter'
    else if (!/[0-9]/.test(password)) e.password = 'Include at least one number'
    if (!confirmPassword) e.confirmPassword = 'Please confirm your password'
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await register(email, password, fullName, username)
      navigate('/')
    } catch (error: any) {
      const detail = error.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => e.msg).join('; ')
        : detail || 'Registration failed'
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
              Create account
            </Heading>
            <Text size="2" color="gray" align="center" mt="1">
              Start managing your finances
            </Text>
          </Box>

          <form onSubmit={onSubmit}>
            <Flex direction="column" gap="4">
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Full name
                </Text>
                <TextField.Root
                  color={errors.fullName ? 'red' : undefined}
                  id="mob-fullName"
                  type="text"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    setErrors((p) => ({ ...p, fullName: undefined }))
                  }}
                  autoComplete="name"
                  className={styles.input}
                />
                {errors.fullName && (
                  <Text size="1" color="red">
                    {errors.fullName}
                  </Text>
                )}
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Username
                </Text>
                <TextField.Root
                  color={errors.username ? 'red' : undefined}
                  id="mob-username"
                  type="text"
                  placeholder="janedoe"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setErrors((p) => ({ ...p, username: undefined }))
                  }}
                  autoComplete="username"
                  className={styles.input}
                />
                {errors.username && (
                  <Text size="1" color="red">
                    {errors.username}
                  </Text>
                )}
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Email
                </Text>
                <TextField.Root
                  color={errors.email ? 'red' : undefined}
                  id="mob-reEmail"
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
                  id="mob-rePassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrors((p) => ({ ...p, password: undefined }))
                  }}
                  autoComplete="new-password"
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

              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Confirm password
                </Text>
                <TextField.Root
                  color={errors.confirmPassword ? 'red' : undefined}
                  id="mob-reConfirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setErrors((p) => ({ ...p, confirmPassword: undefined }))
                  }}
                  autoComplete="new-password"
                  className={styles.input}
                />
                {errors.confirmPassword && (
                  <Text size="1" color="red">
                    {errors.confirmPassword}
                  </Text>
                )}
              </Flex>

              <Button type="submit" size="3" loading={loading} mt="2">
                Create account
              </Button>
            </Flex>
          </form>

          <Text size="2" color="gray" align="center">
            Already have an account?{' '}
            <Link to="/login" className={styles.footerLink}>
              Sign in
            </Link>
          </Text>
        </Flex>
      </Box>
    </Box>
  )
}
