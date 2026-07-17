import { useEffect, type JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Box, Flex, Heading, Text, Button, Card, TextField, Select } from '@radix-ui/themes'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import type { Country } from '../../../auth/types.ts'
import type { RegisterFormErrors } from '../../../store/slices/registerFormSlice.ts'
import styles from './Register.module.css'

const COUNTRIES: { value: Country; label: string }[] = [
  { value: 'US', label: 'United States (USD)' },
  { value: 'IN', label: 'India (INR)' },
  { value: 'CA', label: 'Canada (CAD)' },
]

export const Register = (): JSX.Element => {
  const navigate = useNavigate()
  const {
    register,
    fullName,
    username,
    email,
    password,
    confirmPassword,
    country,
    showPassword,
    submitting,
    errors,
    setField,
    toggleShowPassword,
    setSubmitting,
    setErrors,
    clearFieldError,
    resetForm,
  } = useBoundStore(
    useShallow((s) => ({
      register: s.register,
      fullName: s.registerForm.fullName,
      username: s.registerForm.username,
      email: s.registerForm.email,
      password: s.registerForm.password,
      confirmPassword: s.registerForm.confirmPassword,
      country: s.registerForm.country,
      showPassword: s.registerForm.showPassword,
      submitting: s.registerForm.submitting,
      errors: s.registerForm.errors,
      setField: s.setRegisterField,
      toggleShowPassword: s.toggleRegisterShowPassword,
      setSubmitting: s.setRegisterSubmitting,
      setErrors: s.setRegisterErrors,
      clearFieldError: s.clearRegisterFieldError,
      resetForm: s.resetRegisterForm,
    })),
  )

  // A form left half-filled on a previous visit must never leak into a fresh one.
  useEffect(() => {
    resetForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const validate = () => {
    const e: RegisterFormErrors = {}
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
    setSubmitting(true)
    try {
      await register(email, password, country, fullName, username)
      resetForm()
      navigate('/')
    } catch (error: any) {
      const detail = error.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => e.msg).join('; ')
        : detail || 'Registration failed'
      toast.error(msg)
    } finally {
      setSubmitting(false)
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
                  id="fullName"
                  type="text"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => {
                    setField('fullName', e.target.value)
                    clearFieldError('fullName')
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
                  id="regUsername"
                  type="text"
                  placeholder="janedoe"
                  value={username}
                  onChange={(e) => {
                    setField('username', e.target.value)
                    clearFieldError('username')
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
                  id="regEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setField('email', e.target.value)
                    clearFieldError('email')
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
                  id="regPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => {
                    setField('password', e.target.value)
                    clearFieldError('password')
                  }}
                  autoComplete="new-password"
                  className={styles.input}
                >
                  <TextField.Slot side="right">
                    <Button
                      variant="ghost"
                      size="1"
                      type="button"
                      onClick={toggleShowPassword}
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
                  id="regConfirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setField('confirmPassword', e.target.value)
                    clearFieldError('confirmPassword')
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

              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Country
                </Text>
                <Select.Root
                  value={country}
                  onValueChange={(v) => setField('country', v as Country)}
                >
                  <Select.Trigger className={styles.input} />
                  <Select.Content>
                    {COUNTRIES.map((c) => (
                      <Select.Item key={c.value} value={c.value}>
                        {c.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
                <Text size="1" color="gray">
                  Sets your currency — you can add another country later in Manage
                </Text>
              </Flex>

              <Button type="submit" size="3" loading={submitting} mt="2">
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
      </Card>
    </Box>
  )
}
