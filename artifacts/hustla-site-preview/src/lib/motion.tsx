import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'wouter';

export function useScrollReveal() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const showAll = () => document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)').forEach((node) => node.classList.add('is-visible'));
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      showAll();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
    const watch = () => document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)').forEach((node) => observer.observe(node));
    watch();
    const mutations = new MutationObserver(watch);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); mutations.disconnect(); };
  }, [location]);
}

export const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1300);
        setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(node);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{value}{suffix}</span>;
}
