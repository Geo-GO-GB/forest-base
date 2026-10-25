/* スティックと WASD / 矢印。パネルが開いているあいだは動かない。 */
(function (root) {
  "use strict";

  const pressed = new Set();
  const stick = { x: 0, y: 0 };
  const codes = {
    KeyW: [0, -1],
    KeyA: [-1, 0],
    KeyS: [0, 1],
    KeyD: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
  };

  function blocked() {
    return !!(root.UI && root.UI.blocksGame && root.UI.blocksGame());
  }

  function clear() {
    pressed.clear();
    stick.x = 0;
    stick.y = 0;
  }

  window.addEventListener("keydown", function (event) {
    if (!codes[event.code]) return;
    pressed.add(event.code);
    event.preventDefault();
  });

  window.addEventListener("keyup", function (event) {
    if (!codes[event.code]) return;
    pressed.delete(event.code);
    event.preventDefault();
  });

  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) clear();
  });

  function vector() {
    if (blocked()) return { x: 0, y: 0 };
    let x = stick.x;
    let y = stick.y;
    pressed.forEach(function (code) {
      const dir = codes[code];
      x += dir[0];
      y += dir[1];
    });
    const length = Math.hypot(x, y);
    if (length <= 0.12) return { x: 0, y: 0 };
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x: x, y: y };
  }

  function bindStick(el, knob) {
    const max = 46;
    let pointerId = null;
    let originX = 0;
    let originY = 0;

    function place(dx, dy) {
      knob.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))";
    }

    function end() {
      pointerId = null;
      stick.x = 0;
      stick.y = 0;
      place(0, 0);
    }

    function move(event) {
      const dx = event.clientX - originX;
      const dy = event.clientY - originY;
      const length = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(length, max);
      place((dx / length) * clamped, (dy / length) * clamped);
      const mag = clamped / max;
      stick.x = (dx / length) * mag;
      stick.y = (dy / length) * mag;
    }

    el.addEventListener("pointerdown", function (event) {
      if (blocked()) return;
      pointerId = event.pointerId;
      el.setPointerCapture(event.pointerId);
      const rect = el.getBoundingClientRect();
      originX = rect.left + rect.width / 2;
      originY = rect.top + rect.height / 2;
      move(event);
      event.preventDefault();
    });

    el.addEventListener("pointermove", function (event) {
      if (event.pointerId !== pointerId) return;
      move(event);
      event.preventDefault();
    });

    el.addEventListener("pointerup", function (event) {
      if (event.pointerId !== pointerId) return;
      end();
    });

    el.addEventListener("pointercancel", function (event) {
      if (event.pointerId !== pointerId) return;
      end();
    });

    return { end: end };
  }

  root.Input = { vector: vector, bindStick: bindStick, clear: clear };
})(globalThis);
