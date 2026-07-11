import { useRef } from 'react'
import { gsap, useGSAP } from '../../lib/gsap'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'


export default function LiveStreamCounter({ compact = false }: { compact?: boolean }) {
  const amountRef = useRef<HTMLElement>(null)

  const prefersReducedMotion = usePrefersReducedMotion()

  useGSAP(
    () => {
      const value = { amount: 1248.291843 }
      const render = () => {
        if (amountRef.current) {
          amountRef.current.textContent = `$ ${value.amount.toLocaleString('en-US', {
            minimumFractionDigits: 6,
            maximumFractionDigits: 6,
          })}`
        }
      }

      render()
      if (prefersReducedMotion) return undefined

      const tween = gsap.to(value, {
        amount: value.amount + 0.002314 * 120,
        duration: 120,
        ease: 'none',
        repeat: -1,
        onUpdate: render,
      })

      return () => tween.kill()
    },
    { dependencies: [prefersReducedMotion] }
  )

  return (
    <div className={compact ? 'live-counter live-counter--compact' : 'live-counter'}>
      <span>STREAMING NOW</span>
      <strong ref={amountRef}>$ 1,248.291843</strong>
      <small>+ $0.002314 / SECOND</small>
    </div>
  )
}
