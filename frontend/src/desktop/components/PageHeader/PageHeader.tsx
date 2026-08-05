import { type JSX, type ReactNode } from 'react'
import { Flex, Text } from '@radix-ui/themes'

interface Props {
  subtitle?: string
  action?: ReactNode
}

// The sidebar nav already shows/highlights which page you're on — no need to repeat
// the page name here. This row exists only for a real action (Add Category, Add
// Goal, ...) and/or real info (Activity's transaction count), never a bare title.
export const PageHeader = ({ subtitle, action }: Props): JSX.Element => (
  <Flex justify="between" align="center" mb="5">
    {subtitle ? (
      <Text size="2" color="gray">
        {subtitle}
      </Text>
    ) : (
      <span />
    )}
    {action}
  </Flex>
)
