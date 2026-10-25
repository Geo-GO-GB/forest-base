/* ひみつきちつくろ — 仮の絵を一枚ずつかく。
   かいた PNG は localStorage。まとめて保存で assets/ に置ける ZIP。 */
(function (root) {
  "use strict";

  const STORE_KEY = "himitsukichi-draw-v1";
  const UNDO_MAX = 30;

  const canvas = document.getElementById("paper");
  const sheet = document.getElementById("sheet");
  const board = document.getElementById("board");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const state = {
    index: 0,
    size: 6,
    color: "#3c2f26",
    eraser: false,
    drawing: false,
    ready: false,
    pointerId: null,
    last: null,
    undo: [],
    generation: 0,
  };

  function list() {
    return root.SPRITE_LIST || [];
  }

  function current() {
    return list()[state.index] || null;
  }

  function toast(message) {
    const host = document.getElementById("toasts");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    host.appendChild(el);
    while (host.children.length > 2) host.removeChild(host.firstChild);
    setTimeout(function () {
      el.remove();
    }, 2200);
  }

  function emptyStore() {
    return { version: 1, index: 0, drawings: {} };
  }

  function readStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyStore();
      const data = JSON.parse(raw);
      if (!data || data.version !== 1 || typeof data.drawings !== "object" || !data.drawings) return emptyStore();
      data.index = Number.isInteger(data.index) ? data.index : 0;
      return data;
    } catch (err) {
      return emptyStore();
    }
  }

  function writeStore(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      toast("このブラウザには、これ以上保存できない");
      return false;
    }
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  }

  function aspect(w, h) {
    const g = gcd(w, h);
    return w / g + ":" + h / g;
  }

  function isBlank() {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return false;
    }
    return true;
  }

  function fitSheet() {
    const sprite = current();
    if (!sprite) return;
    const bounds = board.getBoundingClientRect();
    const maxW = Math.max(64, bounds.width - 8);
    const maxH = Math.max(64, bounds.height - 8);
    let cssW = maxW;
    let cssH = cssW * (sprite.height / sprite.width);
    if (cssH > maxH) {
      cssH = maxH;
      cssW = cssH * (sprite.width / sprite.height);
    }
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
  }

  function pointerPos(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function paintSegment(from, to) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = state.size;
    if (state.eraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = state.color;
    }
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  function pushUndo() {
    try {
      state.undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (state.undo.length > UNDO_MAX) state.undo.shift();
    } catch (err) {
      state.undo.length = 0;
    }
  }

  function persist() {
    const sprite = current();
    if (!sprite || !state.ready) return;
    const data = readStore();
    if (isBlank()) delete data.drawings[sprite.key];
    else data.drawings[sprite.key] = canvas.toDataURL("image/png");
    data.index = state.index;
    writeStore(data);
    renderFlag();
  }

  function renderFlag() {
    const sprite = current();
    const flag = document.getElementById("drawn-flag");
    const drawn = !!(sprite && readStore().drawings[sprite.key]);
    flag.textContent = drawn ? "描いた" : "まだ";
    flag.classList.toggle("yes", drawn);
  }

  function showPrompt() {
    const sprites = list();
    const sprite = current();
    const total = sprites.length;
    document.getElementById("progress").textContent = total ? state.index + 1 + "/" + total : "0/0";
    document.getElementById("prev").disabled = state.index <= 0;
    document.getElementById("next").disabled = state.index >= total - 1;
    if (!sprite) {
      document.getElementById("prompt").textContent = "絵の一覧がない";
      document.getElementById("meta").textContent = "";
      return;
    }
    document.getElementById("prompt").textContent = sprite.name;
    document.getElementById("meta").textContent =
      sprite.file + "　" + sprite.width + "×" + sprite.height + "　" + aspect(sprite.width, sprite.height);
    renderFlag();
  }

  function loadDrawing() {
    const sprite = current();
    state.generation += 1;
    const generation = state.generation;
    state.ready = false;
    state.undo = [];
    canvas.width = sprite ? sprite.width : 64;
    canvas.height = sprite ? sprite.height : 64;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fitSheet();
    showPrompt();
    if (!sprite) return;
    const url = readStore().drawings[sprite.key];
    if (!url) {
      state.ready = true;
      return;
    }
    const image = new Image();
    image.onload = function () {
      if (generation !== state.generation) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      state.ready = true;
      renderFlag();
    };
    image.onerror = function () {
      if (generation !== state.generation) return;
      state.ready = true;
    };
    image.src = url;
  }

  function go(nextIndex) {
    const sprites = list();
    if (!sprites.length || !state.ready) return;
    const clamped = Math.max(0, Math.min(sprites.length - 1, nextIndex));
    if (clamped === state.index && canvas.width) {
      persist();
      return;
    }
    persist();
    state.index = clamped;
    const data = readStore();
    data.index = state.index;
    writeStore(data);
    loadDrawing();
  }

  function onPointerDown(event) {
    if (state.pointerId != null || !state.ready) return;
    if (!current()) return;
    event.preventDefault();
    state.pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    pushUndo();
    state.drawing = true;
    state.last = pointerPos(event);
    paintSegment(state.last, state.last);
  }

  function onPointerMove(event) {
    if (!state.drawing || event.pointerId !== state.pointerId) return;
    event.preventDefault();
    const samples = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
    const points = samples && samples.length ? samples : [event];
    for (let i = 0; i < points.length; i += 1) {
      const next = pointerPos(points[i]);
      paintSegment(state.last, next);
      state.last = next;
    }
  }

  function onPointerUp(event) {
    if (event.pointerId !== state.pointerId) return;
    state.drawing = false;
    state.pointerId = null;
    state.last = null;
    persist();
  }

  function selectSize(size) {
    state.size = size;
    state.eraser = false;
    document.querySelectorAll("[data-size]").forEach(function (button) {
      button.classList.toggle("on", Number(button.dataset.size) === size);
    });
    document.getElementById("eraser").classList.remove("on");
  }

  function selectColor(color) {
    state.color = color;
    state.eraser = false;
    document.getElementById("eraser").classList.remove("on");
    document.querySelectorAll(".swatch").forEach(function (button) {
      button.classList.toggle("on", button.dataset.color === color);
    });
    const match = document.querySelector('[data-size="' + state.size + '"]');
    if (match) match.classList.add("on");
  }

  function dataUrlBytes(dataUrl) {
    const comma = dataUrl.indexOf(",");
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function exportZip() {
    if (typeof root.JSZip !== "function") {
      toast("保存の仕組みを読み込めなかった");
      return;
    }
    persist();
    const stored = readStore();
    const sprites = list();
    let drawn = 0;
    sprites.forEach(function (sprite) {
      if (stored.drawings[sprite.key]) drawn += 1;
    });
    if (!drawn) {
      toast("まだ絵がない");
      return;
    }
    const zip = new root.JSZip();
    sprites.forEach(function (sprite) {
      const url = stored.drawings[sprite.key];
      if (!url) return;
      zip.file(sprite.file, dataUrlBytes(url));
    });
    const manifest = {
      title: "ひみつきちつくろ",
      version: 1,
      assets: sprites.map(function (sprite) {
        return {
          key: sprite.key,
          name: sprite.name,
          file: sprite.file,
          width: sprite.width,
          height: sprite.height,
          drawn: !!stored.drawings[sprite.key],
        };
      }),
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.generateAsync({ type: "blob" }).then(function (blob) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "himitsukichi-art.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () {
        URL.revokeObjectURL(link.href);
      }, 4000);
      toast("まとめて保存した");
    }).catch(function () {
      toast("まとめられなかった");
    });
  }

  function bind() {
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    document.querySelectorAll("[data-size]").forEach(function (button) {
      button.addEventListener("click", function () {
        selectSize(Number(button.dataset.size));
      });
    });
    document.querySelectorAll(".swatch").forEach(function (button) {
      button.addEventListener("click", function () {
        selectColor(button.dataset.color);
      });
    });
    document.getElementById("custom-color").addEventListener("input", function (event) {
      selectColor(event.target.value);
      document.querySelectorAll(".swatch").forEach(function (button) {
        button.classList.remove("on");
      });
    });
    document.getElementById("eraser").addEventListener("click", function () {
      state.eraser = true;
      document.getElementById("eraser").classList.add("on");
      document.querySelectorAll("[data-size]").forEach(function (button) {
        button.classList.remove("on");
      });
    });
    document.getElementById("undo").addEventListener("click", function () {
      const shot = state.undo.pop();
      if (!shot) {
        toast("戻せる絵がない");
        return;
      }
      ctx.putImageData(shot, 0, 0);
      persist();
    });
    document.getElementById("clear").addEventListener("click", function () {
      if (isBlank()) return;
      pushUndo();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      persist();
      toast("消した。一つ戻すで戻せる");
    });
    document.getElementById("prev").addEventListener("click", function () {
      go(state.index - 1);
    });
    document.getElementById("next").addEventListener("click", function () {
      go(state.index + 1);
    });
    document.getElementById("export").addEventListener("click", exportZip);
    window.addEventListener("resize", fitSheet);
  }

  function boot() {
    if (!list().length) {
      document.getElementById("prompt").textContent = "絵の一覧を読み込めなかった";
      return;
    }
    const stored = readStore();
    state.index = Math.max(0, Math.min(list().length - 1, stored.index || 0));
    bind();
    selectSize(6);
    loadDrawing();
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
  }

  lockPageZoom();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(globalThis);
