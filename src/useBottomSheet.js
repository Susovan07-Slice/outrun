/**
 * Drag behaviour for the phone bottom sheet (details panel).
 *
 * The sheet has three snap points: 'peek' (name + tabs), 'half' and 'full'. While a finger
 * drags the handle the sheet follows it directly (no CSS transition); on release it snaps to
 * the nearest point, or one step in the flick direction when the release is fast. A tap with
 * no movement toggles between peek and half.
 */

import { useRef } from 'react';

export const SHEET_ORDER = ['peek', 'half', 'full'];
const FLICK_PX_PER_MS = 0.5;
const TAP_SLOP = 6;

function snapHeights(sheetEl) {
  const atlas = sheetEl.closest('.atlas');
  // Resolve each CSS length (dvh, calc) to pixels by measuring a hidden probe.
  const px = (name) => {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;height:var(${name})`;
    atlas.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  };
  return { peek: px('--sheet-peek'), half: px('--sheet-half'), full: px('--sheet-full') };
}

export function useBottomSheet(sheet, onSheetChange, enabled) {
  const sheetRef = useRef(null);
  const drag = useRef(null);

  const onPointerDown = (e) => {
    if (!enabled || !sheetRef.current || e.button > 0) return;
    // Buttons inside the header keep their own clicks; the handle itself can also be dragged.
    const fromHandle = Boolean(e.target.closest('.sheet-handle'));
    if (!fromHandle && e.target.closest('button, a, input')) return;
    const el = sheetRef.current;
    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      startH: el.getBoundingClientRect().height,
      lastY: e.clientY,
      lastT: e.timeStamp,
      v: 0,
      moved: false,
      fromHandle,
      snaps: snapHeights(el),
    };
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) < TAP_SLOP) return;
    if (!d.moved) {
      // Capture only once it is a drag, so a plain tap still clicks the handle button.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      d.moved = true;
    }
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const h = Math.min(d.snaps.full, Math.max(d.snaps.peek * 0.6, d.startH - dy));
    sheetRef.current.classList.add('is-dragging');
    sheetRef.current.style.height = `${h}px`;
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    const el = sheetRef.current;
    el.classList.remove('is-dragging');
    el.style.height = '';
    if (!d.moved) {
      // A tap on the handle is handled by its own click (also reachable by keyboard).
      if (!d.fromHandle) onSheetChange(sheet === 'peek' ? 'half' : 'peek');
      return;
    }
    const h = el.getBoundingClientRect().height;
    let next;
    if (Math.abs(d.v) > FLICK_PX_PER_MS) {
      const i = SHEET_ORDER.indexOf(sheet);
      next = SHEET_ORDER[Math.max(0, Math.min(2, i + (d.v < 0 ? 1 : -1)))];
    } else {
      next = SHEET_ORDER.reduce((best, k) => (Math.abs(d.snaps[k] - h) < Math.abs(d.snaps[best] - h) ? k : best), 'peek');
    }
    onSheetChange(next);
  };

  return {
    sheetRef,
    handleProps: enabled
      ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
      : {},
  };
}
