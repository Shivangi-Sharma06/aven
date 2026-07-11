import { ScrollSmoother } from '../../lib/gsap'

function scrollToTarget(id) {
  const target = document.getElementById(id)
  const smoother = ScrollSmoother.get()

  if (smoother && target) {
    smoother.scrollTo(target, true, 'top top')
    return
  }

  target?.scrollIntoView({ behavior: 'smooth' })
}

export default function FinalCTA() {
  return (
    <section className="aven-section final-cta">
      <div className="section-kicker">08 / START</div>
      <h2>
        THE INTERNET HAS IDENTITY.
        <br />
        IT HAS MONEY.
        <br />
        AVEN CONNECTS WORK TO BOTH.
      </h2>
      <div className="hero-actions">
        <button onClick={() => scrollToTarget('stream')}>START A STREAM</button>
        <button onClick={() => scrollToTarget('protocol')}>EXPLORE THE PROTOCOL</button>
      </div>
    </section>
  )
}
