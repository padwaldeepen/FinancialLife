import { type JSX } from 'react'
import { Flex, Text, Avatar } from '@radix-ui/themes'
import styles from './TopBar.module.css'

export const TopBar = (): JSX.Element => {
  return (
    <header className={styles.topBar}>
      <Flex align="center" justify="between" px="4" height="100%">
        <Flex align="center" gap="2">
          <Text size="2" color="gray">
            Welcome back
          </Text>
        </Flex>

        <Flex align="center" gap="3">
          <Avatar size="2" radius="full" fallback="U" />
        </Flex>
      </Flex>
    </header>
  )
}
