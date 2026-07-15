import LiveStreamCounter from '../hero/LiveStreamCounter'

export default function LiveStreamDemo() {
  return (
    <section className="aven-section stream-section" id="stream">
      <div className="section-kicker">02 / STREAM</div>
      <div className="section-layout section-layout--center">
        <div>
          <h2>PAYMENT THAT KEEPS PACE.</h2>
          <p className="section-copy">
            No invoices to chase. No payday to wait for. Aven calculates what has been
            earned from the agreed rate and elapsed time, directly on Stellar.
          </p>
        </div>
        <div className="section-visual stream-terminal">
          <div className="terminal-row terminal-row--title">
            <span>ACTIVE STREAM</span>
            <strong>FRONTEND DEVELOPMENT</strong>
          </div>
          <div className="terminal-grid">
            <span>FROM</span>
            <strong>GBX...84A</strong>
            <span>TO</span>
            <strong>GDK...21F</strong>
          </div>
          <LiveStreamCounter compact />
          <div className="wide-payment-line" aria-hidden="true">
            <span />
          </div>
          <div className="terminal-grid terminal-grid--three">
            <span>STATUS</span>
            <strong>● STREAMING</strong>
            <span>ELAPSED</span>
            <strong>18 DAYS · 04 HOURS · 22 MINUTES</strong>
            <span>AVAILABLE TO WITHDRAW</span>
            <strong>$1,248.38</strong>
          </div>
        </div>
      </div>
    </section>
  )
}
