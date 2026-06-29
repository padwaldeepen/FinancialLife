import { useState, useEffect, type JSX } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  Card,
  Dialog,
  TextField,
  Select,
  IconButton,
} from '@radix-ui/themes'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../auth/api.ts'
import styles from './Budgets.module.css'

interface Budget {
  id: number
  name: string
  amount: number
  period: string
  category_id: number | null
  category_name: string | null
  category_color: string | null
  spent: number
  is_active: boolean
}

export const Budgets = (): JSX.Element => {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [period, setPeriod] = useState('monthly')
  const [saving, setSaving] = useState(false)

  const fetchBudgets = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/budgets/')
      setBudgets(response.data)
    } catch {
      toast.error('Failed to load budgets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBudgets()
  }, [])

  const handleCreate = async () => {
    if (!name.trim() || !budgetAmount) return
    setSaving(true)
    try {
      await api.post('/api/budgets/', {
        name: name.trim(),
        amount: parseFloat(budgetAmount),
        period,
      })
      toast.success('Budget created')
      setOpen(false)
      setName('')
      setBudgetAmount('')
      setPeriod('monthly')
      fetchBudgets()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create budget')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/budgets/${id}`)
      setBudgets((prev) => prev.filter((b) => b.id !== id))
      toast.success('Budget deleted')
    } catch {
      toast.error('Failed to delete budget')
    }
  }

  const progress = (budget: Budget) => {
    if (budget.amount === 0) return 0
    return Math.min((budget.spent / budget.amount) * 100, 100)
  }

  const periodLabel = (p: string) => {
    switch (p) {
      case 'weekly':
        return 'this week'
      case 'yearly':
        return 'this year'
      default:
        return 'this month'
    }
  }

  return (
    <Box className={styles.page}>
      <Flex align="center" justify="between" mb="5">
        <Heading size="6">Budgets</Heading>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger>
            <Button size="2">
              <Plus size={16} /> Add Budget
            </Button>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="400px">
            <Dialog.Title>Create Budget</Dialog.Title>
            <Flex direction="column" gap="3" mt="3">
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Name
                </Text>
                <TextField.Root
                  placeholder="e.g. Groceries"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Flex>
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Amount
                </Text>
                <TextField.Root
                  type="number"
                  placeholder="500"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                >
                  <TextField.Slot side="left">$</TextField.Slot>
                </TextField.Root>
              </Flex>
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Period
                </Text>
                <Select.Root value={period} onValueChange={setPeriod}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="weekly">Weekly</Select.Item>
                    <Select.Item value="monthly">Monthly</Select.Item>
                    <Select.Item value="yearly">Yearly</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Flex>
              <Button onClick={handleCreate} loading={saving} size="3" mt="2">
                Create Budget
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>

      {loading ? (
        <Text color="gray">Loading...</Text>
      ) : budgets.length === 0 ? (
        <Flex direction="column" align="center" gap="2" py="8">
          <Text size="4" weight="medium">
            No budgets yet
          </Text>
          <Text size="2" color="gray">
            Create your first budget to start tracking
          </Text>
        </Flex>
      ) : (
        <Flex direction="column" gap="3">
          {budgets.map((budget) => {
            const pct = progress(budget)
            const overBudget = pct >= 100
            return (
              <Card key={budget.id} size="2">
                <Flex direction="column" gap="2">
                  <Flex align="center" justify="between">
                    <Flex align="center" gap="2">
                      <Heading size="3">{budget.name}</Heading>
                      {budget.category_name && (
                        <Text size="1" color="gray">
                          ({budget.category_name})
                        </Text>
                      )}
                    </Flex>
                    <IconButton
                      variant="ghost"
                      size="1"
                      color="red"
                      onClick={() => handleDelete(budget.id)}
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Flex>

                  <Flex align="center" justify="between">
                    <Text size="2" color="gray">
                      {periodLabel(budget.period)}
                    </Text>
                    <Text size="2" weight="medium" color={overBudget ? 'red' : undefined}>
                      ${budget.spent.toFixed(2)} / ${budget.amount.toFixed(2)}
                    </Text>
                  </Flex>

                  <Box className={styles.barOuter}>
                    <Box
                      className={styles.barInner}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: overBudget ? 'var(--red-9)' : 'var(--accent-9)',
                      }}
                    />
                  </Box>

                  {overBudget && (
                    <Text size="1" color="red">
                      Over budget!
                    </Text>
                  )}
                </Flex>
              </Card>
            )
          })}
        </Flex>
      )}
    </Box>
  )
}
