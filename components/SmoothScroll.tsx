"use client";

import { useRef } from "react";
import { gsap, ScrollSmoother, ScrollTrigger, useGSAP } from "@/lib/gsap";

type SmoothScrollProps = {
  children: React.ReactNode;
  onReady?: () => void;
};

export default function SmoothScroll({ children, onReady }: SmoothScrollProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!wrapperRef.current || !contentRef.current) return;

      ScrollSmoother.get()?.kill();
      window.history.scrollRestoration = "manual";
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      const media = gsap.matchMedia();
      let resetFrame = 0;
      let refreshFrame = 0;

      media.add(
        {
          desktop: "(min-width: 769px)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { desktop, reduceMotion } = context.conditions as {
            desktop: boolean;
            reduceMotion: boolean;
          };

          if (reduceMotion) {
            onReady?.();
            resetFrame = requestAnimationFrame(() => window.scrollTo(0, 0));
            return;
          }

          const smoother = ScrollSmoother.create({
            wrapper: wrapperRef.current!,
            content: contentRef.current!,
            smooth: desktop ? 1.6 : 0.8,
            effects: true,
            normalizeScroll: true,
          });

          smoother.scrollTop(0);
          onReady?.();
          resetFrame = requestAnimationFrame(() => {
            smoother.scrollTop(0);
            ScrollTrigger.refresh();
            refreshFrame = requestAnimationFrame(() => smoother.scrollTop(0));
          });

          return () => smoother.kill();
        },
      );

      return () => {
        cancelAnimationFrame(resetFrame);
        cancelAnimationFrame(refreshFrame);
        media.revert();
      };
    },
    { scope: wrapperRef, dependencies: [] }
  );

  return (
    <div id="smooth-wrapper" ref={wrapperRef}>
      <div id="smooth-content" ref={contentRef}>
        {children}
      </div>
    </div>
  );
}
