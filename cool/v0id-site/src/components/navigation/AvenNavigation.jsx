import { ScrollSmoother } from '../../lib/gsap'

const navItems = [
  ['HOW IT WORKS', 'how-it-works'],
  ['PROTOCOL', 'protocol'],
  ['DEVELOPERS', 'developers'],
]

function scrollToTarget(id) {
  const target = document.getElementById(id)
  const smoother = ScrollSmoother.get()

  if (smoother && target) {
    smoother.scrollTo(target, true, 'top top')
    return
  }

  target?.scrollIntoView({ behavior: 'smooth' })
}

export default function AvenNavigation() {
  return (
    <nav className="aven-nav" aria-label="Primary navigation">
      <button className="aven-nav__brand" onClick={() => scrollToTarget('hero')}>
        AVEN
      </button>
      <div className="aven-nav__links">
        {navItems.map(([label, id]) => (
          <button key={id} onClick={() => scrollToTarget(id)}>
            {label}
          </button>
        ))}
      </div>
      <button className="aven-nav__launch" onClick={() => scrollToTarget('stream')}>
        LAUNCH APP ↗
      </button>
    </nav>
  )
}
