// input.js — keyboard + mouse controls for Archipelago Run.
// Keys: W/S throttle, arrows (or A/D) bank + pitch, Space flaps/brake,
// Enter start, R restart, P pause. Mouse: steer toward the pointer,
// wheel adjusts throttle, click starts / boosts.

const Input = (() => {
  const keys = new Set();
  const mouse = { x: 640, y: 360, inside: false, down: false };
  let wheelDelta = 0;

  const GAME_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyP', 'Enter',
  ]);

  function onKeyDown(e) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    keys.add(e.code);
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    const canvas = document.getElementById('game');
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 1280;
    mouse.y = ((e.clientY - rect.top) / rect.height) * 720;
    mouse.inside = true;
  }
  function onMouseDown() { mouse.down = true; }
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
    if (!keys.has(code)) return false;
    keys.delete(code);
    return true;
  }

  /** Wheel steps since last read, in throttle units. */
  function takeWheel() {
    const d = wheelDelta;
    wheelDelta = 0;
    return d;
  }

  return { keys, mouse, attach, pressed, consume, takeWheel };
})();
