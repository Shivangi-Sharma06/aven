import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import AvenNetwork from './AvenNetwork'
import AvenMorphLogo from './AvenMorphLogo'
import LiveStreamCounter from './LiveStreamCounter'
import { gsap, ScrollSmoother, useGSAP } from '../../lib/gsap'


function scrollToTarget(id: string) {
  const target = document.getElementById(id)
  const smoother = ScrollSmoother.get()

  if (smoother && target) {
    smoother.scrollTo(target, true, 'top top')
    return
  }

  target?.scrollIntoView({ behavior: 'smooth' })
}



export default function AvenHero() {
  const heroRef = useRef<HTMLElement>(null)
  const router = useRouter()

  useGSAP(
    () => {
      if (!heroRef.current) return
      const items = gsap.utils.toArray('[data-hero-reveal]', heroRef.current)
      const logo = heroRef.current.querySelector('.aven-morph-logo')
      const network = heroRef.current.querySelector('.aven-network-wrap')

      if (!logo || !network) return

      gsap.set(items, { autoAlpha: 0, y: 18 })
      gsap.set(network, { autoAlpha: 0 })

      const shapeA = logo.querySelector('#aven-shape-a') as any
      const shapeV = logo.querySelector('#aven-shape-v') as any
      const shapeE = logo.querySelector('#aven-shape-e') as any
      const shapeN = logo.querySelector('#aven-shape-n') as any

      const targetA = logo.querySelector('#aven-letter-a') as any
      const targetV = logo.querySelector('#aven-letter-v') as any
      const targetE = logo.querySelector('#aven-letter-e') as any
      const targetN = logo.querySelector('#aven-letter-n') as any

      if (!shapeA || !shapeV || !shapeE || !shapeN || !targetA || !targetV || !targetE || !targetN) return

      // Intro animation for page entry (run once)
      const tlIntro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tlIntro
        .to(network, { autoAlpha: 1, duration: 0.8 }, 0.1)
        .to(items, { autoAlpha: 1, y: 0, duration: 0.58, stagger: 0.14 }, 0.7)

      const tlMorph = gsap.timeline({
        delay: 0.3,
        defaults: {
          duration: 1.4,
          ease: 'power3.inOut',
        },
      })

      tlMorph
        .to(shapeA, { morphSVG: { shape: targetA } })
        .to(shapeV, { morphSVG: { shape: targetV } }, '<')
        .to(shapeE, { morphSVG: { shape: targetE } }, '<')
        .to(shapeN, { morphSVG: { shape: targetN } }, '<')

      return () => {
        tlIntro.kill()
        tlMorph.kill()
      }
    },
    { scope: heroRef }
  )

  return (
    <section ref={heroRef} className="stage" id="hero">
      <AvenNetwork />
      <div className="hero-copy">
        <div className="hero-brand">
          <AvenMorphLogo />
        </div>
        <p className="hero-copy__eyebrow" data-hero-reveal>
          PAY FOR PROGRESS.
          <br />
          KEEP THE PROOF.
        </p>
        <h1 data-hero-reveal>
          <span>WORK MOVES FORWARD.</span>
          <span>PAYMENT SHOULD KEEP UP.</span>
        </h1>
        <p className="hero-copy__body" data-hero-reveal>
          Aven lets clients fund work upfront, workers get paid for npm-tracked active
          time, and every released session becomes verifiable history on Stellar.
        </p>
        <div data-hero-reveal>
          <LiveStreamCounter />
        </div>
        <div className="hero-actions" data-hero-reveal>
          <button onClick={() => router.push('/stream/create')}>START A STREAM</button>
          <button onClick={() => scrollToTarget('protocol')}>EXPLORE PROTOCOL</button>
        </div>
      </div>
    </section>
  )
}
