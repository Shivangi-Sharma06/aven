'use client'

import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

gsap.registerPlugin(useGSAP)

const proofDetails = [
  ['ARTIFACT', 'SOROBAN ESCROW V1.4'],
  ['COMMIT', '8C12...0FA9'],
  ['REVIEW', '4 / 4 PASSED'],
]

export default function WorkAttestations() {
  const sectionRef = useRef<HTMLElement>(null)
  const proofTrackRef = useRef<HTMLDivElement>(null)
  const proofSignalRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()

      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.to('.attestation-seal__orbit', {
          rotation: 360,
          duration: 16,
          ease: 'none',
          repeat: -1,
          transformOrigin: '50% 50%',
        })

        gsap.fromTo(
          proofSignalRef.current,
          { x: 0 },
          {
            x: () => proofTrackRef.current?.clientWidth ?? 0,
            duration: 3.2,
            ease: 'power1.inOut',
            repeat: -1,
            repeatDelay: 0.35,
            repeatRefresh: true,
          },
        )

        gsap.to('.attestation-card__scan', {
          yPercent: 1300,
          duration: 4.5,
          ease: 'none',
          repeat: -1,
          repeatDelay: 1.2,
        })

        gsap.to('.attestation-status__dot', {
          scale: 1.65,
          autoAlpha: 0.25,
          duration: 0.9,
          ease: 'power1.out',
          repeat: -1,
        })
      })

      media.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('.attestation-seal__orbit', { rotation: 0 })
        gsap.set(proofSignalRef.current, { x: 0 })
        gsap.set('.attestation-card__scan', { autoAlpha: 0 })
      })

      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} className="aven-section attestation-section">
      <div className="section-kicker">03 / ATTESTATIONS</div>
      <div className="section-layout section-layout--center">
        <div>
          <h2>A RECEIPT FOR REAL WORK.</h2>
          <p className="section-copy">
            Each released npm work session creates a record both sides can
            verify—without asking a platform to vouch for them.
          </p>
          <p className="loud-copy">
            WHAT SHIPPED.
            <br />
            HOW IT WAS CHECKED.
            <br />
            WHO ACCEPTED IT.
            <br />
            PROVABLE FOREVER.
          </p>
        </div>

        <article className="section-visual attestation-card">
          <i className="attestation-card__scan" aria-hidden="true" />

          <header className="attestation-card__header">
            <div>
              <span>AVEN / DELIVERY PROOF</span>
              <strong>ATT-7F2A-91C8</strong>
            </div>
            <div className="attestation-status">
              <i className="attestation-status__dot" aria-hidden="true" />
              <span>MINTED / FINAL</span>
            </div>
          </header>

          <div className="attestation-card__hero">
            <div className="attestation-seal" aria-label="Verified work attestation">
              <svg
                className="attestation-seal__orbit"
                viewBox="0 0 160 160"
                aria-hidden="true"
              >
                <defs>
                  <path
                    id="attestation-seal-path"
                    d="M80,80 m-60,0 a60,60 0 1,1 120,0 a60,60 0 1,1 -120,0"
                  />
                </defs>
                <text>
                  <textPath href="#attestation-seal-path">
                    AVEN VERIFIED WORK • STELLAR ATTESTATION •
                  </textPath>
                </text>
              </svg>
              <strong>A</strong>
              <small>VERIFIED</small>
            </div>

            <div className="attestation-card__amount">
              <span>FINAL OUTCOME</span>
              <strong className="attestation-card__outcome">
                DELIVERY
                <br />
                ACCEPTED
              </strong>
              <small>CLIENT SIGNED / IMMUTABLE</small>
            </div>
          </div>

          <div className="attestation-card__route">
            <div>
              <span>SOURCE SIGNAL</span>
              <strong>NPM WORK LOG</strong>
            </div>
            <i aria-hidden="true">→</i>
            <div>
              <span>PROOF OBJECT</span>
              <strong>STELLAR ATTESTATION</strong>
            </div>
          </div>

          <dl className="attestation-card__proof">
            {proofDetails.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div className="attestation-card__rail" aria-hidden="true">
            <div className="attestation-card__rail-labels">
              <span>WORK CAPTURED</span>
              <span>SCOPE REVIEWED</span>
              <span>PROOF MINTED</span>
            </div>
            <div ref={proofTrackRef} className="attestation-card__track">
              <i ref={proofSignalRef} />
            </div>
          </div>

          <footer className="attestation-card__footer">
            <span>EVIDENCE / 12 EVENTS · 4 COMMITS · 0 DISPUTES</span>
            <code>CONTRACT CAZ5...34NXD</code>
          </footer>
        </article>
      </div>
    </section>
  )
}
