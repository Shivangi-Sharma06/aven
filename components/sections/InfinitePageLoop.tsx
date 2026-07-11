"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { gsap, ScrollSmoother, ScrollTrigger, useGSAP } from "@/lib/gsap";

export type InfinitePagePanel = {
  id: string;
  content: ReactNode;
  dense?: boolean;
};

type InfinitePageLoopProps = {
  enabled: boolean;
  panels: InfinitePagePanel[];
};

export default function InfinitePageLoop({ enabled, panels }: InfinitePageLoopProps) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || !enabled) return;

      const media = gsap.matchMedia();

      media.add("(min-width: 769px)", () => {
        const panelElements = gsap.utils.toArray<HTMLElement>("[data-loop-panel]", root);
        if (panelElements.length < 2) return;

        const pinTriggers = panelElements.map((panel, index) =>
          ScrollTrigger.create({
            id: `aven-page-panel-${index}`,
            trigger: panel,
            start: "top top",
            end: "bottom top",
            pin: true,
            pinSpacing: false,
            refreshPriority: index,
          })
        );

        let maxScroll = 0;
        let wrapping = false;
        const smoother = ScrollSmoother.get();

        const pageTrigger = ScrollTrigger.create({
          id: "aven-page-loop-snap",
          trigger: root,
          start: "top top",
          end: "bottom bottom",
          snap: {
            snapTo(value) {
              const increment = 1 / (panelElements.length - 1);
              const snapped = gsap.utils.snap(increment, value);

              if (maxScroll <= 2) return snapped;
              if (snapped <= 0) return 2 / maxScroll;
              if (snapped >= 1) return (maxScroll - 2) / maxScroll;
              return snapped;
            },
            duration: { min: 0.18, max: 0.45 },
            delay: 0.08,
            ease: "power1.inOut",
          },
        });

        const getScroll = () => smoother?.scrollTop() ?? pageTrigger.scroll();
        const setScroll = (value: number) => {
          if (smoother) smoother.scrollTop(value);
          else pageTrigger.scroll(value);
          ScrollTrigger.update();
        };

        const updateMaxScroll = () => {
          maxScroll = Math.max(0, ScrollTrigger.maxScroll(window) - 1);
        };

        let previousScroll = getScroll();

        const onScroll = () => {
          if (wrapping || maxScroll <= 2) return;

          const scroll = getScroll();
          const direction = scroll - previousScroll;
          previousScroll = scroll;

          let destination: number | null = null;
          if (direction > 0 && scroll >= maxScroll) destination = 2;
          if (direction < 0 && scroll <= 0) destination = maxScroll - 2;
          if (destination === null) return;

          wrapping = true;
          previousScroll = destination;
          setScroll(destination);
          requestAnimationFrame(() => {
            wrapping = false;
          });
        };

        updateMaxScroll();
        window.addEventListener("resize", updateMaxScroll);
        window.addEventListener("scroll", onScroll, { passive: true });

        const refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());

        return () => {
          cancelAnimationFrame(refreshFrame);
          window.removeEventListener("resize", updateMaxScroll);
          window.removeEventListener("scroll", onScroll);
          pageTrigger.kill();
          pinTriggers.forEach((trigger) => trigger.kill());
        };
      });

      return () => media.revert();
    },
    { scope: rootRef, dependencies: [enabled], revertOnUpdate: true }
  );

  return (
    <main ref={rootRef} className="infinite-page-loop">
      {panels.map((panel) => (
        <section
          className={`loop-panel loop-panel--${panel.id}${panel.dense ? " loop-panel--dense" : ""}`}
          data-loop-panel
          data-panel-id={panel.id}
          key={panel.id}
        >
          {panel.content}
        </section>
      ))}

      <section
        className="loop-panel loop-panel--hero loop-panel--duplicate"
        data-loop-panel
        data-duplicate="true"
        aria-hidden="true"
      >
        <div className="loop-hero-duplicate">
          <span>STREAMING VALUE · PROVING WORK</span>
          <strong>AVEN</strong>
          <p>THE ECONOMIC LAYER FOR VERIFIED WORK.</p>
        </div>
      </section>
    </main>
  );
}
