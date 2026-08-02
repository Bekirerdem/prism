import { useEffect } from "react";

/** Scroll-driven reveals for the landing page.
 *
 *  GSAP and Lenis are imported dynamically so they never reach the dashboard bundle — the
 *  same pattern passkey-kit uses. Everything is a no-op under `prefers-reduced-motion`, and
 *  the CSS only hides `.lp__reveal` when motion is allowed, so a failed import can never
 *  leave a blank page. */
export function useReveal(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // `.lp--pending` is what hides the elements. Whoever decides not to animate — reduced
    // motion, a failed import — must remove it, or the page stays blank.
    const root = document.querySelector(".lp");
    const reveal = () => root?.classList.remove("lp--pending");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      return;
    }

    let disposed = false;
    let dispose = () => {};

    void (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }, lenisMod] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
          import("lenis"),
        ]);
        if (disposed) {
          reveal();
          return;
        }

        gsap.registerPlugin(ScrollTrigger);

        const Lenis = lenisMod.default;
        const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
        const onScroll = () => ScrollTrigger.update();
        lenis.on("scroll", onScroll);

        let frame = 0;
        const raf = (time: number) => {
          lenis.raf(time);
          frame = requestAnimationFrame(raf);
        };
        frame = requestAnimationFrame(raf);

        const items = gsap.utils.toArray<HTMLElement>(".lp__reveal");
        const tweens = items.map((el, i) =>
          gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power2.out",
            // Cards in a row stagger; the blocked one lands last, which is the point.
            delay: (i % 3) * 0.08,
            scrollTrigger: { trigger: el, start: "top 86%", once: true },
          }),
        );

        dispose = () => {
          cancelAnimationFrame(frame);
          tweens.forEach((t) => t.scrollTrigger?.kill());
          tweens.forEach((t) => t.kill());
          lenis.off("scroll", onScroll);
          lenis.destroy();
        };
      } catch {
        // Animation is an enhancement; without it the page must still be readable.
        reveal();
      }
    })();

    return () => {
      disposed = true;
      dispose();
    };
  }, []);
}
