'use client'

import { useEffect, useState } from 'react'

const BASE_ACTIVE_SECONDS = 15_896
const BASE_AMOUNT = 1_248.459832
const RATE_PER_SECOND = 0.002314
const DEMO_TIME_MULTIPLIER = 32

export default function LiveStreamCounter({ compact = false }: { compact?: boolean }) {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const startedAt = performance.now()
    const interval = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAt)
    }, 100)

    return () => window.clearInterval(interval)
  }, [])

  const elapsedSeconds = (elapsedMs / 1000) * DEMO_TIME_MULTIPLIER
  const activeSeconds = BASE_ACTIVE_SECONDS + Math.floor(elapsedSeconds)
  const amount = BASE_AMOUNT + elapsedSeconds * RATE_PER_SECOND
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  })

  return (
    <div className={compact ? 'live-counter live-counter--compact' : 'live-counter'}>
      <span>SESSION VERIFIED</span>
      <strong>$ {formattedAmount}</strong>
      <small>
        {activeSeconds.toLocaleString('en-US')} ACTIVE SECONDS × $
        {RATE_PER_SECOND.toFixed(6)}
      </small>
    </div>
  )
}
