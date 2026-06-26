import { type JSX } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Heading, Text, Flex } from '@radix-ui/themes'
import { MobileLayout } from './layouts/MobileLayout.tsx'

const PlaceholderPage = ({ title }: { title: string }) => (
  <Flex direction="column" gap="4" pt="4">
    <Heading size="5">{title}</Heading>
    <Text color="gray">This page will be implemented in a later phase.</Text>
  </Flex>
)

export const MobileApp = (): JSX.Element => {
  return (
    <Routes>
      <Route element={<MobileLayout />}>
        <Route path="/" element={<PlaceholderPage title="Dashboard" />} />
        <Route path="/transactions" element={<PlaceholderPage title="Transactions" />} />
        <Route path="/add" element={<PlaceholderPage title="Add Transaction" />} />
        <Route path="/budgets" element={<PlaceholderPage title="Budgets" />} />
        <Route path="/profile" element={<PlaceholderPage title="Profile" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
