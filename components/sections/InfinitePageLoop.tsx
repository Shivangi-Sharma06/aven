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

        let wrapping = false;
        let duplicateStart = 0;
        let resizeFrame = 0;
        const smoother = ScrollSmoother.get();

        const pageTrigger = ScrollTrigger.create({
          id: "aven-page-loop-snap",
          trigger: root,
          start: "top top",
          end: "bottom bottom",
          snap: {
            snapTo(value) {
              const increment = 1 / (panelElements.length - 1);
              return gsap.utils.snap(increment, value);
            },
            duration: 0.35,
            delay: 0.08,
            ease: "power2.out",
          },
        });

        const getScroll = () => smoother?.scrollTop() ?? pageTrigger.scroll();
        const setScroll = (value: number) => {
          if (smoother) smoother.scrollTop(value);
          else pageTrigger.scroll(value);
          ScrollTrigger.update();
        };

        const calculateBounds = () => {
          const duplicateTrigger = pinTriggers[pinTriggers.length - 1];
          duplicateStart = duplicateTrigger.start;
        };

        const wrapTo = (destination: number) => {
          if (wrapping) return;
          wrapping = true;
          setScroll(destination);
          requestAnimationFrame(() => {
            wrapping = false;
          });
        };

        const onWheel = (event: WheelEvent) => {
          if (wrapping || duplicateStart <= 2) return;
          const scroll = getScroll();

          if (event.deltaY > 0 && scroll >= duplicateStart - 1) {
            wrapTo(2);
          } else if (event.deltaY < 0 && scroll <= 1) {
            wrapTo(duplicateStart - 2);
          }
        };

        const onResize = () => {
          cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            ScrollTrigger.refresh();
            calculateBounds();
          });
        };

        calculateBounds();
        window.addEventListener("resize", onResize);
        window.addEventListener("wheel", onWheel, { passive: true });

        const refreshFrame = requestAnimationFrame(() => {
          ScrollTrigger.refresh();
          calculateBounds();
        });

        return () => {
          cancelAnimationFrame(refreshFrame);
          cancelAnimationFrame(resizeFrame);
          window.removeEventListener("resize", onResize);
          window.removeEventListener("wheel", onWheel);
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
      {panels.map((panel, index) => (
        <section
          className={`loop-panel loop-panel--${panel.id}${panel.dense ? " loop-panel--dense" : ""}`}
          data-loop-panel
          data-panel-id={panel.id}
          data-theme={index % 2 === 0 ? "light" : "dark"}
          key={panel.id}
        >
          {panel.content}
        </section>
      ))}

      <section
        className="loop-panel loop-panel--hero loop-panel--duplicate"
        data-loop-panel
        data-duplicate="true"
        data-theme="light"
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
