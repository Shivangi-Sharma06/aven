'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const BASE_IMAGE = '/images/hero/aven-flow-base.webp'
const REVEAL_IMAGE = '/images/hero/aven-flow-reveal.webp'
const SPOTLIGHT_RADIUS = 260

type CursorPosition = { x: number; y: number }

function RevealLayer({ image, cursor }: { image: string; cursor: CursorPosition }) {
  const mask = `radial-gradient(circle ${SPOTLIGHT_RADIUS}px at ${cursor.x}px ${cursor.y}px,
    rgba(255,255,255,1) 0%,
    rgba(255,255,255,1) 40%,
    rgba(255,255,255,.75) 60%,
    rgba(255,255,255,.4) 75%,
    rgba(255,255,255,.12) 88%,
    rgba(255,255,255,0) 100%)`

  return (
    <div
      aria-hidden="true"
      className="aven-spotlight-hero__reveal"
      style={{
        backgroundImage: `url(${image})`,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  )
}

export default function AvenHero() {
  const heroRef = useRef<HTMLElement>(null)
  const mouse = useRef<CursorPosition>({ x: -999, y: -999 })
  const smooth = useRef<CursorPosition>({ x: -999, y: -999 })
  const animationFrame = useRef<number | null>(null)
  const [cursor, setCursor] = useState<CursorPosition>({ x: -999, y: -999 })
  const router = useRouter()

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return

    const onPointerMove = (event: PointerEvent) => {
      const bounds = hero.getBoundingClientRect()
      mouse.current = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      }
    }

    const onPointerLeave = () => {
      mouse.current = { x: -999, y: -999 }
    }

    const updateSpotlight = () => {
      smooth.current.x += (mouse.current.x - smooth.current.x) * 0.1
      smooth.current.y += (mouse.current.y - smooth.current.y) * 0.1
      setCursor({ ...smooth.current })
      animationFrame.current = requestAnimationFrame(updateSpotlight)
    }

    hero.addEventListener('pointermove', onPointerMove, { passive: true })
    hero.addEventListener('pointerleave', onPointerLeave)
    animationFrame.current = requestAnimationFrame(updateSpotlight)

    return () => {
      hero.removeEventListener('pointermove', onPointerMove)
      hero.removeEventListener('pointerleave', onPointerLeave)
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
    }
  }, [])

  return (
    <section ref={heroRef} className="aven-spotlight-hero" id="hero">
      <div
        aria-hidden="true"
        className="aven-spotlight-hero__base aven-hero-zoom"
        style={{ backgroundImage: `url(${BASE_IMAGE})` }}
      />
      <RevealLayer image={REVEAL_IMAGE} cursor={cursor} />
      <div className="aven-spotlight-hero__shade" aria-hidden="true" />

      <div className="aven-spotlight-hero__heading">
        <span className="aven-hero-anim aven-hero-reveal aven-spotlight-hero__kicker">
          PAY FOR PROGRESS · KEEP THE PROOF
        </span>
        <h1 className="aven-hero-anim aven-hero-reveal">AVEN</h1>
      </div>

      <div className="aven-spotlight-hero__left aven-hero-anim aven-hero-fade">
        <p>
          Fund work upfront, pay for verified active time, and leave every released
          session with a portable record on Stellar.
        </p>
      </div>

      <div className="aven-spotlight-hero__right aven-hero-anim aven-hero-fade">
        <p>
          Aven connects funded agreements to npm-tracked work, giving clients clear
          proof and workers payment that keeps pace with delivery.
        </p>
        <button onClick={() => router.push('/stream/create')}>START A STREAM</button>
      </div>

      <div className="aven-spotlight-hero__hint" aria-hidden="true">
        MOVE TO REVEAL THE WORK LAYER
      </div>
    </section>
  )
}
