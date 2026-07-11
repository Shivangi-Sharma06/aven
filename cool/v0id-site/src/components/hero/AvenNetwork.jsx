import { useRef } from 'react'
import { gsap, ScrollTrigger, useGSAP } from '../../lib/gsap'
import { networkNodes, networkPaths } from './networkData'
const desktopParticles = [
  { pathId: 'p1', duration: 4.8, delay: 0.2, radius: 3.6 },
  { pathId: 'p3', duration: 5.6, delay: 1.1, radius: 3.2 },
  { pathId: 'p5', duration: 4.4, delay: 0.6, radius: 3.4 },
  { pathId: 'p8', duration: 5.2, delay: 1.7, radius: 3.1 },
]

const mobileParticles = desktopParticles.slice(0, 2)
const breathingNodeIndexes = new Set([1, 6, 8, 12])
export default function AvenNetwork() {
  const rootRef = useRef(null)

  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return undefined

      const mm = gsap.matchMedia()
      const links = gsap.utils.toArray('[data-link]', root)
      const nodes = gsap.utils.toArray('[data-node]', root)
      const particles = gsap.utils.toArray('[data-particle]', root)
      const depthLayers = gsap.utils.toArray('[data-depth-layer]', root)

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(links, { opacity: 0.18, strokeDashoffset: 0, clearProps: 'strokeDasharray' })
        gsap.set(nodes, { opacity: 1, scale: 1 })
        gsap.set(particles, { opacity: 0 })
      })

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const continuous = []

        links.forEach((path) => {
          const length = path.getTotalLength()
          gsap.set(path, {
            strokeDasharray: length,
            strokeDashoffset: length,
          })
        })

        gsap.set(nodes, {
          opacity: 0,
          scale: 0,
          transformOrigin: '50% 50%',
        })
        gsap.set(particles, { opacity: 0 })

        const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
        intro
          .to(nodes, {
            opacity: 1,
            scale: 1,
            duration: 0.75,
            stagger: { each: 0.035, from: 'random' },
          })
          .to(
            links,
            {
              strokeDashoffset: 0,
              duration: 1.3,
              stagger: 0.025,
              ease: 'power2.inOut',
            },
            '-=0.4'
          )
          .to(
            particles,
            {
              opacity: 1,
              duration: 0.35,
              stagger: 0.06,
            },
            '-=0.4'
          )
        const isMobile = window.matchMedia('(max-width: 768px)').matches

        if (!isMobile) {
          nodes.forEach((node, index) => {
            if (!breathingNodeIndexes.has(index)) return

            continuous.push(
              gsap.to(node, {
                scale: index % 3 === 0 ? 1.12 : 1.08,
                duration: 2.2 + (index % 4) * 0.22,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
                delay: index * 0.16,
              })
            )
          })
        }

        const activeParticles = isMobile ? mobileParticles : desktopParticles

        activeParticles.forEach((config, index) => {
          const particle = particles[index]
          const path = root.querySelector(`#${config.pathId}`)
          if (!particle || !path) return

          continuous.push(
            gsap.to(particle, {
              duration: config.duration,
              delay: config.delay,
              repeat: -1,
              repeatDelay: 0.35 + (index % 3) * 0.2,
              ease: 'none',
              motionPath: {
                path,
                align: path,
                alignOrigin: [0.5, 0.5],
                autoRotate: false,
              },
            })
          )
        })

        particles.slice(activeParticles.length).forEach((particle) => {
          gsap.set(particle, { opacity: 0 })
        })

        const strongLinks = gsap.utils.toArray("[data-strong='true']", root)
        const pulseCount = isMobile ? 0 : 1

        strongLinks.slice(0, pulseCount).forEach((path, index) => {
          continuous.push(
            gsap.timeline({
              repeat: -1,
              repeatDelay: 8.5 + index * 1.6,
              delay: 2.5 + index * 0.45,
            })
              .to(path, {
                opacity: 0.48,
                strokeWidth: 1.8,
                duration: 0.35,
                ease: 'power2.out',
              })
              .to(path, {
                opacity: 0.22,
                strokeWidth: 1.15,
                duration: 1.6,
                ease: 'power2.out',
              })
          )
        })

        let isHeroActive = true
        let listenerAttached = false
        let attachListener = null
        let detachListener = null

        const allowParallax = !isMobile && window.matchMedia('(hover: hover) and (pointer: fine)').matches
        if (allowParallax && depthLayers.length) {
          const movers = depthLayers.map((layer) => ({
            depth: Number(layer.dataset.depthLayer || 1),
            xTo: gsap.quickTo(layer, 'x', { duration: 0.8, ease: 'power3.out' }),
            yTo: gsap.quickTo(layer, 'y', { duration: 0.8, ease: 'power3.out' }),
          }))

          const onPointerMove = (event) => {
            const x = event.clientX / window.innerWidth - 0.5
            const y = event.clientY / window.innerHeight - 0.5
            movers.forEach((mover) => {
              mover.xTo(x * 10 * mover.depth)
              mover.yTo(y * 6 * mover.depth)
            })
          }

          attachListener = () => {
            if (!listenerAttached && isHeroActive) {
              window.addEventListener('pointermove', onPointerMove, { passive: true })
              listenerAttached = true
            }
          }

          detachListener = () => {
            if (listenerAttached) {
              window.removeEventListener('pointermove', onPointerMove)
              listenerAttached = false
            }
          }

          // Initial attach
          attachListener()
        }

        const heroTrigger = ScrollTrigger.create({
          trigger: root.closest('.stage'),
          start: 'top bottom',
          end: 'bottom top',
          onToggle: ({ isActive }) => {
            isHeroActive = isActive
            continuous.forEach((animation) => (isActive ? animation.resume() : animation.pause()))
            if (isActive) {
              attachListener?.()
            } else {
              detachListener?.()
            }
          },
        })

        return () => {
          heroTrigger.kill()
          detachListener?.()
          continuous.forEach((animation) => animation.kill())
        }
      })

      return () => mm.revert()
    },
    { scope: rootRef }
  )

  return (
    <div ref={rootRef} className="aven-network-wrap" aria-hidden="true">
      <svg
        className="aven-network"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <defs>
          <pattern id="aven-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path className="aven-grid-line" d="M 80 0 L 0 0 0 80" />
          </pattern>
        </defs>

        <rect width="1600" height="900" fill="#fff" />
        <rect className="aven-network__grid" width="1600" height="900" fill="url(#aven-grid)" />

        <g data-depth-layer="0.45" className="network-depth network-depth--far">
          <g>
            {networkPaths.filter((_, index) => index % 3 === 0).map(([id, d, strong]) => (
              <path
                key={id}
                id={id}
                d={d}
                data-link
                data-strong={strong ? 'true' : 'false'}
                className="network-link"
              />
            ))}
          </g>
          <g>
            {networkNodes.filter((_, index) => index % 3 === 0).map(([x, y, r], index) => (
              <g
                key={`${x}-${y}`}
                data-node
                className="network-node"
                transform={`translate(${x} ${y})`}
              >
                <circle className="network-node__halo" r={r * 3.2} />
                <circle className="network-node__core" r={r} />
                <title>{`Wallet node ${index + 1}`}</title>
              </g>
            ))}
          </g>
        </g>

        <g data-depth-layer="0.8" className="network-depth network-depth--mid">
          <g>
            {networkPaths.filter((_, index) => index % 3 === 1).map(([id, d, strong]) => (
              <path
                key={id}
                id={id}
                d={d}
                data-link
                data-strong={strong ? 'true' : 'false'}
                className="network-link"
              />
            ))}
          </g>
          <g>
            {networkNodes.filter((_, index) => index % 3 === 1).map(([x, y, r], index) => (
              <g
                key={`${x}-${y}`}
                data-node
                className="network-node"
                transform={`translate(${x} ${y})`}
              >
                <circle className="network-node__halo" r={r * 3.2} />
                <circle className="network-node__core" r={r} />
                <title>{`Wallet node ${index + 1}`}</title>
              </g>
            ))}
          </g>
        </g>

        <g data-depth-layer="1.25" className="network-depth network-depth--near">
          <g>
            {networkPaths.filter((_, index) => index % 3 === 2).map(([id, d, strong]) => (
              <path
                key={id}
                id={id}
                d={d}
                data-link
                data-strong={strong ? 'true' : 'false'}
                className="network-link"
              />
            ))}
          </g>
          <g>
            {networkNodes.filter((_, index) => index % 3 === 2).map(([x, y, r], index) => (
              <g
                key={`${x}-${y}`}
                data-node
                className="network-node"
                transform={`translate(${x} ${y})`}
              >
                <circle className="network-node__halo" r={r * 3.2} />
                <circle className="network-node__core" r={r} />
                <title>{`Wallet node ${index + 1}`}</title>
              </g>
            ))}
          </g>

          <g>
            {desktopParticles.map((particle, index) => (
              <circle
                key={`${particle.pathId}-${index}`}
                data-particle
                className="payment-packet"
                r={particle.radius}
                cx="0"
                cy="0"
              />
            ))}
          </g>
        </g>
      </svg>
      <div className="aven-network-vignette" />
    </div>
  )
}
