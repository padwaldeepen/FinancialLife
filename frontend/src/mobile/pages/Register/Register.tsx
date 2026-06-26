import { useState, type JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Flex, Heading, Text, Button, TextField } from '@radix-ui/themes'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../../store/authStore.ts'
import styles from './Register.module.css'

interface RegisterForm {
  name?: string
  email: string
  password: string
  confirmPassword: string
}

export const Register = (): JSX.Element => {
  const register_ = useAuthStore((s) => s.register)
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>()

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true)
    try {
      await register_(data.email, data.password, data.name)
      toast.success('Account created successfully!')
      navigate('/')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <Flex direction="column" gap="6" asChild>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Flex direction="column" gap="1">
            <Heading size="6">Create an account</Heading>
            <Text size="2" color="gray">
              Start tracking your finances
            </Text>
          </Flex>

          <Flex direction="column" gap="4">
            <Flex direction="column" gap="1">
              <Text as="label" size="2" weight="medium" htmlFor="name">
                Name (optional)
              </Text>
              <TextField.Root>
                <input id="name" placeholder="Your name" {...register('name')} />
              </TextField.Root>
            </Flex>

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
                  placeholder="Create a password"
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

            <Flex direction="column" gap="1">
              <Text as="label" size="2" weight="medium" htmlFor="confirmPassword">
                Confirm password
              </Text>
              <TextField.Root>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value) => value === watch('password') || 'Passwords do not match',
                  })}
                />
              </TextField.Root>
              {errors.confirmPassword && (
                <Text size="1" color="red">
                  {errors.confirmPassword.message}
                </Text>
              )}
            </Flex>
          </Flex>

          <Button type="submit" loading={loading} size="3">
            Create account
          </Button>

          <Text size="2" align="center" color="gray">
            Already have an account?{' '}
            <Link to="/login" className={styles.link}>
              Sign in
            </Link>
          </Text>
        </form>
      </Flex>
    </div>
  )
}
