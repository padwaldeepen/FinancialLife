import { useEffect, type JSX } from 'react'
import {
  Box,
  Flex,
  Text,
  Card,
  Badge,
  Button,
  Dialog,
  TextField,
  Select,
  IconButton,
  Skeleton,
  VisuallyHidden,
} from '@radix-ui/themes'
import { Tags, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import styles from './Categories.module.css'
import shared from '../../styles/shared.module.css'
import { PageHeader } from '../../components/PageHeader/PageHeader.tsx'

export const Categories = (): JSX.Element => {
  const { tree, loading, fetchCategories, createCategory, updateCategory, deleteCategory } =
    useBoundStore(
      useShallow((s) => ({
        tree: s.categories.tree,
        loading: s.categories.loading,
        fetchCategories: s.categories.fetchCategories,
        createCategory: s.categories.createCategory,
        updateCategory: s.categories.updateCategory,
        deleteCategory: s.categories.deleteCategory,
      })),
    )
  const {
    expanded,
    dialogOpen,
    editId,
    form,
    saving,
    deleteId,
    deleting,
    toggleCategoryExpand,
    openCategoryCreate,
    openCategoryEdit,
    setCategoryDialogOpen,
    setCategoryFormField,
    setCategorySaving,
    startCategoryDelete,
    cancelCategoryDelete,
    setCategoryDeleting,
  } = useBoundStore(useShallow((s) => s.categoriesForm))

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const toggleExpand = toggleCategoryExpand

  const openCreate = openCategoryCreate

  const openEdit = openCategoryEdit

  const handleSave = async () => {
    if (!form.name.trim()) return
    setCategorySaving(true)
    try {
      if (editId !== null) {
        await updateCategory(editId, form)
      } else {
        await createCategory(form)
      }
      setCategoryDialogOpen(false)
    } finally {
      setCategorySaving(false)
    }
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    setCategoryDeleting(true)
    try {
      await deleteCategory(deleteId)
      cancelCategoryDelete()
    } finally {
      setCategoryDeleting(false)
    }
  }

  // `tree` is the backend's nested shape (each node carries its own `.children`), not a
  // flat list — a parent's children live on the node itself, never as sibling entries
  // in `tree` with a matching `parent_id` (top-level nodes all have `parent_id: null`).
  const parents = tree

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
        <IconButton
          size="1"
          variant="ghost"
          color="red"
          onClick={() => startCategoryDelete(cat.id)}
        >
          <Trash2 size={14} />
        </IconButton>
      </Flex>
    )
  }

  return (
    <Box>
      <PageHeader
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Category
          </Button>
        }
      />

      {loading ? (
        <Flex direction="column" gap="3" p="4">
          {['100%', '75%', '55%', '90%'].map((w) => (
            <Skeleton key={w}>
              <Text as="div" size="3" style={{ width: w }}>
                Placeholder category name
              </Text>
            </Skeleton>
          ))}
        </Flex>
      ) : (
        <Flex direction="column" gap="2">
          {parents.map((parent) => {
            const children = parent.children
            const isExpanded = expanded.has(parent.id)

            return (
              <Card key={parent.id} className={styles.card}>
                <Flex
                  align="center"
                  gap="3"
                  className={styles.parentRow}
                  onClick={() => children.length > 0 && toggleExpand(parent.id)}
                >
                  <Box className={styles.flex1}>
                    <Flex align="center" gap="2">
                      <Text size="3" weight="bold">
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
                      className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ''}`}
                    >
                      <ChevronRight size={16} />
                    </Box>
                  )}
                </Flex>

                {isExpanded && children.length > 0 && (
                  <Flex direction="column" className={styles.childrenList}>
                    {children.map((child) => (
                      <Flex key={child.id} align="center" gap="3" className={styles.childRow}>
                        <Text size="2" className={styles.flex1}>
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
            <Flex className={shared.emptyState} direction="column">
              <Tags size={32} />
              <Text color="gray">No categories yet</Text>
            </Flex>
          )}
        </Flex>
      )}

      {/* Create/Edit Dialog */}
      <Dialog.Root open={dialogOpen} onOpenChange={setCategoryDialogOpen}>
        <Dialog.Content className={styles.dialogWide}>
          <Dialog.Title>{editId !== null ? 'Edit Category' : 'Add Category'}</Dialog.Title>
          <VisuallyHidden>
            <Dialog.Description>
              Name the category and pick its colour and parent
            </Dialog.Description>
          </VisuallyHidden>
          <Flex direction="column" gap="3" mt="3">
            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Name
              </Text>
              <TextField.Root
                placeholder="Category name"
                value={form.name}
                onChange={(e) => setCategoryFormField('name', e.target.value)}
              />
            </Box>
            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Parent Category
              </Text>
              <Select.Root
                value={form.parent_id !== null ? String(form.parent_id) : 'none'}
                onValueChange={(v) =>
                  setCategoryFormField('parent_id', v === 'none' ? null : Number(v))
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
          if (!o) cancelCategoryDelete()
        }}
      >
        <Dialog.Content className={styles.dialogNarrow}>
          <Dialog.Title>Delete Category</Dialog.Title>
          <VisuallyHidden>
            <Dialog.Description>Confirm removing this category</Dialog.Description>
          </VisuallyHidden>
          <Text size="2" mt="2">
            Are you sure you want to delete this category? Transactions using it will be
            uncategorized.
          </Text>
          <Flex gap="3" mt="4" justify="end">
            <Button variant="soft" color="gray" onClick={() => cancelCategoryDelete()}>
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
