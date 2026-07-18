'use client'

import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

gsap.registerPlugin(useGSAP)

const trustSignals = [
  ['DELIVERY RELIABILITY', '98%', 98],
  ['CLIENT APPROVAL', '100%', 100],
  ['SKILL CONFIDENCE', '91%', 91],
]

const proofSignals = [
  ['DISPUTES', '0'],
  ['REPEAT CLIENTS', '06'],
  ['VERIFIED SKILLS', '04'],
]

export default function Reputation() {
  const sectionRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()

      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          '.trust-passport__bar i',
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 1.1,
            ease: 'power3.out',
            stagger: 0.16,
            transformOrigin: 'left center',
          },
        )

        gsap.to('.trust-passport__pulse', {
          scale: 1.9,
          autoAlpha: 0,
          duration: 1.4,
          ease: 'power1.out',
          repeat: -1,
          repeatDelay: 0.5,
        })
      })

      media.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('.trust-passport__bar i', { scaleX: 1 })
        gsap.set('.trust-passport__pulse', { autoAlpha: 0 })
      })

      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} className="aven-section reputation-section">
      <div className="section-kicker">04 / REPUTATION</div>
      <div className="section-layout section-layout--center">
        <div>
          <h2>
            YOUR WORK HISTORY
            <br />
            SHOULD OUTLIVE
            <br />
            THE PLATFORM.
          </h2>
          <p className="section-copy">
            Aven turns confirmed delivery into a wallet-owned trust signal that other
            products can verify without importing ratings or private project data.
          </p>
          <p className="loud-copy">
            NO STAR RATINGS.
            <br />
            NO PLATFORM LOCK-IN.
            <br />
            JUST VERIFIABLE SIGNALS.
          </p>
        </div>

        <article className="section-visual trust-passport">
          <header className="trust-passport__header">
            <div>
              <span>AVEN / PORTABLE TRUST PASSPORT</span>
              <strong>KARTIKEY.AVEN</strong>
            </div>
            <div className="trust-passport__live">
              <i className="trust-passport__pulse" aria-hidden="true" />
              <i aria-hidden="true" />
              <span>WALLET OWNED</span>
            </div>
          </header>

          <div className="trust-passport__summary">
            <div className="trust-passport__score">
              <span>TRUST INDEX</span>
              <strong>842</strong>
              <small>/ 1000 · HIGH CONFIDENCE</small>
            </div>
            <div className="trust-passport__identity">
              <span>PUBLIC KEY</span>
              <strong>GDK4...21F</strong>
              <span>RECORD VERSION</span>
              <strong>AVEN-RP / 04</strong>
            </div>
          </div>

          <div className="trust-passport__signals">
            {trustSignals.map(([label, value, width]) => (
              <div key={label}>
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
                <div className="trust-passport__bar" aria-hidden="true">
                  <i style={{ width: `${width}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="trust-passport__proofs">
            {proofSignals.map(([label, value]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="trust-passport__skills">
            <span>VERIFIED CAPABILITIES</span>
            <div>
              <strong>SOROBAN</strong>
              <strong>SMART CONTRACTS</strong>
              <strong>FRONTEND</strong>
              <strong>SECURITY</strong>
            </div>
          </div>

          <footer className="trust-passport__footer">
            <span>RESOLVABLE ON STELLAR</span>
            <code>aven://reputation/GDK4...21F</code>
          </footer>
        </article>
      </div>
    </section>
  )
}
