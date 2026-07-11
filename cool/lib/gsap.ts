import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { Observer } from 'gsap/Observer'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(
  useGSAP,
  MorphSVGPlugin,
  MotionPathPlugin,
  Observer,
  ScrollSmoother,
  ScrollToPlugin,
  ScrollTrigger,
  SplitText
)

gsap.defaults({
  duration: 0.6,
  ease: 'power3.out',
})

ScrollTrigger.config({
  ignoreMobileResize: true,
})

export {
  gsap,
  useGSAP,
  MorphSVGPlugin,
  MotionPathPlugin,
  Observer,
  ScrollSmoother,
  ScrollToPlugin,
  ScrollTrigger,
  SplitText,
}
