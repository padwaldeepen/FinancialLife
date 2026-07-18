import { useState, useEffect, useRef, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Flex,
  Heading,
  Text,
  Card,
  Avatar,
  IconButton,
  Popover,
  Separator,
} from '@radix-ui/themes'
import { RefreshCw, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import { useHomeData } from '../../../shared/hooks/useHomeData.ts'
import { useProfileSwitch } from '../../../shared/hooks/useProfileSwitch.ts'
import { COUNTRY_FLAG, COUNTRY_NAME } from '../../../shared/utils/countries.ts'
import type { Country } from '../../../shared/types/user.ts'
import styles from './Home.module.css'

const PULL_THRESHOLD = 80
const ADDABLE_COUNTRIES: Country[] = ['US', 'IN', 'CA']

export const Home = (): JSX.Element => {
  const currency = useActiveCurrency()
  const navigate = useNavigate()
  const { upcomingBills, loading, refresh } = useHomeData()
  const { user } = useBoundStore(useShallow((s) => ({ user: s.auth.user })))
  const { profiles, activeProfileId, switchProfile, addProfile } = useProfileSwitch()
  const { comparison, fetchReports } = useBoundStore(
    useShallow((s) => ({ comparison: s.reports.comparison, fetchReports: s.fetchReports })),
  )
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef(0)
  const isPulling = useRef(false)

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const fetchData = async () => {
    setRefreshing(true)
    await refresh({ force: true })
    await fetchReports()
    setRefreshing(false)
  }

  const activeProfile = profiles.find((p) => p.id === activeProfileId)
  const initial = user?.email?.charAt(0).toUpperCase() || 'U'
  const addableCountries = ADDABLE_COUNTRIES.filter((c) => !profiles.some((p) => p.country === c))

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return
    touchStartY.current = e.touches[0]!.clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const diff = e.touches[0]!.clientY - touchStartY.current
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, PULL_THRESHOLD * 1.5))
    }
  }

  const handleTouchEnd = () => {
    if (!isPulling.current) return
    isPulling.current = false
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setPullDistance(PULL_THRESHOLD)
      fetchData()
    }
    setPullDistance(0)
  }

  const expenseChangePct = comparison?.expense_change_pct ?? null
  const comparisonPct =
    comparison && comparison.previous_expense > 0
      ? Math.min((comparison.current_expense / comparison.previous_expense) * 100, 150)
      : 0

  if (loading) {
    return (
      <Flex direction="column" gap="3" p="3">
        <Box
          className="skeleton"
          style={{ height: 20, width: '60%', borderRadius: 'var(--radius-2)' }}
        />
        <Box
          className="skeleton"
          style={{ height: 80, width: '100%', borderRadius: 'var(--radius-2)' }}
        />
        <Box
          className="skeleton"
          style={{ height: 16, width: '100%', borderRadius: 'var(--radius-2)' }}
        />
        <Box
          className="skeleton"
          style={{ height: 16, width: '70%', borderRadius: 'var(--radius-2)' }}
        />
      </Flex>
    )
  }

  return (
    <Box
      className={styles.page}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Box
        className={styles.pullIndicator}
        style={
          {
            '--pull-height': `${pullDistance}px`,
            '--pull-opacity': Math.min(pullDistance / PULL_THRESHOLD, 1),
          } as React.CSSProperties
        }
      >
        <RefreshCw
          size={20}
          className={
            refreshing ? styles.spinning : pullDistance >= PULL_THRESHOLD ? styles.ready : ''
          }
        />
      </Box>

      {/* Avatar row — profile switcher lives here on mobile (U3) */}
      <Flex align="center" justify="between" className={styles.avatarRow}>
        <Popover.Root>
          <Popover.Trigger>
            <Flex align="center" gap="2" className={styles.profileTrigger}>
              {activeProfile ? <Text size="4">{COUNTRY_FLAG[activeProfile.country]}</Text> : null}
              <Text size="2" weight="medium" color="gray">
                {activeProfile ? COUNTRY_NAME[activeProfile.country] : ''}
              </Text>
            </Flex>
          </Popover.Trigger>
          <Popover.Content align="start" className={styles.profilePopover}>
            <Flex direction="column" gap="1">
              <Text size="1" color="gray" weight="medium">
                Profile
              </Text>
              {profiles.map((profile) => (
                <Flex
                  key={profile.id}
                  align="center"
                  justify="between"
                  className={styles.profileRow}
                  data-active={profile.id === activeProfileId}
                  onClick={() => switchProfile(profile.id)}
                >
                  <Flex align="center" gap="2">
                    <Text size="3">{COUNTRY_FLAG[profile.country]}</Text>
                    <Text size="2">{COUNTRY_NAME[profile.country]}</Text>
                  </Flex>
                  <Text size="1" color="gray">
                    {profile.currency}
                  </Text>
                </Flex>
              ))}
              {addableCountries.map((country) => (
                <Flex
                  key={country}
                  align="center"
                  gap="2"
                  className={styles.profileRow}
                  onClick={() => addProfile(country)}
                >
                  <Plus size={14} />
                  <Text size="2" color="gray">
                    Add {COUNTRY_NAME[country]}
                  </Text>
                </Flex>
              ))}
            </Flex>
            <Separator size="4" my="2" />
            <Text
              size="2"
              color="gray"
              className={styles.profileRow}
              onClick={() => navigate('/settings')}
            >
              Settings
            </Text>
          </Popover.Content>
        </Popover.Root>
        <IconButton
          variant="soft"
          radius="full"
          size="2"
          onClick={() => navigate('/settings')}
          aria-label="Settings"
        >
          <Avatar size="2" radius="full" fallback={initial} />
        </IconButton>
      </Flex>

      <Flex direction="column" gap="4">
        {/* Safe-to-Spend Hero — placeholder until Phase I's forecast engine (I5) */}
        <Card className={styles.balanceCard}>
          <Text size="2" color="gray">
            Safe to Spend
          </Text>
          <Heading size="7" className={styles.balanceAmount}>
            —
          </Heading>
          <Text size="1" color="gray">
            Needs Phase I (forecast engine)
          </Text>
        </Card>

        {/* Next 3 Bills */}
        <Heading size="3">Upcoming Bills</Heading>
        {upcomingBills.length === 0 ? (
          <Text color="gray" size="2">
            No upcoming bills
          </Text>
        ) : (
          <Flex direction="column" gap="2">
            {upcomingBills.slice(0, 3).map((bill) => (
              <Flex key={bill.id} align="center" justify="between" className={styles.billRow}>
                <Flex direction="column" gap="1" className={styles.flex1}>
                  <Text size="2" weight="medium">
                    {bill.name}
                  </Text>
                  <Text size="1" color="gray">
                    {bill.has_paid
                      ? 'Paid'
                      : bill.days_until === 0
                        ? 'Due today'
                        : `${bill.days_until}d`}
                    {bill.is_variable && ' (est.)'}
                  </Text>
                </Flex>
                <Text size="2" weight="bold" color={bill.has_paid ? 'green' : undefined}>
                  {bill.has_paid ? '✓ ' : ''}
                  {formatCurrency(bill.amount, currency)}
                </Text>
              </Flex>
            ))}
          </Flex>
        )}

        {/* This month vs last */}
        <Card className={styles.contentCard}>
          <Text size="1" color="gray">
            This month vs last
          </Text>
          {comparison ? (
            <>
              <Flex justify="between" align="baseline" mt="1">
                <Text size="5" weight="bold">
                  {formatCurrency(comparison.current_expense, currency)}
                </Text>
                {expenseChangePct !== null && (
                  <Text size="2" color={expenseChangePct > 0 ? 'red' : 'green'}>
                    {expenseChangePct > 0 ? '+' : ''}
                    {expenseChangePct.toFixed(0)}%
                  </Text>
                )}
              </Flex>
              <Box className={styles.comparisonTrack}>
                <Box
                  className={styles.comparisonFill}
                  style={{ '--fill-pct': `${comparisonPct}%` } as React.CSSProperties}
                />
              </Box>
              <Text size="1" color="gray">
                vs {formatCurrency(comparison.previous_expense, currency)} last month
              </Text>
            </>
          ) : (
            <Text size="2" color="gray">
              No data yet
            </Text>
          )}
        </Card>

        {refreshing && (
          <Flex justify="center" gap="2" align="center">
            <RefreshCw size={14} className={styles.spinning} />
            <Text size="1" color="gray">
              Refreshing...
            </Text>
          </Flex>
        )}
      </Flex>
    </Box>
  )
}
