import LiveStreamCounter from '../hero/LiveStreamCounter'

export default function LiveStreamDemo() {
  return (
    <section className="aven-section stream-section" id="stream">
      <div className="section-kicker">02 / STREAM</div>
      <div className="section-layout section-layout--center">
        <div>
          <h2>PAYMENT FOR TIME ACTUALLY WORKED.</h2>
          <p className="section-copy">
            The Aven npm package measures active work time. The contract releases only
            that measured time at the agreed rate—never idle ledger time.
          </p>
        </div>
        <div className="section-visual stream-terminal">
          <div className="terminal-row terminal-row--title">
            <span>FUNDED WORK</span>
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
            <strong>● SESSION VERIFIED</strong>
            <span>ACTIVE TIME</span>
            <strong>04 HOURS · 22 MINUTES</strong>
            <span>APPROVED TO WITHDRAW</span>
            <strong>$1,248.38</strong>
          </div>
        </div>
      </div>
    </section>
  )
}
