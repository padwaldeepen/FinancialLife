import { useState, useEffect, useCallback, type JSX } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  Card,
  Badge,
  Tabs,
  Button,
  Dialog,
  TextField,
  Select,
  IconButton,
} from '@radix-ui/themes'
import { Tags, ChevronRight, PieChart, Plus, Pencil, Trash2 } from 'lucide-react'
import { ResponsivePie } from '@nivo/pie'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Categories.module.css'

const COLOR_OPTIONS = [
  '#6B7280',
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#14B8A6',
  '#3B82F6',
  '#6366F1',
  '#A855F7',
  '#EC4899',
]

interface CategoryFormData {
  name: string
  color: string
  parent_id: number | null
}

const emptyForm = (): CategoryFormData => ({ name: '', color: '#6B7280', parent_id: null })

export const Categories = (): JSX.Element => {
  const {
    tree,
    loading,
    spending,
    spendingLoading,
    fetchCategories,
    fetchSpendingByCategory,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useBoundStore(
    useShallow((s) => ({
      tree: s.categories.tree,
      loading: s.categories.loading,
      spending: s.categories.spending,
      spendingLoading: s.categories.spendingLoading,
      fetchCategories: s.fetchCategories,
      fetchSpendingByCategory: s.fetchSpendingByCategory,
      createCategory: s.createCategory,
      updateCategory: s.updateCategory,
      deleteCategory: s.deleteCategory,
    })),
  )
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [tab, setTab] = useState('list')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<CategoryFormData>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchCategories()
    fetchSpendingByCategory()
  }, [fetchCategories, fetchSpendingByCategory])

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openCreate = () => {
    setEditId(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  const openEdit = useCallback(
    (cat: { id: number; name: string; color: string; parent_id: number | null }) => {
      setEditId(cat.id)
      setForm({ name: cat.name, color: cat.color, parent_id: cat.parent_id })
      setDialogOpen(true)
    },
    [],
  )

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editId !== null) {
        await updateCategory(editId, form)
      } else {
        await createCategory(form)
      }
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    setDeleting(true)
    try {
      await deleteCategory(deleteId)
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  const parents = tree.filter((c) => !c.parent_id)
  const getChildren = (parentId: number) => tree.filter((c) => c.parent_id === parentId)

  const hasSpendingData = spending.length > 0

  const renderCategoryActions = (cat: {
    id: number
    name: string
    color: string
    parent_id: number | null
    is_system: boolean
  }) => {
    if (cat.is_system) return null
    return (
      <Flex gap="1" align="center">
        <IconButton size="1" variant="ghost" onClick={() => openEdit(cat)}>
          <Pencil size={14} />
        </IconButton>
        <IconButton size="1" variant="ghost" color="red" onClick={() => setDeleteId(cat.id)}>
          <Trash2 size={14} />
        </IconButton>
      </Flex>
    )
  }

  return (
    <Box className={styles.page}>
      <Flex justify="between" align="center" mb="4">
        <Heading size="5">Categories</Heading>
        <Button size="1" onClick={openCreate}>
          <Plus size={14} /> Add
        </Button>
      </Flex>

      <Tabs.Root value={tab} onValueChange={setTab} mb="4">
        <Tabs.List>
          <Tabs.Trigger value="list">
            <Tags size={14} /> List
          </Tabs.Trigger>
          <Tabs.Trigger value="analytics">
            <PieChart size={14} /> Analytics
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {tab === 'analytics' && (
        <Box mb="4">
          {spendingLoading ? (
            <Text color="gray">Loading analytics...</Text>
          ) : hasSpendingData ? (
            <>
              <Box className={styles.chartContainer}>
                <ResponsivePie
                  data={spending.map((s) => ({
                    id: s.name,
                    label: s.name,
                    value: s.total,
                    color: s.color,
                  }))}
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  innerRadius={0.5}
                  padAngle={2}
                  cornerRadius={4}
                  activeOuterRadiusOffset={8}
                  colors={{ datum: 'data.color' }}
                  borderWidth={1}
                  borderColor={{ theme: 'background' }}
                  arcLinkLabelsSkipAngle={10}
                  arcLinkLabelsTextColor="var(--gray-12)"
                  arcLinkLabelsThickness={2}
                  arcLinkLabelsColor={{ from: 'color' }}
                  arcLabelsSkipAngle={10}
                  arcLabelsTextColor="var(--gray-1)"
                  valueFormat=">-$0,"
                  theme={{
                    background: 'transparent',
                    text: { fill: 'var(--gray-12)' },
                  }}
                />
              </Box>

              <Flex direction="column" gap="2" mt="3">
                <Text size="2" weight="medium" mb="1">
                  Breakdown
                </Text>
                {spending.map((s) => (
                  <Flex key={s.id} align="center" gap="3" className={styles.spendingRow}>
                    <Box className={styles.colorDot} style={{ backgroundColor: s.color }} />
                    <Text size="2" style={{ flex: 1 }}>
                      {s.name}
                    </Text>
                    <Text size="2" weight="medium">
                      ${s.total.toFixed(2)}
                    </Text>
                    <Text size="1" color="gray" style={{ width: 40, textAlign: 'right' }}>
                      {s.percentage}%
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </>
          ) : (
            <Flex direction="column" align="center" gap="2" py="6">
              <PieChart size={24} />
              <Text color="gray">No spending data yet</Text>
              <Text size="2" color="gray">
                Add expenses to see your breakdown
              </Text>
            </Flex>
          )}
        </Box>
      )}

      {tab === 'list' && (
        <>
          {loading ? (
            <Text color="gray">Loading...</Text>
          ) : (
            <Flex direction="column" gap="2">
              {parents.map((parent) => {
                const children = getChildren(parent.id)
                const isExpanded = expanded.has(parent.id)

                return (
                  <Card key={parent.id} size="1">
                    <Flex
                      align="center"
                      gap="3"
                      className={styles.parentRow}
                      onClick={() => children.length > 0 && toggleExpand(parent.id)}
                    >
                      <Box className={styles.colorDot} style={{ backgroundColor: parent.color }} />
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Flex align="center" gap="2" wrap="wrap">
                          <Text size="2" weight="bold">
                            {parent.name}
                          </Text>
                          {parent.is_system && (
                            <Badge size="1" color="gray">
                              System
                            </Badge>
                          )}
                        </Flex>
                        <Text size="1" color="gray">
                          {children.length} subcategories
                        </Text>
                      </Box>
                      {renderCategoryActions(parent)}
                      {children.length > 0 && (
                        <Box
                          className={styles.chevron}
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        >
                          <ChevronRight size={16} />
                        </Box>
                      )}
                    </Flex>

                    {isExpanded && children.length > 0 && (
                      <Flex direction="column" className={styles.childrenList}>
                        {children.map((child) => (
                          <Flex key={child.id} align="center" gap="3" className={styles.childRow}>
                            <Box
                              className={styles.colorDotSmall}
                              style={{ backgroundColor: child.color }}
                            />
                            <Text size="2" style={{ flex: 1 }}>
                              {child.name}
                            </Text>
                            {child.is_system && (
                              <Badge size="1" color="gray">
                                System
                              </Badge>
                            )}
                            {renderCategoryActions(child)}
                          </Flex>
                        ))}
                      </Flex>
                    )}
                  </Card>
                )
              })}

              {parents.length === 0 && (
                <Flex direction="column" align="center" gap="2" py="6">
                  <Tags size={24} />
                  <Text color="gray">No categories yet</Text>
                </Flex>
              )}
            </Flex>
          )}
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Content style={{ maxWidth: 380 }}>
          <Dialog.Title>{editId !== null ? 'Edit Category' : 'Add Category'}</Dialog.Title>
          <Flex direction="column" gap="3" mt="3">
            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Name
              </Text>
              <TextField.Root
                placeholder="Category name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Box>
            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Color
              </Text>
              <Flex gap="2" wrap="wrap" mb="2">
                {COLOR_OPTIONS.map((c) => (
                  <Box
                    key={c}
                    className={styles.colorSwatch}
                    style={{
                      backgroundColor: c,
                      outline: form.color === c ? '2px solid var(--accent-9)' : undefined,
                      outlineOffset: 2,
                    }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </Flex>
              <TextField.Root
                placeholder="#6B7280"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </Box>
            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Parent Category
              </Text>
              <Select.Root
                value={form.parent_id !== null ? String(form.parent_id) : 'none'}
                onValueChange={(v) =>
                  setForm({ ...form, parent_id: v === 'none' ? null : Number(v) })
                }
              >
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="none">None (top-level)</Select.Item>
                  {parents.map((p) => (
                    <Select.Item key={p.id} value={String(p.id)}>
                      {p.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : editId !== null ? 'Save Changes' : 'Create'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root
        open={deleteId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null)
        }}
      >
        <Dialog.Content style={{ maxWidth: 350 }}>
          <Dialog.Title>Delete Category</Dialog.Title>
          <Text size="2" mt="2">
            Are you sure you want to delete this category? Transactions using it will be
            uncategorized.
          </Text>
          <Flex gap="3" mt="4" justify="end">
            <Button variant="soft" color="gray" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
