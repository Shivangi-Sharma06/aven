'use client'

import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

gsap.registerPlugin(useGSAP)

const streamDetails = [
  ['CATEGORY', 'FRONTEND'],
  ['BUDGET', '2,500.00'],
  ['DELIVERY', '14 DAYS'],
  ['REVIEW', 'CLIENT APPROVAL'],
]

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)
  const depositRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const activeDotRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()

      media.add('(prefers-reduced-motion: no-preference)', () => {
        const deposit = { value: 0 }
        const formatter = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })

        gsap.to(deposit, {
          value: 2500,
          duration: 0.8,
          ease: 'power1.out',
          repeat: -1,
          repeatDelay: 0.2,
          onUpdate: () => {
            if (depositRef.current) {
              depositRef.current.textContent = formatter.format(deposit.value)
            }
          },
        })

        gsap.fromTo(
          activeDotRef.current,
          { x: 0 },
          {
            x: () => trackRef.current?.clientWidth ?? 0,
            duration: 2.8,
            ease: 'none',
            repeat: -1,
            repeatDelay: 0.2,
            repeatRefresh: true,
          },
        )
      })

      media.add('(prefers-reduced-motion: reduce)', () => {
        if (depositRef.current) depositRef.current.textContent = '2,500.00'
        gsap.set(activeDotRef.current, { x: 0 })
      })

      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} className="aven-section how-section" id="how-it-works">
      <div className="section-kicker">01 / HOW IT WORKS</div>
      <div className="section-layout">
        <div>
          <h2>
            FROM AGREEMENT
            <br />
            TO EVIDENCE.
            <br />
            TO REPUTATION.
          </h2>
        </div>
        <div className="section-visual steps-grid">
          <article className="step-panel">
            <span>STEP 01</span>
            <h3>DEFINE THE AGREEMENT</h3>
            <p>
              Set the scope, delivery window, review terms, and funded budget before
              work begins.
            </p>
            <dl className="data-list">
              {streamDetails.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd ref={label === 'BUDGET' ? depositRef : undefined}>{value}</dd>
                </div>
              ))}
            </dl>
          </article>
          <article className="step-panel">
            <span>STEP 02</span>
            <h3>CAPTURE WORK EVIDENCE</h3>
            <p>
              The npm package records active time and Git metadata without uploading
              source files, screenshots, or keystrokes.
            </p>
            <div className="stream-line" aria-hidden="true">
              <span>REPOSITORY</span>
              <div ref={trackRef}>
                <i ref={activeDotRef} />
              </div>
              <span>WORK PROOF</span>
            </div>
          </article>
          <article className="step-panel">
            <span>STEP 03</span>
            <h3>TURN DELIVERY INTO TRUST</h3>
            <p>
              Approved delivery becomes a permanent attestation and updates a portable
              reputation record others can inspect.
            </p>
            <div className="proof-stack" aria-label="Stream completion flow">
              <strong>WORK LOG VERIFIED</strong>
              <strong>DELIVERY APPROVED</strong>
              <strong>ATTESTATION MINTED</strong>
              <strong>✓ REPUTATION UPDATED</strong>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
