import { type JSX } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Heading, Text, Flex } from '@radix-ui/themes'
import { MobileLayout } from './layouts/MobileLayout.tsx'
import { Login } from './pages/Login/Login.tsx'
import { Register } from './pages/Register/Register.tsx'
import { AddTransaction } from './pages/AddTransaction/AddTransaction.tsx'
import { Transactions } from './pages/Transactions/Transactions.tsx'
import { Dashboard } from './pages/Dashboard/Dashboard.tsx'
import { Budgets } from './pages/Budgets/Budgets.tsx'

const PlaceholderPage = ({ title }: { title: string }) => (
  <Flex direction="column" gap="4" pt="4">
    <Heading size="5">{title}</Heading>
    <Text color="gray">This page will be implemented in a later phase.</Text>
  </Flex>
)

export const MobileApp = (): JSX.Element => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<MobileLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/add" element={<AddTransaction />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/profile" element={<PlaceholderPage title="Profile" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
