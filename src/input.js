export function createInputHandler(el, onDown, onUp) {
  let enabled = true;
  // every finger, mouse button and key currently holding the fart; it only
  // stops once all of them let go, so rolling from one thumb to the other
  // (or Space to Up) never drops Kurt
  const sources = new Set();
  const FART_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);

  function press(id) {
    const wasHeld = sources.size > 0;
    sources.add(id);
    if (!wasHeld) onDown();
  }

  function lift(id) {
    if (!sources.delete(id)) return;
    if (sources.size === 0) onUp();
  }

  function release() {
    if (sources.size === 0) return;
    sources.clear();
    onUp();
  }

  function handlePointerDown(e) {
    if (!enabled) return;
    e.preventDefault();
    press("p" + e.pointerId);
  }

  function handlePointerUp(e) {
    lift("p" + e.pointerId);
  }

  function handleKeyDown(e) {
    if (!enabled) return;
    if (FART_KEYS.has(e.code)) {
      e.preventDefault();
      if (!e.repeat) press(e.code);
    }
  }

  function handleKeyUp(e) {
    if (FART_KEYS.has(e.code)) lift(e.code);
  }

  function blockContextMenu(e) {
    e.preventDefault();
  }

  // iOS Safari can still raise its text-selection magnifier loupe on a
  // held touch even with pointerdown suppressed; blocking the raw touch
  // events too stops it at the source.
  function blockTouch(e) {
    e.preventDefault();
  }

  el.addEventListener("pointerdown", handlePointerDown, { passive: false });
  window.addEventListener("pointerup", handlePointerUp, { passive: true });
  window.addEventListener("pointercancel", handlePointerUp, { passive: true });
  window.addEventListener("blur", release);
  window.addEventListener("keydown", handleKeyDown, { passive: false });
  window.addEventListener("keyup", handleKeyUp, { passive: true });
  el.addEventListener("contextmenu", blockContextMenu);
  el.addEventListener("touchstart", blockTouch, { passive: false });
  el.addEventListener("touchend", blockTouch, { passive: false });
  el.addEventListener("touchcancel", blockTouch, { passive: false });
  document.addEventListener("touchmove", blockTouch, { passive: false });

  return {
    setEnabled(v) {
      enabled = v;
      if (!v) release();
    },
    destroy() {
      el.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("blur", release);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      el.removeEventListener("contextmenu", blockContextMenu);
      el.removeEventListener("touchstart", blockTouch);
      el.removeEventListener("touchend", blockTouch);
      el.removeEventListener("touchcancel", blockTouch);
      document.removeEventListener("touchmove", blockTouch);
    },
  };
}
