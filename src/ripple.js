// Pointer ripple for any element marked [data-ripple] (design system: Button, IconButton, SegmentedControl…).
export function installRipple() {
  if (typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.('[data-ripple]');
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const s = Math.max(r.width, r.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'o-ripple';
    dot.style.width = dot.style.height = `${s}px`;
    dot.style.left = `${e.clientX - r.left - s / 2}px`;
    dot.style.top = `${e.clientY - r.top - s / 2}px`;
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 560);
  });
}
