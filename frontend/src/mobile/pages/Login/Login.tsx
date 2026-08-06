import { useEffect, type JSX } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Box, Flex, Heading, Text, Button, TextField, Callout } from '@radix-ui/themes'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { getValidationErrorMessage } from '../../../store/namespaceSlice.ts'
import styles from './Login.module.css'

export const Login = (): JSX.Element => {
  const login = useBoundStore((s) => s.auth.login)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from || '/'
  const {
    email,
    password,
    showPassword,
    submitting,
    errors,
    formError,
    setField,
    toggleShowPassword,
    setSubmitting,
    clearFieldError,
    setFormError,
    validateForm,
    resetForm,
  } = useBoundStore(
    useShallow((s) => ({
      email: s.loginForm.email,
      password: s.loginForm.password,
      showPassword: s.loginForm.showPassword,
      submitting: s.loginForm.submitting,
      errors: s.loginForm.errors,
      formError: s.loginForm.formError,
      setField: s.loginForm.setLoginField,
      toggleShowPassword: s.loginForm.toggleLoginShowPassword,
      setSubmitting: s.loginForm.setLoginSubmitting,
      clearFieldError: s.loginForm.clearLoginFieldError,
      setFormError: s.loginForm.setLoginFormError,
      validateForm: s.loginForm.validateLoginForm,
      resetForm: s.loginForm.resetLoginForm,
    })),
  )

  // A form left half-filled on a previous visit must never leak into a fresh one.
  useEffect(() => {
    resetForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from)
    } catch (error) {
      setFormError(getValidationErrorMessage(error, 'Login failed'))
    } finally {
      setSubmitting(false)
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
              {formError && (
                <Callout.Root color="red" size="1">
                  <Callout.Icon>
                    <AlertCircle size={14} />
                  </Callout.Icon>
                  <Callout.Text>{formError}</Callout.Text>
                </Callout.Root>
              )}

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
                  id="mob-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setField('password', e.target.value)
                    clearFieldError('password')
                  }}
                  autoComplete="current-password"
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

              <Button type="submit" size="3" loading={submitting} mt="2">
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
