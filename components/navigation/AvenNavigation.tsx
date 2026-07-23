'use client'

import { Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ScrollSmoother } from '../../lib/gsap'

const navItems = [
  ['HOW IT WORKS', 'how-it-works'],
  ['PROTOCOL', 'protocol'],
  ['DEVELOPERS', 'developers'],
] as const

function scrollToTarget(id: string) {
  const target = document.getElementById(id)
  const smoother = ScrollSmoother.get()

  if (smoother && target) {
    smoother.scrollTo(target, true, 'top top')
    return
  }

  target?.scrollIntoView({ behavior: 'smooth' })
}

export default function AvenNavigation() {
  const router = useRouter()

  return (
    <nav className="aven-nav" aria-label="Primary navigation">
      <button className="aven-nav__brand" onClick={() => scrollToTarget('hero')}>
        <svg viewBox="0 0 256 256" aria-hidden="true">
          <path d="M256 256H128L0 128h128ZM256 128H128L0 0h128Z" />
        </svg>
        <span>AVEN</span>
      </button>

      <div className="aven-nav__links">
        {navItems.map(([label, id], index) => (
          <button className={index === 0 ? 'is-active' : undefined} key={id} onClick={() => scrollToTarget(id)}>
            {label}
          </button>
        ))}
        <a href="https://heyaven09.mintlify.site/" target="_blank" rel="noopener noreferrer">
          DOCS ↗
        </a>
      </div>

      <button className="aven-nav__launch" onClick={() => router.push('/dashboard')}>
        LAUNCH APP
      </button>

      <button className="aven-nav__menu" aria-label="Open navigation">
        <Menu aria-hidden="true" size={22} strokeWidth={1.7} />
      </button>
    </nav>
  )
}
