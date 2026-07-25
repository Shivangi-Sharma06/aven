import Link from 'next/link'
import './landing.css'
import './landing-v2.css'

import AvenNavigation from '../components/navigation/AvenNavigation'
import AvenHero from '../components/hero/AvenHero'
import LiveStreamCounter from '../components/hero/LiveStreamCounter'

const workFlow = [
  {
    number: '01',
    title: 'Fund',
    copy: 'Lock the work budget before delivery begins. Terms stay visible to both sides.',
    meta: 'ESCROW READY',
  },
  {
    number: '02',
    title: 'Track',
    copy: 'The Aven npm package records active work sessions without paying for idle time.',
    meta: 'ACTIVE TIME',
  },
  {
    number: '03',
    title: 'Verify',
    copy: 'Each session becomes a reviewable proof record tied to the funded agreement.',
    meta: 'CLIENT REVIEW',
  },
  {
    number: '04',
    title: 'Release',
    copy: 'Approved work releases payment and leaves a portable attestation on Stellar.',
    meta: 'ON-CHAIN PROOF',
  },
] as const

const protocolRows = [
  {
    title: 'Funded agreements',
    copy: 'A stream defines the recipient, asset, budget, duration, and verification route before work begins.',
    tag: 'STELLAR ESCROW',
  },
  {
    title: 'Measured work sessions',
    copy: 'Workers run Aven from the repository. Tracked active seconds are submitted against the agreement.',
    tag: 'NPM WORK LAYER',
  },
  {
    title: 'Payment attestations',
    copy: 'Approved sessions produce a payment record that can be checked independently and carried into reputation.',
    tag: 'PORTABLE PROOF',
  },
] as const

export default function LandingPage() {
  return (
    <div className="app aven-home">
      <AvenNavigation />

      <main>
        <AvenHero />

        <div className="aven-home__content">
          <section className="hub-section" id="how-it-works">
            <header className="hub-section__header">
              <span>01</span>
              <h2>How it works</h2>
              <i aria-hidden="true" />
            </header>

            <div className="workflow-grid">
              {workFlow.map((step) => (
                <article className="workflow-card" key={step.number}>
                  <div className="workflow-card__top">
                    <span>{step.number}</span>
                    <small>{step.meta}</small>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="hub-section" id="proof">
            <header className="hub-section__header">
              <span>02</span>
              <h2>Proof in motion</h2>
              <i aria-hidden="true" />
            </header>

            <div className="proof-grid">
              <article className="proof-card proof-card--counter">
                <div className="proof-card__status">
                  <span><i aria-hidden="true" /> LIVE AGREEMENT</span>
                  <span>USDC / TESTNET</span>
                </div>
                <LiveStreamCounter compact />
              </article>

              <article className="proof-card proof-card--summary">
                <span className="proof-card__eyebrow">THE OUTPUT</span>
                <h3>One session.<br />Three durable records.</h3>
                <ul>
                  <li><span>01</span> measured active time</li>
                  <li><span>02</span> released payment</li>
                  <li><span>03</span> portable reputation</li>
                </ul>
              </article>
            </div>
          </section>

          <section className="hub-section" id="protocol">
            <header className="hub-section__header">
              <span>03</span>
              <h2>Protocol</h2>
              <i aria-hidden="true" />
            </header>

            <div className="protocol-list">
              {protocolRows.map((row, index) => (
                <details key={row.title}>
                  <summary>
                    <span className="protocol-list__number">0{index + 1}</span>
                    <strong>{row.title}</strong>
                    <small>{row.tag}</small>
                    <span className="protocol-list__toggle" aria-hidden="true">+</span>
                  </summary>
                  <p>{row.copy}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="hub-section" id="developers">
            <header className="hub-section__header">
              <span>04</span>
              <h2>For developers</h2>
              <i aria-hidden="true" />
            </header>

            <div className="developer-hub">
              <div className="developer-hub__copy">
                <span>AVEN WORK LAYER</span>
                <h3>Proof belongs inside the workflow.</h3>
                <p>
                  Add session tracking to a repository, submit verified work, and
                  connect delivery to settlement without rebuilding your product.
                </p>
                <div className="developer-hub__actions">
                  <a href="https://heyaven09.mintlify.site/" target="_blank" rel="noopener noreferrer">
                    READ THE DOCS ↗
                  </a>
                  <Link href="/dashboard">OPEN APP →</Link>
                </div>
              </div>

              <pre className="developer-hub__code" aria-label="Aven command example"><code><span>$</span> npm install aven-work-session{'\n'}<span>$</span> npx aven start{'\n'}<span>$</span> npx aven submit --ended</code></pre>
            </div>
          </section>

          <section className="home-cta" id="start">
            <span>05 / START</span>
            <h2>Fund the work.<br />Keep the proof.</h2>
            <p>Add session tracking to any repository with the Aven npm package.</p>
            <pre className="home-cta__code"><code><span>$</span> npm install aven-work-session{'\n'}<span>$</span> npx aven start{'\n'}<span>$</span> npx aven submit --ended</code></pre>
          </section>
        </div>
      </main>

      <footer className="home-footer">
        <div className="home-footer__brand">
          <svg viewBox="0 0 256 256" aria-hidden="true">
            <path d="M256 256H128L0 128h128ZM256 128H128L0 0h128Z" />
          </svg>
          AVEN
        </div>
        <div className="home-footer__tagline">PAY FOR PROGRESS · KEEP THE PROOF</div>
        <div className="home-footer__divider" />
        <div className="home-footer__links">
          <a href="https://x.com/avenprotocol" target="_blank" rel="noopener noreferrer">𝕏 / TWITTER</a>
          <a href="https://github.com/Shivangi-Sharma06/aven" target="_blank" rel="noopener noreferrer">GITHUB REPO</a>
          <a href="https://heyaven09.mintlify.site/" target="_blank" rel="noopener noreferrer">DOCS ↗</a>
        </div>
        <div className="home-footer__devs">
          Built by Shivangi Sharma & Kartikey Juyal
        </div>
      </footer>
    </div>
  )
}
