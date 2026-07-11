import { useRef } from 'react'
import AvenNetwork from './AvenNetwork'
import AvenMorphLogo from './AvenMorphLogo'
import LiveStreamCounter from './LiveStreamCounter'
import { gsap, MorphSVGPlugin, ScrollSmoother, useGSAP } from '../../lib/gsap'

function scrollToTarget(id) {
  const target = document.getElementById(id)
  const smoother = ScrollSmoother.get()

  if (smoother && target) {
    smoother.scrollTo(target, true, 'top top')
    return
  }

  target?.scrollIntoView({ behavior: 'smooth' })
}

export default function AvenHero() {
  const heroRef = useRef(null)
  useGSAP(
    () => {
      const items = gsap.utils.toArray('[data-hero-reveal]', heroRef.current)
      const logo = heroRef.current.querySelector('.aven-morph-logo')
      const network = heroRef.current.querySelector('.aven-network-wrap')
      const nav = document.querySelector('.aven-nav')

      gsap.set(items, { autoAlpha: 0, y: 18 })
      gsap.set(network, { autoAlpha: 0 })
      gsap.set(nav, { autoAlpha: 0.35 })

      const shapeA = logo.querySelector('#aven-shape-a')
      const shapeV = logo.querySelector('#aven-shape-v')
      const shapeE = logo.querySelector('#aven-shape-e')
      const shapeN = logo.querySelector('#aven-shape-n')

      const targetA = logo.querySelector('#aven-letter-a')
      const targetV = logo.querySelector('#aven-letter-v')
      const targetE = logo.querySelector('#aven-letter-e')
      const targetN = logo.querySelector('#aven-letter-n')

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set([network, nav, items], { autoAlpha: 1, y: 0 })
        gsap.set(shapeA, { morphSVG: { shape: targetA } })
        gsap.set(shapeV, { morphSVG: { shape: targetV } })
        gsap.set(shapeE, { morphSVG: { shape: targetE } })
        gsap.set(shapeN, { morphSVG: { shape: targetN } })
        return undefined
      }

      // Intro animation for page entry (run once)
      const tlIntro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tlIntro
        .to(network, { autoAlpha: 1, duration: 0.8 }, 0.1)
        .to(nav, { autoAlpha: 1, duration: 0.45 }, 0.6)
        .to(items, { autoAlpha: 1, y: 0, duration: 0.58, stagger: 0.14 }, 0.7)

      // Morphing animation for the logo shapes (runs once, simultaneously)
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
          STREAMING VALUE.
          <br />
          PROVING WORK.
        </p>
        <h1 data-hero-reveal>
          <span>WORK HAPPENS CONTINUOUSLY.</span>
          <span>PAYMENT SHOULD TOO.</span>
        </h1>
        <p className="hero-copy__body" data-hero-reveal>
          Aven streams payments in real time and turns completed work into permanent,
          verifiable proof.
        </p>
        <div data-hero-reveal>
          <LiveStreamCounter />
        </div>
        <div className="hero-actions" data-hero-reveal>
          <button onClick={() => scrollToTarget('stream')}>START A STREAM</button>
          <button onClick={() => scrollToTarget('protocol')}>EXPLORE PROTOCOL</button>
        </div>
      </div>
    </section>
  )
}
