import { useState, type JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Box, Flex, Heading, Text, Button, TextField } from '@radix-ui/themes'
import toast from 'react-hot-toast'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Register.module.css'

export const Register = (): JSX.Element => {
  const register = useBoundStore((s) => s.register)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; fullName?: string; password?: string }>({})

  const validate = () => {
    const e: typeof errors = {}
    if (!email) e.email = 'Email is required'
    else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) e.email = 'Invalid email'
    if (!fullName) e.fullName = 'Full name is required'
    else if (fullName.length < 2) e.fullName = 'Minimum 2 characters'
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
      await register(email, password, fullName)
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
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrors((p) => ({ ...p, password: undefined }))
                  }}
                  autoComplete="new-password"
                  className={styles.input}
                />
                {errors.password && (
                  <Text size="1" color="red">
                    {errors.password}
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
