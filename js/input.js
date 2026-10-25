/* フローティングスティックと WASD / 矢印。パネルが開いているあいだは動かない。
   触っていないときはスティックを出さない。ページのピンチとダブルタップ拡大も止める。 */
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

  let hideStick = function () {};

  function blocked() {
    return !!(root.UI && root.UI.blocksGame && root.UI.blocksGame());
  }

  function clear() {
    pressed.clear();
    stick.x = 0;
    stick.y = 0;
    hideStick();
  }

  function lockPageZoom() {
    function prevent(event) {
      event.preventDefault();
    }
    document.addEventListener("gesturestart", prevent, { passive: false });
    document.addEventListener("gesturechange", prevent, { passive: false });
    document.addEventListener("gestureend", prevent, { passive: false });
    document.addEventListener("dblclick", prevent);
    let lastTouch = 0;
    document.addEventListener(
      "touchend",
      function (event) {
        const now = Date.now();
        if (now - lastTouch < 350) prevent(event);
        lastTouch = now;
      },
      { passive: false }
    );
    document.addEventListener(
      "touchstart",
      function (event) {
        if (event.touches && event.touches.length > 1) prevent(event);
      },
      { passive: false }
    );
    document.addEventListener(
      "touchmove",
      function (event) {
        if (event.touches && event.touches.length > 1) prevent(event);
      },
      { passive: false }
    );
  }

  lockPageZoom();

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

  function isControl(target) {
    if (!target || !target.closest) return true;
    return !!target.closest("button, a, input, textarea, select, label, #hud, #scrim, .panel, .side-buttons, #action-btn, #title-screen");
  }

  function bindStick(el, knob) {
    const max = 32;
    let pointerId = null;

    function place(dx, dy) {
      knob.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))";
    }

    function end() {
      pointerId = null;
      stick.x = 0;
      stick.y = 0;
      place(0, 0);
      el.classList.remove("active");
      el.setAttribute("aria-hidden", "true");
    }

    hideStick = end;

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

    let originX = 0;
    let originY = 0;

    document.addEventListener(
      "pointerdown",
      function (event) {
        if (pointerId != null) return;
        if (!document.body.classList.contains("playing")) return;
        if (blocked()) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (isControl(event.target)) return;
        pointerId = event.pointerId;
        originX = event.clientX;
        originY = event.clientY;
        el.style.left = event.clientX + "px";
        el.style.top = event.clientY + "px";
        el.classList.add("active");
        el.setAttribute("aria-hidden", "false");
        place(0, 0);
        if (event.target.setPointerCapture) {
          try {
            event.target.setPointerCapture(event.pointerId);
          } catch (err) {
            /* 取れなくても pointermove は document で見る */
          }
        }
        event.preventDefault();
      },
      { passive: false }
    );

    document.addEventListener(
      "pointermove",
      function (event) {
        if (event.pointerId !== pointerId) return;
        if (blocked()) {
          end();
          return;
        }
        move(event);
        event.preventDefault();
      },
      { passive: false }
    );

    document.addEventListener("pointerup", function (event) {
      if (event.pointerId !== pointerId) return;
      end();
    });

    document.addEventListener("pointercancel", function (event) {
      if (event.pointerId !== pointerId) return;
      end();
    });

    return { end: end };
  }

  root.Input = { vector: vector, bindStick: bindStick, clear: clear };
})(globalThis);
