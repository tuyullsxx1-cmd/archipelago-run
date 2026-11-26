// input.js — keyboard + mouse controls for Archipelago Run.
// Keys: W/S throttle, arrows (or A/D) bank + pitch, Space flaps/brake,
// Enter start, R restart, P pause. Mouse: steer toward the pointer,
// wheel adjusts throttle, click starts / boosts.

const Input = (() => {
  const keys = new Set();
  // v6: keys pressed between frames. At low frame rates a quick tap's
  // keydown + keyup both land between two frames, so `keys` never holds
  // the key when the frame runs and the press is lost. `queued` keeps
  // every fresh press until the frame's consume() calls read it, and
  // endFrame() clears what nobody consumed — so a tap is never lost,
  // and a stale tap never fires a later menu.
  const queued = new Set();
  const mouse = { x: 640, y: 360, inside: false, down: false, clicked: false };
  let wheelDelta = 0;

  const GAME_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyP', 'Enter',
  ]);

  function onKeyDown(e) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) queued.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    const canvas = document.getElementById('gl');
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 1280;
    mouse.y = ((e.clientY - rect.top) / rect.height) * 720;
    mouse.inside = true;
  }
  function onMouseDown() { mouse.down = true; mouse.clicked = true; }
  function onMouseUp() { mouse.down = false; }
  function onWheel(e) {
    e.preventDefault();
    wheelDelta += e.deltaY;
  }
  function onBlur() {
    keys.clear();
    mouse.down = false;
  }

  function attach() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('blur', onBlur);
  }

  function pressed(code) { return keys.has(code); }

  /** Consume one pending press of a key (for menus), true when it was down. */
  function consume(code) {
    if (!queued.has(code)) return false;
    queued.delete(code);
    return true;
  }

  /** One pending click since the last frame (for menus). */
  function takeClick() {
    const c = mouse.clicked;
    mouse.clicked = false;
    return c;
  }

  /** End of frame: drop presses nobody consumed, so a stale tap never
   *  fires a later menu. Held keys are unaffected (they live in `keys`). */
  function endFrame() {
    queued.clear();
  }

  /** Wheel steps since last read, in throttle units. */
  function takeWheel() {
    const d = wheelDelta;
    wheelDelta = 0;
    return d;
  }

  return { keys, mouse, attach, pressed, consume, takeClick, endFrame, takeWheel };
})();
