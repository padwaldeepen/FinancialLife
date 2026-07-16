import { useState, useEffect, type JSX } from 'react'
import {
  Box,
  Flex,
  Text,
  Button,
  Card,
  Dialog,
  TextField,
  Select,
  IconButton,
  Badge,
} from '@radix-ui/themes'
import { Plus, Trash2, Target, PiggyBank, TrendingDown, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import styles from './Goals.module.css'

const goalIcons: Record<string, JSX.Element> = {
  save_up: <PiggyBank size={18} />,
  pay_down: <TrendingDown size={18} />,
  monthly_envelope: <Target size={18} />,
}

const goalLabels: Record<string, string> = {
  save_up: 'Save Up',
  pay_down: 'Pay Down',
  monthly_envelope: 'Monthly Envelope',
}

export const Goals = (): JSX.Element => {
  const { goals, loading, fetchGoals, createGoal, updateGoal, contributeToGoal, deleteGoal } =
    useBoundStore(
      useShallow((s) => ({
        goals: s.goals.items,
        loading: s.goals.loading,
        fetchGoals: s.fetchGoals,
        createGoal: s.createGoal,
        updateGoal: s.updateGoal,
        contributeToGoal: s.contributeToGoal,
        deleteGoal: s.deleteGoal,
      })),
    )
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [goalAmount, setGoalAmount] = useState('')
  const [goalType, setGoalType] = useState('save_up')
  const [initialAmount, setInitialAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const [detailGoal, setDetailGoal] = useState<(typeof goals)[0] | null>(null)
  const [contributeOpen, setContributeOpen] = useState(false)
  const [contributeAmount, setContributeAmount] = useState('')
  const [contributing, setContributing] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editTarget, setEditTarget] = useState('')
  const [editCurrent, setEditCurrent] = useState('')
  const [editMonthly, setEditMonthly] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editType, setEditType] = useState('save_up')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  const handleCreate = async () => {
    if (!name.trim() || !goalAmount) return
    setSaving(true)
    try {
      await createGoal({
        name: name.trim(),
        target_amount: parseFloat(goalAmount),
        type: goalType,
        current_amount: parseFloat(initialAmount) || 0,
      })
      toast.success('Goal created')
      setOpen(false)
      setName('')
      setGoalAmount('')
      setGoalType('save_up')
      setInitialAmount('')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create goal')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteGoal(id)
      toast.success('Goal deleted')
    } catch {
      toast.error('Failed to delete goal')
    }
  }

  const handleContribute = async () => {
    if (!detailGoal || !contributeAmount) return
    setContributing(true)
    try {
      await contributeToGoal(detailGoal.id, parseFloat(contributeAmount))
      toast.success('Contribution added')
      setContributeOpen(false)
      setContributeAmount('')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to contribute')
    } finally {
      setContributing(false)
    }
  }

  const openEdit = () => {
    if (!detailGoal) return
    setEditName(detailGoal.name)
    setEditTarget(String(detailGoal.target_amount))
    setEditCurrent(String(detailGoal.current_amount))
    setEditMonthly(detailGoal.monthly_contribution ? String(detailGoal.monthly_contribution) : '')
    setEditDeadline(detailGoal.deadline || '')
    setEditType(detailGoal.type)
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    if (!detailGoal || !editName.trim() || !editTarget) return
    setSavingEdit(true)
    try {
      await updateGoal(detailGoal.id, {
        name: editName.trim(),
        target_amount: parseFloat(editTarget),
        current_amount: parseFloat(editCurrent) || 0,
        monthly_contribution: editMonthly ? parseFloat(editMonthly) : null,
        type: editType,
        deadline: editDeadline || null,
      })
      toast.success('Goal updated')
      setEditOpen(false)
      setDetailGoal(null)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update goal')
    } finally {
      setSavingEdit(false)
    }
  }

  const completed = (g: (typeof goals)[0]) => g.progress_pct >= 100

  return (
    <Box className={styles.page}>
      <Flex className={styles.pageHeader}>
        <span className={styles.pageTitle}>Goals</span>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger>
            <Button size="2">
              <Plus size={16} /> Add Goal
            </Button>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="400px">
            <Dialog.Title>Create Goal</Dialog.Title>
            <Flex direction="column" gap="3" mt="3">
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Name
                </Text>
                <TextField.Root
                  placeholder="e.g. Emergency Fund"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Flex>
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Goal Type
                </Text>
                <Select.Root value={goalType} onValueChange={setGoalType}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="save_up">Save Up</Select.Item>
                    <Select.Item value="pay_down">Pay Down</Select.Item>
                    <Select.Item value="monthly_envelope">Monthly Envelope</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Flex>
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Target Amount
                </Text>
                <TextField.Root
                  type="number"
                  placeholder="10000"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                >
                  <TextField.Slot side="left">$</TextField.Slot>
                </TextField.Root>
              </Flex>
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Initial Amount (optional)
                </Text>
                <TextField.Root
                  type="number"
                  placeholder="0"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                >
                  <TextField.Slot side="left">$</TextField.Slot>
                </TextField.Root>
              </Flex>
              <Button onClick={handleCreate} loading={saving} size="3" mt="2">
                Create Goal
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>

      {loading ? (
        <Text color="gray">Loading...</Text>
      ) : goals.length === 0 ? (
        <Flex className={styles.emptyState} direction="column">
          <span className={styles.emptyTitle}>No goals yet</span>
          <span className={styles.emptyHint}>Create your first goal to start tracking</span>
        </Flex>
      ) : (
        <Flex direction="column" gap="3">
          {goals.map((goal) => {
            const done = completed(goal)
            return (
              <Card
                key={goal.id}
                size="2"
                className={styles.card}
                onClick={() => setDetailGoal(goal)}
              >
                <Flex direction="column" gap="2">
                  <Flex align="center" justify="between">
                    <Flex align="center" gap="2">
                      {goalIcons[goal.type] || <Target size={18} />}
                      <Text size="3" weight="bold">
                        {goal.name}
                      </Text>
                      <Badge color={done ? 'green' : 'gray'} size="1">
                        {goalLabels[goal.type] || goal.type}
                      </Badge>
                    </Flex>
                    <IconButton
                      variant="ghost"
                      size="1"
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(goal.id)
                      }}
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Flex>

                  <Flex align="center" justify="between">
                    <Text size="2" color="gray">
                      {goal.progress_pct}% complete
                    </Text>
                    <Text size="2" weight="medium" color={done ? 'green' : undefined}>
                      {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                    </Text>
                  </Flex>

                  <Box className={styles.barOuter}>
                    <Box
                      className={styles.barInner}
                      style={
                        {
                          '--bar-width': `${Math.min(goal.progress_pct, 100)}%`,
                          '--bar-color': done
                            ? 'var(--green-9)'
                            : goal.color
                              ? goal.color
                              : 'var(--accent-9)',
                        } as React.CSSProperties
                      }
                    />
                  </Box>

                  {done && (
                    <Text size="1" color="green" weight="medium">
                      Goal achieved!
                    </Text>
                  )}
                </Flex>
                {/* Detail Dialog */}
                <Dialog.Root
                  open={detailGoal?.id === goal.id}
                  onOpenChange={(open) => {
                    if (!open) setDetailGoal(null)
                  }}
                >
                  <Dialog.Content maxWidth="420px">
                    {detailGoal && (
                      <>
                        <Flex align="center" gap="2" mb="3">
                          {goalIcons[detailGoal.type]}
                          <Dialog.Title mb="0">{detailGoal.name}</Dialog.Title>
                          <Badge color={done ? 'green' : 'gray'} size="1">
                            {goalLabels[detailGoal.type]}
                          </Badge>
                        </Flex>

                        <Flex direction="column" gap="2" mb="4">
                          <Flex align="center" justify="between">
                            <Text size="2" color="gray">
                              Progress
                            </Text>
                            <Text size="2" weight="medium">
                              {formatCurrency(detailGoal.current_amount)} /{' '}
                              {formatCurrency(detailGoal.target_amount)}
                            </Text>
                          </Flex>
                          <Box className={styles.barOuter}>
                            <Box
                              className={styles.barInner}
                              style={
                                {
                                  '--bar-width': `${Math.min(detailGoal.progress_pct, 100)}%`,
                                  '--bar-color': done ? 'var(--green-9)' : 'var(--accent-9)',
                                } as React.CSSProperties
                              }
                            />
                          </Box>
                          <Text size="1" color="gray">
                            {detailGoal.progress_pct}% complete
                          </Text>
                        </Flex>

                        <Flex direction="column" gap="1" mb="4">
                          {detailGoal.monthly_contribution && (
                            <Flex justify="between">
                              <Text size="2" color="gray">
                                Monthly contribution
                              </Text>
                              <Text size="2">
                                {formatCurrency(detailGoal.monthly_contribution)}
                              </Text>
                            </Flex>
                          )}
                          {detailGoal.deadline && (
                            <Flex justify="between">
                              <Text size="2" color="gray">
                                Deadline
                              </Text>
                              <Text size="2">{detailGoal.deadline}</Text>
                            </Flex>
                          )}
                          {detailGoal.category_name && (
                            <Flex justify="between">
                              <Text size="2" color="gray">
                                Category
                              </Text>
                              <Text size="2">{detailGoal.category_name}</Text>
                            </Flex>
                          )}
                        </Flex>

                        <Flex gap="2" mt="3">
                          <Button size="2" variant="soft" style={{ flex: 1 }} onClick={openEdit}>
                            <Pencil size={14} /> Edit
                          </Button>
                          <Button
                            size="2"
                            style={{ flex: 1 }}
                            onClick={() => setContributeOpen(true)}
                          >
                            <Plus size={14} /> Add Contribution
                          </Button>
                        </Flex>

                        {/* Contribute Dialog */}
                        <Dialog.Root open={contributeOpen} onOpenChange={setContributeOpen}>
                          <Dialog.Content maxWidth="360px">
                            <Dialog.Title>Add Contribution</Dialog.Title>
                            <Flex direction="column" gap="3" mt="3">
                              <Flex direction="column" gap="1">
                                <Text size="2" weight="medium">
                                  Amount
                                </Text>
                                <TextField.Root
                                  type="number"
                                  placeholder="100"
                                  value={contributeAmount}
                                  onChange={(e) => setContributeAmount(e.target.value)}
                                >
                                  <TextField.Slot side="left">$</TextField.Slot>
                                </TextField.Root>
                              </Flex>
                              <Button
                                onClick={handleContribute}
                                loading={contributing}
                                size="3"
                                mt="2"
                              >
                                Add
                              </Button>
                            </Flex>
                          </Dialog.Content>
                        </Dialog.Root>

                        {/* Edit Goal Dialog */}
                        <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
                          <Dialog.Content maxWidth="400px">
                            <Dialog.Title>Edit Goal</Dialog.Title>
                            <Flex direction="column" gap="3" mt="3">
                              <Flex direction="column" gap="1">
                                <Text size="2" weight="medium">
                                  Name
                                </Text>
                                <TextField.Root
                                  placeholder="Goal name"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                />
                              </Flex>
                              <Flex direction="column" gap="1">
                                <Text size="2" weight="medium">
                                  Type
                                </Text>
                                <Select.Root value={editType} onValueChange={setEditType}>
                                  <Select.Trigger />
                                  <Select.Content>
                                    <Select.Item value="save_up">Save Up</Select.Item>
                                    <Select.Item value="pay_down">Pay Down</Select.Item>
                                    <Select.Item value="monthly_envelope">
                                      Monthly Envelope
                                    </Select.Item>
                                  </Select.Content>
                                </Select.Root>
                              </Flex>
                              <Flex direction="column" gap="1">
                                <Text size="2" weight="medium">
                                  Target Amount
                                </Text>
                                <TextField.Root
                                  type="number"
                                  placeholder="10000"
                                  value={editTarget}
                                  onChange={(e) => setEditTarget(e.target.value)}
                                >
                                  <TextField.Slot side="left">$</TextField.Slot>
                                </TextField.Root>
                              </Flex>
                              <Flex direction="column" gap="1">
                                <Text size="2" weight="medium">
                                  Current Amount
                                </Text>
                                <TextField.Root
                                  type="number"
                                  placeholder="0"
                                  value={editCurrent}
                                  onChange={(e) => setEditCurrent(e.target.value)}
                                >
                                  <TextField.Slot side="left">$</TextField.Slot>
                                </TextField.Root>
                              </Flex>
                              <Flex direction="column" gap="1">
                                <Text size="2" weight="medium">
                                  Monthly Contribution (optional)
                                </Text>
                                <TextField.Root
                                  type="number"
                                  placeholder="100"
                                  value={editMonthly}
                                  onChange={(e) => setEditMonthly(e.target.value)}
                                >
                                  <TextField.Slot side="left">$</TextField.Slot>
                                </TextField.Root>
                              </Flex>
                              <Flex direction="column" gap="1">
                                <Text size="2" weight="medium">
                                  Deadline (optional)
                                </Text>
                                <TextField.Root
                                  type="date"
                                  value={editDeadline}
                                  onChange={(e) => setEditDeadline(e.target.value)}
                                />
                              </Flex>
                              <Flex gap="3" mt="2" justify="end">
                                <Button
                                  variant="soft"
                                  color="gray"
                                  onClick={() => setEditOpen(false)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleUpdate}
                                  loading={savingEdit}
                                  disabled={!editName.trim() || !editTarget}
                                >
                                  Save Changes
                                </Button>
                              </Flex>
                            </Flex>
                          </Dialog.Content>
                        </Dialog.Root>
                      </>
                    )}
                  </Dialog.Content>
                </Dialog.Root>
              </Card>
            )
          })}
        </Flex>
      )}
    </Box>
  )
}
