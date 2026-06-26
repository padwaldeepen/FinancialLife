import { useState, type JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Card, Flex, Heading, Text, Button, TextField } from '@radix-ui/themes'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../../store/authStore.ts'
import styles from './Login.module.css'

interface LoginForm {
  email: string
  password: string
}

export const Login = (): JSX.Element => {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      await login(data.email, data.password)
      toast.success('Logged in successfully!')
      navigate('/')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <Card size="3" className={styles.card}>
        <Flex direction="column" gap="4" asChild>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Flex direction="column" gap="1">
              <Heading size="6">Welcome back</Heading>
              <Text size="2" color="gray">
                Sign in to your account to continue
              </Text>
            </Flex>

            <Flex direction="column" gap="3">
              <Flex direction="column" gap="1">
                <Text as="label" size="2" weight="medium" htmlFor="email">
                  Email
                </Text>
                <TextField.Root>
                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                  />
                </TextField.Root>
                {errors.email && (
                  <Text size="1" color="red">
                    {errors.email.message}
                  </Text>
                )}
              </Flex>

              <Flex direction="column" gap="1">
                <Text as="label" size="2" weight="medium" htmlFor="password">
                  Password
                </Text>
                <TextField.Root>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 6,
                        message: 'Password must be at least 6 characters',
                      },
                    })}
                  />
                  <TextField.Slot>
                    <button
                      type="button"
                      className={styles.togglePassword}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </TextField.Slot>
                </TextField.Root>
                {errors.password && (
                  <Text size="1" color="red">
                    {errors.password.message}
                  </Text>
                )}
              </Flex>
            </Flex>

            <Button type="submit" loading={loading} size="3">
              Sign in
            </Button>

            <Text size="2" align="center" color="gray">
              Don&apos;t have an account?{' '}
              <Link to="/register" className={styles.link}>
                Sign up
              </Link>
            </Text>
          </form>
        </Flex>
      </Card>
    </div>
  )
}
