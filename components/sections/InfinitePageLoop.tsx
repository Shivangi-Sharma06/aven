"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

export type InfinitePagePanel = {
  id: string;
  content: ReactNode;
  dense?: boolean;
};

type InfinitePageLoopProps = { panels: InfinitePagePanel[] };

export default function InfinitePageLoop({ panels }: InfinitePageLoopProps) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const media = gsap.matchMedia();

      media.add("(min-width: 769px)", () => {
        const renderedPanels = gsap.utils.toArray<HTMLElement>("[data-aven-layered-panel]", root);
        const panelElements = renderedPanels.filter((panel) => !panel.hasAttribute("data-duplicate"));
        if (panelElements.length < 2) return;

        const triggers: ScrollTrigger[] = [];

        panelElements.forEach((panel) => {
          triggers.push(
          ScrollTrigger.create({
            trigger: panel,
            start: "top top",
            pin: true,
            pinSpacing: false,
          })
          );
        });

        let maxScroll = 0;

        const pageScrollTrigger = ScrollTrigger.create({
          snap(value) {
            const snappedValue = gsap.utils.snap(1 / panelElements.length, value);

            if (maxScroll <= 0) return snappedValue;
            if (snappedValue <= 0) return 1.05 / maxScroll;
            if (snappedValue >= 1) return maxScroll / (maxScroll + 1.05);
            return snappedValue;
          },
        });

        triggers.push(pageScrollTrigger);

        const onResize = () => {
          maxScroll = ScrollTrigger.maxScroll(window) - 1;
        };

        const onScroll = (event: Event) => {
          const scroll = pageScrollTrigger.scroll();

          if (scroll > maxScroll) {
            pageScrollTrigger.scroll(1);
            if (event.cancelable) event.preventDefault();
          } else if (scroll < 1) {
            pageScrollTrigger.scroll(maxScroll - 1);
            if (event.cancelable) event.preventDefault();
          }
        };

        onResize();
        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onScroll, { passive: false });
        const refreshFrame = requestAnimationFrame(() => {
          onResize();
          ScrollTrigger.refresh();
        });

        return () => {
          cancelAnimationFrame(refreshFrame);
          window.removeEventListener("resize", onResize);
          window.removeEventListener("scroll", onScroll);
          triggers.forEach((trigger) => trigger.kill());
        };
      });

      return () => media.revert();
    },
    { scope: rootRef }
  );

  return (
    <main ref={rootRef} className="aven-layered-loop">
      {panels.map((panel, index) => (
        <section
          className={`aven-layered-panel aven-layered-panel--${panel.id}${panel.dense ? " aven-layered-panel--dense" : ""}${index === panels.length - 1 ? " aven-layered-panel--final" : ""}`}
          data-aven-layered-panel
          data-panel-id={panel.id}
          data-theme={index % 2 === 0 ? "light" : "dark"}
          data-final-panel={index === panels.length - 1 ? "true" : undefined}
          key={panel.id}
        >
          {panel.content}
        </section>
      ))}

      <section
        className="aven-layered-panel aven-layered-panel--hero aven-layered-panel--duplicate"
        data-aven-layered-panel
        data-duplicate="true"
        data-theme="light"
        aria-hidden="true"
      >
        <div className="aven-layered-hero-copy">
          <span>STREAMING VALUE · PROVING WORK</span>
          <strong>AVEN</strong>
          <p>THE ECONOMIC LAYER FOR VERIFIED WORK.</p>
        </div>
      </section>
    </main>
  );
}
