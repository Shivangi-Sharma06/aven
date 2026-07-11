"use client";

import { useRef } from "react";
import { ScrollSmoother, ScrollTrigger, useGSAP } from "@/lib/gsap";

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

      const smoother = ScrollSmoother.create({
        wrapper: wrapperRef.current,
        content: contentRef.current,
        smooth: 0.9,
        effects: false,
        normalizeScroll: false,
      });

      onReady?.();

      const refreshFrame = requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });

      return () => {
        cancelAnimationFrame(refreshFrame);
        smoother.kill();
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
