'use client'

import { useEffect, useState } from 'react'

const INITIAL_AMOUNT = 36.78426
const INITIAL_ACTIVE_SECONDS = 15_896
const RATE_PER_SECOND = 0.002314

export default function LiveStreamCounter({ compact = false }: { compact?: boolean }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    const startedAt = performance.now()
    let animationFrame = 0

    const updateCounter = (now: number) => {
      setElapsedSeconds((now - startedAt) / 1000)
      animationFrame = requestAnimationFrame(updateCounter)
    }

    animationFrame = requestAnimationFrame(updateCounter)

    return () => cancelAnimationFrame(animationFrame)
  }, [])

  const streamedAmount = INITIAL_AMOUNT + elapsedSeconds * RATE_PER_SECOND
  const activeSeconds = INITIAL_ACTIVE_SECONDS + Math.floor(elapsedSeconds)

  return (
    <div className={compact ? 'live-counter live-counter--compact' : 'live-counter'}>
      <span>SESSION VERIFIED</span>
      <strong>$ {streamedAmount.toFixed(6)}</strong>
      <small>
        {activeSeconds.toLocaleString('en-US')} ACTIVE SECONDS × ${RATE_PER_SECOND.toFixed(6)}
      </small>
    </div>
  )
}
