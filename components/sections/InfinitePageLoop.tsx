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
        const panelElements = gsap.utils.toArray<HTMLElement>("[data-aven-layered-panel]", root);
        if (panelElements.length < 2) return;

        const firstPanelCopy = panelElements[0].cloneNode(true) as HTMLElement;
        firstPanelCopy.setAttribute("data-duplicate", "true");
        firstPanelCopy.setAttribute("aria-hidden", "true");
        firstPanelCopy.setAttribute("inert", "");
        firstPanelCopy.style.pointerEvents = "none";
        root.appendChild(firstPanelCopy);

        gsap.set(
          firstPanelCopy.querySelectorAll<HTMLElement>("[data-hero-reveal], .aven-network-wrap"),
          { autoAlpha: 1, y: 0 }
        );

        const syncFirstPanelCopy = window.setTimeout(() => {
          const refreshedFirstPanel = panelElements[0].cloneNode(true) as HTMLElement;
          firstPanelCopy.replaceChildren(...Array.from(refreshedFirstPanel.childNodes));
          gsap.set(
            firstPanelCopy.querySelectorAll<HTMLElement>("[data-hero-reveal], .aven-network-wrap"),
            { autoAlpha: 1, y: 0 }
          );
        }, 2100);

        const triggers: ScrollTrigger[] = [];
        const navigation = document.querySelector<HTMLElement>(".aven-nav");
        let navigationVisibleState: boolean | null = null;

        const setNavigationVisible = (visible: boolean) => {
          if (!navigation) return;
          if (navigationVisibleState === visible) return;
          navigationVisibleState = visible;

          gsap.to(navigation, {
            autoAlpha: visible ? 1 : 0,
            yPercent: visible ? 0 : -100,
            pointerEvents: visible ? "auto" : "none",
            duration: 0.35,
            ease: "power2.out",
            overwrite: "auto",
          });
        };

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

        const syncNavigation = () => {
          const scroll = pageScrollTrigger.scroll();
          setNavigationVisible(scroll < panelElements[0].offsetHeight - 2);
        };

        const wrapTo = (position: number) => {
          pageScrollTrigger.scroll(position);
          ScrollTrigger.update();
          syncNavigation();
        };

        const onResize = () => {
          maxScroll = ScrollTrigger.maxScroll(window) - 1;
        };

        const onScroll = (event: Event) => {
          const scroll = pageScrollTrigger.scroll();
          syncNavigation();

          if (scroll >= maxScroll) {
            wrapTo(1);
            if (event.cancelable) event.preventDefault();
          } else if (scroll < 1) {
            wrapTo(maxScroll - 1);
            if (event.cancelable) event.preventDefault();
          }
        };

        const onWheel = (event: WheelEvent) => {
          const scroll = pageScrollTrigger.scroll();
          const projectedScroll = scroll + event.deltaY;

          if (event.deltaY > 0 && projectedScroll >= maxScroll) {
            wrapTo(1);
            event.preventDefault();
          } else if (event.deltaY < 0 && projectedScroll < 1) {
            wrapTo(maxScroll - 1);
            event.preventDefault();
          }
        };

        onResize();
        syncNavigation();
        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onScroll, { passive: false });
        window.addEventListener("wheel", onWheel, { passive: false });
        const refreshFrame = requestAnimationFrame(() => {
          ScrollTrigger.refresh();
          onResize();
        });

        return () => {
          window.clearTimeout(syncFirstPanelCopy);
          cancelAnimationFrame(refreshFrame);
          window.removeEventListener("resize", onResize);
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("wheel", onWheel);
          triggers.forEach((trigger) => trigger.kill());
          firstPanelCopy.remove();
          if (navigation) {
            gsap.killTweensOf(navigation);
            gsap.set(navigation, { clearProps: "opacity,visibility,transform,pointerEvents" });
          }
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
    </main>
  );
}
