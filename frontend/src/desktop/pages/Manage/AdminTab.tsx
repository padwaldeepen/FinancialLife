import { useEffect, useState, type JSX } from 'react'
import {
  Box,
  Flex,
  Text,
  Card,
  Table,
  Button,
  Badge,
  Dialog,
  TextField,
  Select,
  IconButton,
} from '@radix-ui/themes'
import { Trash2, Check, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import toast from '../../../shared/utils/toast.ts'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import type { AdminUserCreate } from '../../../store/slices/adminSlice.ts'
import styles from './Manage.module.css'

const emptyUser = (): AdminUserCreate => ({
  email: '',
  username: '',
  password: '',
  full_name: '',
  country: 'US',
})

// A2: the admin panel — only mounted when auth.user.is_admin (Manage.tsx gates it), and
// every call is server-gated by A1's require_admin. Manages the *system* (users,
// global categories, health) — never another user's financial data.
export const AdminTab = (): JSX.Element => {
  const {
    users,
    systemCategories,
    status,
    fetchAdminUsers,
    createAdminUser,
    setUserActive,
    fetchSystemCategories,
    createSystemCategory,
    updateSystemCategory,
    deleteSystemCategory,
    fetchAdminStatus,
    triggerBackup,
    currentUserId,
  } = useBoundStore(
    useShallow((s) => ({
      users: s.admin.users,
      systemCategories: s.admin.systemCategories,
      status: s.admin.status,
      fetchAdminUsers: s.fetchAdminUsers,
      createAdminUser: s.createAdminUser,
      setUserActive: s.setUserActive,
      fetchSystemCategories: s.fetchSystemCategories,
      createSystemCategory: s.createSystemCategory,
      updateSystemCategory: s.updateSystemCategory,
      deleteSystemCategory: s.deleteSystemCategory,
      fetchAdminStatus: s.fetchAdminStatus,
      triggerBackup: s.triggerBackup,
      currentUserId: s.auth.user?.id ?? null,
    })),
  )

  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [userForm, setUserForm] = useState<AdminUserCreate>(emptyUser())
  const [savingUser, setSavingUser] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6B7280')

  useEffect(() => {
    fetchAdminUsers()
    fetchSystemCategories()
    fetchAdminStatus()
  }, [fetchAdminUsers, fetchSystemCategories, fetchAdminStatus])

  const handleCreateUser = async () => {
    if (!userForm.email || !userForm.username || userForm.password.length < 8) {
      toast.error('Email, username, and an 8+ character password are required')
      return
    }
    setSavingUser(true)
    try {
      await createAdminUser(userForm)
      toast.success('User created — they can log in now')
      setUserDialogOpen(false)
      setUserForm(emptyUser())
      fetchAdminStatus()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Could not create user')
    } finally {
      setSavingUser(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    try {
      await createSystemCategory(newCatName.trim(), newCatColor)
      setNewCatName('')
      toast.success('Category added')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Could not add category')
    }
  }

  const statTiles = status
    ? [
        { label: 'Users', value: `${status.active_user_count}/${status.user_count} active` },
        { label: 'Pending documents', value: String(status.pending_documents) },
        { label: 'Transactions', value: String(status.total_transactions) },
        {
          label: 'Backups',
          value: status.backup_configured ? (status.last_backup ?? 'configured') : 'not set up',
        },
      ]
    : []

  return (
    <Box>
      {/* System status */}
      <Flex justify="between" align="center" mb="3">
        <Text as="div" className={styles.sectionTitle}>
          System
        </Text>
        <Button variant="soft" size="2" onClick={triggerBackup}>
          Run backup now
        </Button>
      </Flex>
      <Flex gap="3" wrap="wrap" mb="5">
        {statTiles.map((t) => (
          <Card key={t.label} className={styles.card} style={{ minWidth: 160 }}>
            <Text size="1" color="gray">
              {t.label}
            </Text>
            <Text as="div" size="4" weight="bold">
              {t.value}
            </Text>
          </Card>
        ))}
      </Flex>

      {/* Users */}
      <Flex justify="between" align="center" mb="3">
        <Text as="div" className={styles.sectionTitle}>
          Users
        </Text>
        <Button size="2" onClick={() => setUserDialogOpen(true)}>
          Add user
        </Button>
      </Flex>
      <Card className={styles.card} mb="5">
        <Table.Root size="1">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Username</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Profiles</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {users.map((u) => (
              <Table.Row key={u.id}>
                <Table.Cell>{u.email}</Table.Cell>
                <Table.Cell>{u.username}</Table.Cell>
                <Table.Cell>
                  {u.is_admin ? <Badge color="purple">Admin</Badge> : <Text size="1">User</Text>}
                </Table.Cell>
                <Table.Cell>{u.profile_count}</Table.Cell>
                <Table.Cell>
                  {u.is_active ? (
                    <Badge color="green">Active</Badge>
                  ) : (
                    <Badge color="gray">Inactive</Badge>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {u.id !== currentUserId && (
                    <Button
                      size="1"
                      variant="soft"
                      color={u.is_active ? 'red' : 'green'}
                      onClick={() => setUserActive(u.id, !u.is_active)}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>

      {/* System categories */}
      <Text as="div" className={styles.sectionTitle} mb="3">
        System categories
      </Text>
      <Card className={styles.card}>
        <Flex gap="2" mb="3" align="center">
          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            aria-label="New category color"
            style={{ width: 36, height: 32, border: 'none', background: 'none' }}
          />
          <TextField.Root
            placeholder="New system category name"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button size="2" onClick={handleAddCategory}>
            Add
          </Button>
        </Flex>
        <Flex direction="column" gap="1">
          {systemCategories.map((c) => (
            <SystemCategoryRow
              key={c.id}
              id={c.id}
              name={c.name}
              color={c.color}
              isChild={c.parent_id !== null}
              onRename={(name) => updateSystemCategory(c.id, { name })}
              onRecolor={(color) => updateSystemCategory(c.id, { color })}
              onDelete={() => deleteSystemCategory(c.id)}
            />
          ))}
        </Flex>
      </Card>

      {/* Create-user dialog */}
      <Dialog.Root open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <Dialog.Content aria-describedby={undefined} maxWidth="420px">
          <Dialog.Title>Add user</Dialog.Title>
          <Flex direction="column" gap="3" mt="2">
            <TextField.Root
              placeholder="Email"
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            />
            <TextField.Root
              placeholder="Username"
              value={userForm.username}
              onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
            />
            <TextField.Root
              placeholder="Password (8+ characters)"
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            />
            <TextField.Root
              placeholder="Full name (optional)"
              value={userForm.full_name ?? ''}
              onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
            />
            <Select.Root
              value={userForm.country}
              onValueChange={(v) => setUserForm({ ...userForm, country: v as 'US' | 'IN' | 'CA' })}
            >
              <Select.Trigger placeholder="Country" />
              <Select.Content>
                <Select.Item value="US">United States (USD)</Select.Item>
                <Select.Item value="IN">India (INR)</Select.Item>
                <Select.Item value="CA">Canada (CAD)</Select.Item>
              </Select.Content>
            </Select.Root>
            <Flex justify="end" gap="2" mt="2">
              <Button variant="soft" color="gray" onClick={() => setUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={savingUser}>
                Create
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}

const SystemCategoryRow = ({
  name,
  color,
  isChild,
  onRename,
  onRecolor,
  onDelete,
}: {
  id: number
  name: string
  color: string
  isChild: boolean
  onRename: (name: string) => void
  onRecolor: (color: string) => void
  onDelete: () => void
}): JSX.Element => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  return (
    <Flex align="center" justify="between" gap="2" py="1" pl={isChild ? '4' : '0'}>
      <Flex align="center" gap="2" style={{ flex: 1 }}>
        <input
          type="color"
          value={color}
          onChange={(e) => onRecolor(e.target.value)}
          aria-label={`${name} color`}
          style={{ width: 28, height: 26, border: 'none', background: 'none' }}
        />
        {editing ? (
          <TextField.Root
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{ flex: 1 }}
          />
        ) : (
          <Text size="2">{name}</Text>
        )}
      </Flex>
      {editing ? (
        <Flex gap="1">
          <IconButton
            size="1"
            variant="soft"
            color="green"
            onClick={() => {
              if (draft.trim() && draft.trim() !== name) onRename(draft.trim())
              setEditing(false)
            }}
          >
            <Check size={14} />
          </IconButton>
          <IconButton
            size="1"
            variant="soft"
            color="gray"
            onClick={() => {
              setDraft(name)
              setEditing(false)
            }}
          >
            <X size={14} />
          </IconButton>
        </Flex>
      ) : (
        <Flex gap="1">
          <Button size="1" variant="ghost" onClick={() => setEditing(true)}>
            Rename
          </Button>
          <IconButton size="1" variant="ghost" color="red" onClick={onDelete} aria-label="Delete">
            <Trash2 size={14} />
          </IconButton>
        </Flex>
      )}
    </Flex>
  )
}
