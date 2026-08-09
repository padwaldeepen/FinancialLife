import { useEffect, type JSX } from 'react'
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
  Skeleton,
  VisuallyHidden,
} from '@radix-ui/themes'
import { Plus, Trash2, Target, PiggyBank, TrendingDown, Pencil } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import styles from './Goals.module.css'
import shared from '../../styles/shared.module.css'
import { PageHeader } from '../../components/PageHeader/PageHeader.tsx'

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
  const currency = useActiveCurrency()
  const { goals, loading, fetchGoals, createGoal, updateGoal, contributeToGoal, deleteGoal } =
    useBoundStore(
      useShallow((s) => ({
        goals: s.goals.items,
        loading: s.goals.loading,
        fetchGoals: s.goals.fetchGoals,
        createGoal: s.goals.createGoal,
        updateGoal: s.goals.updateGoal,
        contributeToGoal: s.goals.contributeToGoal,
        deleteGoal: s.goals.deleteGoal,
      })),
    )
  const { create, detailGoalId, contribute, edit } = useBoundStore(useShallow((s) => s.goalsForm))
  const {
    setGoalCreateOpen,
    setGoalCreateField,
    setGoalCreateSaving,
    resetGoalCreateForm,
    openGoalDetail,
    closeGoalDetail,
    setGoalContributeOpen,
    setGoalContributeAmount,
    setGoalContributing,
    openGoalEdit,
    setGoalEditOpen,
    setGoalEditField,
    setGoalEditSaving,
  } = useBoundStore(
    useShallow((s) => ({
      setGoalCreateOpen: s.goalsForm.setGoalCreateOpen,
      setGoalCreateField: s.goalsForm.setGoalCreateField,
      setGoalCreateSaving: s.goalsForm.setGoalCreateSaving,
      resetGoalCreateForm: s.goalsForm.resetGoalCreateForm,
      openGoalDetail: s.goalsForm.openGoalDetail,
      closeGoalDetail: s.goalsForm.closeGoalDetail,
      setGoalContributeOpen: s.goalsForm.setGoalContributeOpen,
      setGoalContributeAmount: s.goalsForm.setGoalContributeAmount,
      setGoalContributing: s.goalsForm.setGoalContributing,
      openGoalEdit: s.goalsForm.openGoalEdit,
      setGoalEditOpen: s.goalsForm.setGoalEditOpen,
      setGoalEditField: s.goalsForm.setGoalEditField,
      setGoalEditSaving: s.goalsForm.setGoalEditSaving,
    })),
  )

  const detailGoal = goals.find((g) => g.id === detailGoalId) ?? null

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  const handleCreate = async () => {
    if (!create.name.trim() || !create.goalAmount) return
    setGoalCreateSaving(true)
    try {
      await createGoal({
        name: create.name.trim(),
        target_amount: parseFloat(create.goalAmount),
        type: create.goalType,
        current_amount: parseFloat(create.initialAmount) || 0,
      })
      setGoalCreateOpen(false)
      resetGoalCreateForm()
    } catch {
      // toast handled in store
    } finally {
      setGoalCreateSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteGoal(id)
    } catch {
      // toast handled in store
    }
  }

  const handleContribute = async () => {
    if (!detailGoal || !contribute.amount) return
    setGoalContributing(true)
    try {
      await contributeToGoal(detailGoal.id, parseFloat(contribute.amount))
      setGoalContributeOpen(false)
    } catch {
      // toast handled in store
    } finally {
      setGoalContributing(false)
    }
  }

  const openEdit = () => {
    if (!detailGoal) return
    openGoalEdit(detailGoal)
  }

  const handleUpdate = async () => {
    if (!detailGoal || !edit.name.trim() || !edit.target) return
    setGoalEditSaving(true)
    try {
      await updateGoal(detailGoal.id, {
        name: edit.name.trim(),
        target_amount: parseFloat(edit.target),
        current_amount: parseFloat(edit.current) || 0,
        monthly_contribution: edit.monthly ? parseFloat(edit.monthly) : null,
        type: edit.type,
        deadline: edit.deadline || null,
      })
      setGoalEditOpen(false)
      closeGoalDetail()
    } catch {
      // toast handled in store
    } finally {
      setGoalEditSaving(false)
    }
  }

  const completed = (g: (typeof goals)[0]) => g.progress_pct >= 100

  return (
    <Dialog.Root open={create.open} onOpenChange={setGoalCreateOpen}>
      <Box>
        <PageHeader
          action={
            <Dialog.Trigger>
              <Button size="2">
                <Plus size={16} /> Add Goal
              </Button>
            </Dialog.Trigger>
          }
        />
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>Create Goal</Dialog.Title>
          <VisuallyHidden>
            <Dialog.Description>Set a savings target and an optional deadline</Dialog.Description>
          </VisuallyHidden>
          <Flex direction="column" gap="3" mt="3">
            <Flex direction="column" gap="1">
              <Text size="2" weight="medium">
                Name
              </Text>
              <TextField.Root
                placeholder="e.g. Emergency Fund"
                value={create.name}
                onChange={(e) => setGoalCreateField('name', e.target.value)}
              />
            </Flex>
            <Flex direction="column" gap="1">
              <Text size="2" weight="medium">
                Goal Type
              </Text>
              <Select.Root
                value={create.goalType}
                onValueChange={(v) => setGoalCreateField('goalType', v)}
              >
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
                value={create.goalAmount}
                onChange={(e) => setGoalCreateField('goalAmount', e.target.value)}
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
                value={create.initialAmount}
                onChange={(e) => setGoalCreateField('initialAmount', e.target.value)}
              >
                <TextField.Slot side="left">$</TextField.Slot>
              </TextField.Root>
            </Flex>
            <Flex justify="end" mt="2">
              <Button onClick={handleCreate} loading={create.saving} size="3">
                Create Goal
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>

        {loading ? (
          <Flex direction="column" gap="3" p="4">
            <Skeleton>
              <Text as="div" size="3">
                Placeholder goal name
              </Text>
            </Skeleton>
            <Skeleton>
              <Text as="div" size="2" style={{ width: '60%' }}>
                Placeholder progress detail
              </Text>
            </Skeleton>
            <Skeleton>
              <Text as="div" size="3" style={{ width: '85%' }}>
                Placeholder goal name
              </Text>
            </Skeleton>
            <Skeleton>
              <Text as="div" size="2" style={{ width: '40%' }}>
                Placeholder progress detail
              </Text>
            </Skeleton>
          </Flex>
        ) : goals.length === 0 ? (
          <Flex className={shared.emptyState} direction="column">
            <Text as="div" className={shared.emptyTitle}>
              No goals yet
            </Text>
            <Text as="div" className={shared.emptyHint}>
              Create your first goal to start tracking
            </Text>
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
                  onClick={() => openGoalDetail(goal.id)}
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
                        {formatCurrency(goal.current_amount, currency)} /{' '}
                        {formatCurrency(goal.target_amount, currency)}
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
                    open={detailGoalId === goal.id}
                    onOpenChange={(open) => {
                      if (!open) closeGoalDetail()
                    }}
                  >
                    <Dialog.Content maxWidth="420px">
                      {detailGoal && (
                        <>
                          <Flex align="center" gap="2" mb="3">
                            {goalIcons[detailGoal.type]}
                            <Dialog.Title mb="0">{detailGoal.name}</Dialog.Title>
                            <VisuallyHidden>
                              <Dialog.Description>
                                Progress, contributions and settings for this savings goal
                              </Dialog.Description>
                            </VisuallyHidden>
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
                                {formatCurrency(detailGoal.current_amount, currency)} /{' '}
                                {formatCurrency(detailGoal.target_amount, currency)}
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
                                  {formatCurrency(detailGoal.monthly_contribution, currency)}
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
                            <Button
                              size="2"
                              variant="soft"
                              className={styles.flex1}
                              onClick={openEdit}
                            >
                              <Pencil size={14} /> Edit
                            </Button>
                            <Button
                              size="2"
                              className={styles.flex1}
                              onClick={() => setGoalContributeOpen(true)}
                            >
                              <Plus size={14} /> Add Contribution
                            </Button>
                          </Flex>

                          {/* Contribute Dialog */}
                          <Dialog.Root open={contribute.open} onOpenChange={setGoalContributeOpen}>
                            <Dialog.Content maxWidth="360px">
                              <Dialog.Title>Add Contribution</Dialog.Title>
                              <VisuallyHidden>
                                <Dialog.Description>
                                  Record money put towards this goal
                                </Dialog.Description>
                              </VisuallyHidden>
                              <Flex direction="column" gap="3" mt="3">
                                <Flex direction="column" gap="1">
                                  <Text size="2" weight="medium">
                                    Amount
                                  </Text>
                                  <TextField.Root
                                    type="number"
                                    placeholder="100"
                                    value={contribute.amount}
                                    onChange={(e) => setGoalContributeAmount(e.target.value)}
                                  >
                                    <TextField.Slot side="left">$</TextField.Slot>
                                  </TextField.Root>
                                </Flex>
                                <Flex justify="end" mt="2">
                                  <Button
                                    onClick={handleContribute}
                                    loading={contribute.contributing}
                                    size="3"
                                  >
                                    Add
                                  </Button>
                                </Flex>
                              </Flex>
                            </Dialog.Content>
                          </Dialog.Root>

                          {/* Edit Goal Dialog */}
                          <Dialog.Root open={edit.open} onOpenChange={setGoalEditOpen}>
                            <Dialog.Content maxWidth="400px">
                              <Dialog.Title>Edit Goal</Dialog.Title>
                              <VisuallyHidden>
                                <Dialog.Description>
                                  Change this goal's name, target or deadline
                                </Dialog.Description>
                              </VisuallyHidden>
                              <Flex direction="column" gap="3" mt="3">
                                <Flex direction="column" gap="1">
                                  <Text size="2" weight="medium">
                                    Name
                                  </Text>
                                  <TextField.Root
                                    placeholder="Goal name"
                                    value={edit.name}
                                    onChange={(e) => setGoalEditField('name', e.target.value)}
                                  />
                                </Flex>
                                <Flex direction="column" gap="1">
                                  <Text size="2" weight="medium">
                                    Type
                                  </Text>
                                  <Select.Root
                                    value={edit.type}
                                    onValueChange={(v) => setGoalEditField('type', v)}
                                  >
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
                                    value={edit.target}
                                    onChange={(e) => setGoalEditField('target', e.target.value)}
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
                                    value={edit.current}
                                    onChange={(e) => setGoalEditField('current', e.target.value)}
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
                                    value={edit.monthly}
                                    onChange={(e) => setGoalEditField('monthly', e.target.value)}
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
                                    value={edit.deadline}
                                    onChange={(e) => setGoalEditField('deadline', e.target.value)}
                                  />
                                </Flex>
                                <Flex gap="3" mt="2" justify="end">
                                  <Button
                                    variant="soft"
                                    color="gray"
                                    onClick={() => setGoalEditOpen(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={handleUpdate}
                                    loading={edit.saving}
                                    disabled={!edit.name.trim() || !edit.target}
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
    </Dialog.Root>
  )
}
