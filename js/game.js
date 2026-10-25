/* ひみつきちつくろ — 描画と入力。数値は config.js、ルールは sim.js。
   絵は assets/{キー}.png。ファイルが無いキーは、下の図形のまま。
   一覧は js/sprites.js。おえかきは draw/。
*/
(function (root) {
  "use strict";

  const TUTORIAL = {
    1: "画面を触るか、WASD・矢印キーで、枝や小石に近づこう",
    2: "秘密基地の丸い芝生に戻ると、しまう",
    3: "「売る」でコインになる。秘密基地の上でできる",
    4: "「建てる」と「仲間」で、秘密基地が動き出す",
  };

  const REASON = {
    "carry-full": "持ちきれない。秘密基地に戻るか、リュックを買おう",
    "storage-full": "保管がいっぱい。売ると空きができる",
    "no-coins": "コインが足りない",
    "no-materials": "材料が足りない",
    locked: "まだ見つけていない",
    owned: "もう持っている",
    built: "もう建てた",
    empty: "ない",
    manual: "ボタンで拾う",
  };

  const runtime = {
    started: false,
    ready: false,
    loaded: null,
    state: null,
    scene: null,
    game: null,
    player: null,
    pack: null,
    helper: null,
    helperBubble: null,
    saw: null,
    slots: {},
    nodeViews: new Map(),
    inBase: true,
    nearId: null,
    statuses: { helper: "off", workbench: "off" },
    statusKey: null,
    uiAcc: 0,
    autosaveAcc: 0,
    forceUi: false,
    lastCarryToast: 0,
    lastStorageToast: 0,
    helperPhase: 0,
    dodge: [],
  };

  function cfg() {
    return root.GAME_CONFIG;
  }

  function fontStyle(size, color) {
    return {
      fontFamily: cfg().fontFamily,
      fontSize: size + "px",
      color: color || "#3c2f26",
      stroke: "#fffaf3",
      strokeThickness: 4,
    };
  }

  function extras() {
    return {
      inBase: runtime.inBase,
      statuses: runtime.statuses,
      nearMushroom: !!runtime.nearId,
    };
  }

  function syncUi() {
    if (!runtime.state) return;
    root.UI.sync(runtime.state, extras());
    runtime.forceUi = false;
  }

  function doSave(explicit) {
    if (!runtime.state) return;
    const result = root.Save.save(runtime.state);
    if (result.ok) {
      if (explicit) root.UI.toast("保存した");
      runtime.forceUi = true;
    } else if (explicit || result.reason === "failed") {
      root.UI.toast(result.message || "保存できなかった");
    }
  }

  function reachTutorial(target) {
    const state = runtime.state;
    if (!state || state.tutorialStep !== target - 1) return;
    state.tutorialStep = target;
    if (TUTORIAL[target]) root.UI.toast(TUTORIAL[target]);
  }

  function toastReason(reason) {
    root.UI.toast(REASON[reason] || "できない");
  }

  function ensureBase() {
    if (runtime.inBase) return true;
    root.UI.toast("秘密基地の丸い芝生に戻ろう");
    return false;
  }

  function markDodge(text) {
    text.setData("homeX", text.x);
    text.setData("homeY", text.y);
    runtime.dodge.push(text);
    return text;
  }

  function uiRect(el) {
    if (!el) return null;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return null;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
  }

  function unionRect(list) {
    let rect = null;
    list.forEach(function (next) {
      if (!next) return;
      if (!rect) {
        rect = { x: next.x, y: next.y, w: next.w, h: next.h };
        return;
      }
      const right = Math.max(rect.x + rect.w, next.x + next.w);
      const bottom = Math.max(rect.y + rect.h, next.y + next.h);
      rect.x = Math.min(rect.x, next.x);
      rect.y = Math.min(rect.y, next.y);
      rect.w = right - rect.x;
      rect.h = bottom - rect.y;
    });
    return rect;
  }

  function textShown(text) {
    let node = text;
    while (node) {
      if (node.visible === false) return false;
      node = node.parentContainer;
    }
    return true;
  }

  function textScreen(text) {
    const cam = runtime.scene.cameras.main;
    const bounds = text.getBounds();
    return {
      x: (bounds.x - cam.scrollX) * cam.zoom - 2,
      y: (bounds.y - cam.scrollY) * cam.zoom - 2,
      w: bounds.width * cam.zoom + 4,
      h: bounds.height * cam.zoom + 4,
    };
  }

  function rectHits(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function dodgeLabels() {
    if (!runtime.scene || document.body.classList.contains("panel-open")) return;
    const buttons = [];
    document.querySelectorAll(".side-buttons button").forEach(function (button) {
      buttons.push(uiRect(button));
    });
    const toastHost = document.getElementById("toasts");
    const toastBox = toastHost && toastHost.childElementCount ? uiRect(toastHost) : null;
    const banner = unionRect([uiRect(document.getElementById("hud")), toastBox].filter(Boolean));
    const obstacles = [banner, uiRect(document.getElementById("stick")), uiRect(document.getElementById("action-btn")), unionRect(buttons)].filter(Boolean);
    const cam = runtime.scene.cameras.main;
    const view = { w: cam.width, h: cam.height, zoom: cam.zoom };
    runtime.dodge.forEach(function (text) {
      dodgeOne(text, obstacles, view);
    });
  }

  function fits(rect, obstacles, view) {
    if (rect.x < 1 || rect.y < 1 || rect.x + rect.w > view.w - 1 || rect.y + rect.h > view.h - 1) return false;
    for (let i = 0; i < obstacles.length; i += 1) {
      if (rectHits(rect, obstacles[i])) return false;
    }
    return true;
  }

  function nearestClear(rect, obstacles, view) {
    let best = null;
    function consider(x, y) {
      const next = { x: x, y: y, w: rect.w, h: rect.h };
      if (!fits(next, obstacles, view)) return;
      const cost = (x - rect.x) * (x - rect.x) + (y - rect.y) * (y - rect.y);
      if (!best || cost < best.cost) best = { x: x - rect.x, y: y - rect.y, cost: cost };
    }
    consider(rect.x, rect.y);
    obstacles.forEach(function (obstacle) {
      consider(rect.x, obstacle.y - rect.h - 6);
      consider(rect.x, obstacle.y + obstacle.h + 6);
      consider(obstacle.x - rect.w - 6, rect.y);
      consider(obstacle.x + obstacle.w + 6, rect.y);
    });
    return best;
  }

  function dodgeOne(text, obstacles, view) {
    if (!textShown(text) || !text.text) return;
    if (typeof text.updateText === "function") text.updateText();
    const homeX = text.getData("homeX");
    const homeY = text.getData("homeY");
    const zoom = view.zoom || 1;
    text.setPosition(homeX, homeY);
    const origin = textScreen(text);
    if (origin.x + origin.w < 0 || origin.y + origin.h < 0 || origin.x > view.w || origin.y > view.h) return;
    let rect = { x: origin.x, y: origin.y, w: origin.w, h: origin.h };
    if (rect.x < 2) rect.x = 2;
    if (rect.y < 2) rect.y = 2;
    if (rect.x + rect.w > view.w - 2) rect.x = view.w - 2 - rect.w;
    if (rect.y + rect.h > view.h - 2) rect.y = view.h - 2 - rect.h;
    const shift = nearestClear(rect, obstacles, view);
    if (!shift) return;
    text.setPosition(homeX + (rect.x + shift.x - origin.x) / zoom, homeY + (rect.y + shift.y - origin.y) / zoom);
  }

  function floatText(x, y, text) {
    const scene = runtime.scene;
    if (!scene) return;
    const label = markDodge(scene.add.text(x, y - 18, text, fontStyle(16, "#fffaf3")).setOrigin(0.5).setDepth(6000));
    scene.tweens.add({
      targets: label,
      alpha: 0,
      duration: 700,
      onComplete: function () {
        const index = runtime.dodge.indexOf(label);
        if (index >= 0) runtime.dodge.splice(index, 1);
        label.destroy();
      },
    });
  }

  function syncNode(id) {
    const view = runtime.nodeViews.get(id);
    const record = runtime.state.nodes[id];
    if (view && record) view.setVisible(!record.depleted);
  }

  function syncNodes() {
    cfg().nodes.forEach(function (node) {
      syncNode(node.id);
    });
  }

  function syncBuildings() {
    const state = runtime.state;
    cfg().buildingOrder.forEach(function (id) {
      const slot = runtime.slots[id];
      if (!slot) return;
      const built = !!state.buildings[id];
      const show = id !== "desk" || built || state.discoveredMushroom;
      slot.root.setVisible(show);
      slot.built.setVisible(built);
      slot.marker.setVisible(!built);
      const name = cfg().buildings[id].name;
      slot.label.setText(built ? name : state.discoveredMushroom || id !== "desk" ? name : "？");
    });
  }

  function onPicked(node, result) {
    syncNode(node.id);
    floatText(node.x, node.y - 16, "+" + cfg().resources[result.type].name);
    reachTutorial(2);
    if (result.discovered) {
      root.UI.toast("光るキノコを見つけた。研究机を建てられる");
      syncBuildings();
    }
    doSave(false);
    runtime.forceUi = true;
  }

  function noteCarryFull(now) {
    if (now - runtime.lastCarryToast < 1800) return;
    runtime.lastCarryToast = now;
    root.UI.toast(REASON["carry-full"]);
  }

  function noteStorageFull(now) {
    if (now - runtime.lastStorageToast < 1800) return;
    runtime.lastStorageToast = now;
    root.UI.toast(REASON["storage-full"]);
  }

  function onSell(id, all) {
    if (!runtime.state || !ensureBase()) return;
    const deposited = root.Sim.deposit(runtime.state);
    if (deposited.moved) {
      floatText(runtime.state.player.x, runtime.state.player.y - 28, "保管した");
      reachTutorial(3);
    }
    const result = root.Sim.sell(runtime.state, id, all);
    if (!result.ok) {
      toastReason(result.reason);
      runtime.forceUi = true;
      return;
    }
    reachTutorial(4);
    root.UI.toast(cfg().resources[id].name + "を売って、" + result.gained + "コイン");
    doSave(false);
  }

  function onBuild(id) {
    if (!runtime.state || !ensureBase()) return;
    root.Sim.deposit(runtime.state);
    const result = root.Sim.build(runtime.state, id);
    if (!result.ok) {
      toastReason(result.reason);
      runtime.forceUi = true;
      return;
    }
    syncBuildings();
    root.UI.toast(cfg().buildings[id].name + "を建てた");
    doSave(false);
  }

  function onHire() {
    if (!runtime.state || !ensureBase()) return;
    const result = root.Sim.hire(runtime.state);
    if (!result.ok) {
      toastReason(result.reason);
      runtime.forceUi = true;
      return;
    }
    if (runtime.helper) runtime.helper.setVisible(true);
    root.UI.toast("木こりが来た。開いているあいだ、枝を集める");
    doSave(false);
  }

  function onBuy() {
    if (!runtime.state || !ensureBase()) return;
    const result = root.Sim.buyBackpack(runtime.state);
    if (!result.ok) {
      toastReason(result.reason);
      runtime.forceUi = true;
      return;
    }
    if (runtime.pack) runtime.pack.setVisible(true);
    root.UI.toast("小さなリュックを買った。持ち物が増えた");
    doSave(false);
  }

  function onAction() {
    if (!runtime.state || !runtime.nearId) return;
    const node = cfg().nodeMap[runtime.nearId];
    const result = root.Sim.collect(runtime.state, runtime.nearId, true);
    if (!result.ok) {
      if (result.reason === "carry-full") noteCarryFull(runtime.scene ? runtime.scene.time.now : 0);
      else toastReason(result.reason);
      runtime.forceUi = true;
      return;
    }
    onPicked(node, result);
  }

  function placeArt(scene, key, displayW, displayH) {
    if (!key || !scene.textures.exists(key)) return null;
    const spec = root.SPRITE_BY_KEY[key];
    const image = scene.add.image(0, 0, key);
    const w = displayW || (spec && spec.displayW) || image.width;
    const h = displayH || (spec && spec.displayH) || image.height;
    image.setDisplaySize(w, h);
    image.setOrigin(0.5, spec && spec.anchorY != null ? spec.anchorY : 0.5);
    return image;
  }

  function artKeyForNode(type) {
    if (type === "twig" || type === "pebble" || type === "berry" || type === "mushroom") return type;
    return "";
  }

  function flowerKey(color) {
    if (color === 0xf3a3b5) return "flower-pink";
    if (color === 0xfffaf3) return "flower-white";
    return "flower";
  }

  function drawGround(scene) {
    const world = cfg().world;
    const g = scene.add.graphics().setDepth(0);
    g.fillStyle(0x86b36e, 1);
    g.fillRect(0, 0, world.width, world.height);
    g.fillStyle(0xd7c09a, 1);
    g.fillRoundedRect(world.baseX - 26, world.groveY + 20, 52, world.baseY - world.groveY - 10, 18);
    g.fillStyle(0x6d8f86, 1);
    g.fillCircle(world.groveX, world.groveY, world.groveRadius);
    g.fillStyle(0x7a5cff, 0.18);
    g.fillCircle(world.groveX, world.groveY, world.groveRadius);
    g.fillStyle(0xc5de9b, 1);
    g.fillCircle(world.baseX, world.baseY, world.baseRadius);
    g.lineStyle(4, 0xfff8ee, 0.85);
    g.strokeCircle(world.baseX, world.baseY, world.baseRadius);
    g.lineStyle(10, 0x5d8a52, 1);
    g.strokeRect(6, 6, world.width - 12, world.height - 12);
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      const x = world.baseX + Math.cos(angle) * world.baseRadius;
      const y = world.baseY + Math.sin(angle) * world.baseRadius;
      const stone = placeArt(scene, "stone");
      if (stone) {
        stone.setPosition(x, y);
        stone.setDepth(20);
      } else {
        scene.add.ellipse(x, y, 16, 11, 0x9aa098).setStrokeStyle(2, 0x3c2f26).setDepth(20);
      }
    }
    markDodge(scene.add.text(world.baseX, world.baseY + 78, "秘密基地", fontStyle(18)).setOrigin(0.5).setDepth(30));
    markDodge(scene.add.text(world.groveX, world.groveY + 108, "光る林", fontStyle(18)).setOrigin(0.5).setDepth(30));
    markDodge(scene.add.text(world.groveX, world.groveY + 132, "ボタンで拾う", fontStyle(14)).setOrigin(0.5).setDepth(30));
    markDodge(scene.add.text(world.baseX + 36, (world.baseY + world.groveY) / 2, "北へ", fontStyle(16)).setOrigin(0.5).setDepth(30));
  }

  function drawTree(scene, tree) {
    const c = scene.add.container(tree.x, tree.y);
    const key = tree.shade > 0.5 ? "tree-dark" : "tree";
    const spec = root.SPRITE_BY_KEY[key];
    const art = spec ? placeArt(scene, key, spec.displayW * tree.scale, spec.displayH * tree.scale) : null;
    if (art) {
      art.setPosition(0, 4);
      c.add(art);
    } else {
      const h = 34 * tree.scale;
      c.add(scene.add.rectangle(0, 8, 8, 18, 0x6b4630));
      c.add(scene.add.circle(0, -h * 0.25, 16 * tree.scale, tree.shade > 0.5 ? 0x3f7d4e : 0x4e8d55));
      c.add(scene.add.circle(-8 * tree.scale, -h * 0.05, 11 * tree.scale, 0x356b43));
    }
    c.setDepth(100 + tree.y);
  }

  function drawFlower(scene, flower) {
    const art = placeArt(scene, flowerKey(flower.color));
    if (art) {
      art.setPosition(flower.x, flower.y);
      art.setDepth(12);
      return;
    }
    scene.add.circle(flower.x, flower.y, 3.5, flower.color).setDepth(12);
  }

  function drawNode(scene, node) {
    const resource = cfg().resources[node.type];
    const c = scene.add.container(node.x, node.y);
    const art = placeArt(scene, artKeyForNode(node.type));
    if (art) {
      c.add(art);
      if (node.type === "mushroom") {
        const glow = scene.add.circle(0, -6, 22, 0xc9b6ff, 0.35);
        c.addAt(glow, 0);
        c.add(markDodge(scene.add.text(0, -30, "特別", fontStyle(13)).setOrigin(0.5)));
        scene.tweens.add({ targets: glow, alpha: 0.1, yoyo: true, repeat: -1, duration: 700 });
      }
      c.setDepth(100 + node.y);
      return c;
    }
    if (node.type === "twig") {
      c.add(scene.add.rectangle(0, 0, 28, 8, resource.color).setRotation(-0.7).setStrokeStyle(2, 0x3c2f26));
    } else if (node.type === "pebble") {
      c.add(scene.add.ellipse(0, 2, 20, 14, 0x6f777b).setStrokeStyle(2, 0x3c2f26));
      c.add(scene.add.ellipse(-2, 0, 12, 9, resource.color));
    } else if (node.type === "berry") {
      c.add(scene.add.circle(-5, 1, 7, resource.color).setStrokeStyle(2, 0x3c2f26));
      c.add(scene.add.circle(5, 2, 7, 0xb83b42).setStrokeStyle(2, 0x3c2f26));
      c.add(scene.add.rectangle(0, -8, 3, 8, 0x3e6b45));
    } else {
      const glow = scene.add.circle(0, 0, 20, 0xc9b6ff, 0.45);
      c.add(glow);
      c.add(scene.add.rectangle(0, 6, 6, 12, 0xf2e2c4).setStrokeStyle(2, 0x3c2f26));
      c.add(scene.add.ellipse(0, -1, 22, 12, resource.color).setStrokeStyle(2, 0x3c2f26));
      c.add(scene.add.circle(-4, -2, 2, 0xfff4a8));
      c.add(markDodge(scene.add.text(0, -26, "特別", fontStyle(13)).setOrigin(0.5)));
      scene.tweens.add({ targets: glow, alpha: 0.12, yoyo: true, repeat: -1, duration: 700 });
    }
    c.setDepth(100 + node.y);
    return c;
  }

  function drawBuildingArt(scene, id, parent) {
    if (id === "box" || id === "workbench" || id === "desk") {
      const art = placeArt(scene, id);
      if (art) {
        art.setPosition(0, 12);
        parent.add(art);
        return;
      }
    }
    if (id === "box") {
      parent.add(scene.add.rectangle(0, 4, 34, 22, 0x8a5a32).setStrokeStyle(3, 0x3c2f26));
      parent.add(scene.add.rectangle(0, -8, 38, 8, 0xa56b3c).setStrokeStyle(3, 0x3c2f26));
    } else if (id === "workbench") {
      parent.add(scene.add.rectangle(0, 8, 42, 16, 0x6b4630).setStrokeStyle(3, 0x3c2f26));
      runtime.saw = scene.add.rectangle(0, -4, 18, 6, 0xd7d3cb).setStrokeStyle(2, 0x3c2f26);
      parent.add(runtime.saw);
    } else if (id === "desk") {
      parent.add(scene.add.rectangle(0, 8, 40, 16, 0x6a4a86).setStrokeStyle(3, 0x3c2f26));
      parent.add(scene.add.circle(0, -6, 6, 0xfff1a8).setStrokeStyle(2, 0x3c2f26));
    }
  }

  function drawSlots(scene) {
    cfg().buildingOrder.forEach(function (id) {
      const pos = cfg().slots[id];
      const rootC = scene.add.container(pos.x, pos.y);
      const markerArt = placeArt(scene, "marker");
      let marker;
      if (markerArt) {
        markerArt.setPosition(0, 8);
        marker = markerArt;
      } else {
        marker = scene.add.rectangle(0, 4, 36, 24, 0xe7d7bc, 0.95).setStrokeStyle(2, 0x8a7560);
      }
      const built = scene.add.container(0, 0);
      drawBuildingArt(scene, id, built);
      built.setVisible(false);
      const label = markDodge(scene.add.text(0, -30, cfg().buildings[id].name, fontStyle(14)).setOrigin(0.5));
      rootC.add([marker, built, label]);
      rootC.setDepth(100 + pos.y);
      runtime.slots[id] = { root: rootC, marker: marker, built: built, label: label };
    });
    const shop = cfg().slots.shop;
    const sign = scene.add.container(shop.x, shop.y);
    const shopArt = placeArt(scene, "shop");
    if (shopArt) {
      shopArt.setPosition(0, 10);
      sign.add(shopArt);
    } else {
      sign.add(scene.add.rectangle(0, 12, 6, 28, 0x8a5a32));
      sign.add(scene.add.rectangle(0, -6, 58, 28, 0xfff8ee).setStrokeStyle(3, 0x3c2f26));
      sign.add(markDodge(scene.add.text(0, -6, "お店", fontStyle(14)).setOrigin(0.5)));
    }
    sign.setDepth(100 + shop.y);
  }

  function drawPlayer(scene, x, y) {
    const c = scene.add.container(x, y);
    c.add(scene.add.ellipse(0, 20, 34, 12, 0x000000, 0.18));
    const body = placeArt(scene, "player");
    if (body) {
      body.setPosition(0, 18);
      c.add(body);
    } else {
      c.add(scene.add.ellipse(0, 8, 26, 30, 0x3f7d4e).setStrokeStyle(2, 0x3c2f26));
      c.add(scene.add.circle(0, -14, 13, 0xf3c7a5).setStrokeStyle(2, 0x3c2f26));
      c.add(scene.add.ellipse(0, -22, 22, 12, 0x5c3b2e));
      c.add(scene.add.circle(-4, -14, 1.6, 0x2c241c));
      c.add(scene.add.circle(4, -14, 1.6, 0x2c241c));
    }
    const packArt = placeArt(scene, "backpack");
    if (packArt) {
      packArt.setPosition(-20, 6);
      runtime.pack = packArt;
    } else {
      runtime.pack = scene.add.rectangle(-14, 6, 12, 16, 0x8a5a32).setStrokeStyle(2, 0x3c2f26);
    }
    runtime.pack.setVisible(runtime.state.backpack);
    c.add(runtime.pack);
    const ring = scene.add.graphics();
    ring.lineStyle(2, 0xfffaf3, 0.28);
    ring.strokeCircle(0, 0, cfg().autoCollectRadius);
    c.add(ring);
    c.setDepth(100 + y);
    return c;
  }

  function drawHelper(scene) {
    const path = cfg().helperPath;
    const c = scene.add.container(path.x1, path.y1);
    c.add(scene.add.ellipse(0, 18, 26, 10, 0x000000, 0.18));
    const art = placeArt(scene, "helper");
    if (art) {
      art.setPosition(0, 16);
      c.add(art);
    } else {
      c.add(scene.add.ellipse(0, 6, 22, 26, 0x8a5a32).setStrokeStyle(2, 0x3c2f26));
      c.add(scene.add.circle(0, -12, 10, 0xf3c7a5).setStrokeStyle(2, 0x3c2f26));
      c.add(scene.add.ellipse(0, -18, 22, 8, 0xe2b14a).setStrokeStyle(2, 0x3c2f26));
      c.add(scene.add.circle(-3.5, -12, 1.3, 0x2c241c));
      c.add(scene.add.circle(3.5, -12, 1.3, 0x2c241c));
    }
    runtime.helperBubble = markDodge(scene.add.text(0, -36, "", fontStyle(13)).setOrigin(0.5));
    c.add(runtime.helperBubble);
    c.setVisible(runtime.state.helperHired);
    c.setDepth(100 + path.y1);
    return c;
  }

  function zoomFor(width) {
    const camera = cfg().camera;
    if (width < 520) return camera.phone;
    if (width < 900) return camera.tablet;
    return camera.desktop;
  }

  function cssSize(scene) {
    const canvas = scene.game && scene.game.canvas;
    const parent = canvas && canvas.parentElement;
    return {
      w: (parent && parent.clientWidth) || window.innerWidth,
      h: (parent && parent.clientHeight) || window.innerHeight,
    };
  }

  function ensureCanvas(scene) {
    const css = cssSize(scene);
    const w = Math.max(1, Math.round(css.w));
    const h = Math.max(1, Math.round(css.h));
    const canvas = scene.game.canvas;
    if (canvas && (Math.abs(canvas.width - w) > 1 || Math.abs(canvas.height - h) > 1)) {
      /* DPR が高いと Scale の自動追従が親サイズを取りこぼすことがある。 */
      scene.scale.setParentSize(w, h);
    }
    return { w: w, h: h };
  }

  function updateCamera(scene) {
    const cam = scene.cameras.main;
    const css = ensureCanvas(scene);
    const desired = zoomFor(css.w);
    const bufferW = cam.width || css.w;
    const bufferH = cam.height || css.h;
    const ratio = bufferW / css.w;
    const dpr = window.devicePixelRatio || 1;
    /* バッファが devicePixelRatio 倍のときだけ、CSS ピクセル基準の見え方に戻す。 */
    const zoom = dpr > 1.25 && Math.abs(ratio - dpr) < 0.2 ? desired * ratio : desired;
    cam.setZoom(zoom);
    const world = cfg().world;
    const viewW = bufferW / zoom;
    const viewH = bufferH / zoom;
    const player = runtime.state.player;
    let scrollX = player.x - viewW / 2;
    let scrollY = player.y - viewH / 2;
    if (viewW >= world.width) scrollX = (world.width - viewW) / 2;
    else scrollX = Math.max(0, Math.min(world.width - viewW, scrollX));
    if (viewH >= world.height) scrollY = (world.height - viewH) / 2;
    else scrollY = Math.max(0, Math.min(world.height - viewH, scrollY));
    cam.setScroll(scrollX, scrollY);
  }

  function scenePreload(scene) {
    const sprites = root.SPRITE_LIST || [];
    sprites.forEach(function (sprite) {
      scene.load.image(sprite.key, "assets/" + sprite.file);
    });
  }

  function sceneCreate(scene) {
    runtime.scene = scene;
    const state = runtime.state;
    drawGround(scene);
    const decor = root.Layout.generateDecor(cfg());
    decor.flowers.forEach(function (flower) {
      drawFlower(scene, flower);
    });
    decor.trees.forEach(function (tree) {
      drawTree(scene, tree);
    });
    cfg().nodes.forEach(function (node) {
      runtime.nodeViews.set(node.id, drawNode(scene, node));
    });
    syncNodes();
    drawSlots(scene);
    syncBuildings();
    runtime.player = drawPlayer(scene, state.player.x, state.player.y);
    runtime.helper = drawHelper(scene);
    const cam = scene.cameras.main;
    cam.useBounds = false;
    updateCamera(scene);
    scene.scale.on("resize", function () {
      updateCamera(scene);
    });
    reachTutorial(1);
    runtime.ready = true;
    root.Himitsukichi.ready = true;
    syncUi();
  }

  function updateMovement(step) {
    const state = runtime.state;
    const v = root.Input.vector();
    const dt = step / 1000;
    const world = cfg().world;
    state.player.x += v.x * cfg().playerSpeed * dt;
    state.player.y += v.y * cfg().playerSpeed * dt;
    state.player.x = Math.max(world.pad, Math.min(world.width - world.pad, state.player.x));
    state.player.y = Math.max(world.pad, Math.min(world.height - world.pad, state.player.y));
    runtime.player.setPosition(state.player.x, state.player.y);
    runtime.player.setDepth(100 + state.player.y);
  }

  function nearestMushroom() {
    const state = runtime.state;
    let best = null;
    let bestD = cfg().interactRadius;
    cfg().nodes.forEach(function (node) {
      if (!cfg().resources[node.type].special) return;
      const record = state.nodes[node.id];
      if (!record || record.depleted) return;
      const d = Math.hypot(node.x - state.player.x, node.y - state.player.y);
      if (d <= bestD) {
        bestD = d;
        best = node;
      }
    });
    return best;
  }

  function autoCollect(now) {
    const state = runtime.state;
    cfg().nodes.forEach(function (node) {
      const resource = cfg().resources[node.type];
      if (resource.special) return;
      const record = state.nodes[node.id];
      if (!record || record.depleted) return;
      const d = Math.hypot(node.x - state.player.x, node.y - state.player.y);
      if (d > cfg().autoCollectRadius) return;
      const result = root.Sim.collect(state, node.id, false);
      if (result.ok) onPicked(node, result);
      else if (result.reason === "carry-full") noteCarryFull(now);
    });
  }

  function updateDeposit(now) {
    const state = runtime.state;
    const world = cfg().world;
    runtime.inBase = Math.hypot(state.player.x - world.baseX, state.player.y - world.baseY) <= world.baseRadius;
    if (!runtime.inBase || root.Sim.bagCount(state.carry) <= 0) return;
    const result = root.Sim.deposit(state);
    if (result.moved) {
      floatText(state.player.x, state.player.y - 28, "保管した");
      reachTutorial(3);
      doSave(false);
    }
    if (result.blocked) noteStorageFull(now);
  }

  function announce(prev, next) {
    if (!prev) return;
    if (next.helper === "full" && prev.helper !== "full") {
      root.UI.toast("木こり: 保管がいっぱい。売るか、木箱を建てるとまた動く");
    }
    if (next.workbench === "no-input" && prev.workbench !== "no-input") {
      root.UI.toast("作業台: 枝が足りない。拾うか、木こりを雇うと進む");
    }
    if (next.workbench === "full" && prev.workbench !== "full") {
      root.UI.toast("作業台: 保管がいっぱい");
    }
  }

  function updateProduction(step, time) {
    const state = runtime.state;
    const result = root.Sim.tickProduction(state, step);
    root.Sim.tickRespawn(state, step);
    if (result.gathered > 0 && runtime.helper) {
      floatText(runtime.helper.x, runtime.helper.y - 20, "+" + cfg().resources[cfg().helper.resource].name);
      doSave(false);
    }
    if (result.crafted > 0) {
      const slot = cfg().slots.workbench;
      floatText(slot.x, slot.y - 20, "+" + cfg().resources[cfg().workbench.output].name);
      doSave(false);
    }
    const key = result.helper + "|" + result.workbench;
    if (runtime.statusKey == null) runtime.statusKey = key;
    else if (key !== runtime.statusKey) announce(runtime.statuses, result);
    runtime.statusKey = key;
    runtime.statuses = { helper: result.helper, workbench: result.workbench };
    if (runtime.saw && state.buildings.workbench && result.workbench === "run") {
      runtime.saw.rotation = Math.sin(time / 90) * 0.6;
    }
  }

  function updateHelper(step) {
    const state = runtime.state;
    if (!runtime.helper) return;
    runtime.helper.setVisible(state.helperHired);
    if (!state.helperHired) return;
    const path = cfg().helperPath;
    const working = runtime.statuses.helper === "run";
    if (working) runtime.helperPhase += step;
    const t = (Math.sin(runtime.helperPhase / 420) + 1) / 2;
    const x = working ? path.x1 + (path.x2 - path.x1) * t : path.x1;
    const y = working ? path.y1 + (path.y2 - path.y1) * t : path.y1;
    runtime.helper.setPosition(x, y);
    runtime.helper.setDepth(100 + y);
    const code = runtime.statuses.helper;
    runtime.helperBubble.setText(code === "full" ? "満杯" : code === "run" ? cfg().helper.name : "");
  }

  function sceneUpdate(scene, time, delta) {
    if (document.hidden) return;
    // タブに戻った直後の大きな delta を、生産にも移動にも足さない。
    const step = Math.min(delta, cfg().maxFrameMs);
    updateMovement(step);
    updateCamera(scene);
    autoCollect(time);
    updateDeposit(time);
    updateProduction(step, time);
    syncNodes();
    updateHelper(step);
    dodgeLabels();
    if (runtime.pack) runtime.pack.setVisible(runtime.state.backpack);
    const near = nearestMushroom();
    runtime.nearId = near ? near.id : null;
    runtime.uiAcc += step;
    if (runtime.forceUi || runtime.uiAcc >= 120) {
      runtime.uiAcc = 0;
      syncUi();
    }
    runtime.autosaveAcc += step;
    if (runtime.autosaveAcc >= cfg().autosaveMs) {
      runtime.autosaveAcc = 0;
      doSave(false);
    }
  }

  function startGame(state) {
    if (runtime.started) return;
    if (!root.Phaser) {
      root.UI.showFatal("ゲーム画面を読み込めなかった");
      return;
    }
    runtime.started = true;
    runtime.state = state;
    runtime.inBase = true;
    document.body.classList.add("playing");
    syncUi();
    runtime.game = new root.Phaser.Game({
      type: root.Phaser.AUTO,
      parent: "game-root",
      backgroundColor: "#86b36e",
      banner: false,
      audio: { noAudio: true },
      resolution: 1,
      scale: {
        mode: root.Phaser.Scale.RESIZE,
        autoCenter: root.Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
        zoom: 1,
      },
      input: { activePointers: 2 },
      scene: {
        preload: function () {
          scenePreload(this);
        },
        create: function () {
          sceneCreate(this);
        },
        update: function (time, delta) {
          sceneUpdate(this, time, delta);
        },
      },
    });
  }

  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.get("reset") === "1") root.Save.reset();
    const loaded = root.Save.load();
    runtime.loaded = loaded;
    root.UI.init({
      loaded: loaded,
      onStart: function () {
        startGame(loaded.state);
      },
      onSell: onSell,
      onBuild: onBuild,
      onHire: onHire,
      onBuy: onBuy,
      onAction: onAction,
      onSave: function () {
        doSave(true);
      },
      onReset: function () {
        root.Save.reset();
        location.reload();
      },
    });
    const stick = document.getElementById("stick");
    root.Input.bindStick(stick, stick.querySelector(".knob"));
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && runtime.started) doSave(false);
    });
    window.addEventListener("beforeunload", function () {
      if (runtime.started) doSave(false);
    });
    root.Himitsukichi = {
      getState: function () {
        return runtime.state;
      },
      getLoaded: function () {
        return runtime.loaded;
      },
      inBase: function () {
        return runtime.inBase;
      },
      statuses: function () {
        return runtime.statuses;
      },
      hasArt: function (key) {
        return !!(runtime.scene && runtime.scene.textures.exists(key));
      },
      getTexts: function () {
        const scene = runtime.scene;
        if (!scene) return [];
        const cam = scene.cameras.main;
        const found = [];
        const visit = function (node) {
          if (!node || node.visible === false) return;
          if (node.type === "Text" && node.text) {
            const bounds = node.getBounds();
            found.push({
              text: node.text,
              x: (bounds.x - cam.scrollX) * cam.zoom,
              y: (bounds.y - cam.scrollY) * cam.zoom,
              w: bounds.width * cam.zoom,
              h: bounds.height * cam.zoom,
            });
          }
          if (node.list) node.list.forEach(visit);
        };
        scene.children.list.forEach(visit);
        return found;
      },
      getView: function () {
        const scene = runtime.scene;
        if (!scene) return null;
        const cam = scene.cameras.main;
        const p = runtime.state.player;
        return {
          zoom: cam.zoom,
          scrollX: Math.round(cam.scrollX),
          scrollY: Math.round(cam.scrollY),
          width: cam.width,
          height: cam.height,
          playerX: Math.round(p.x),
          playerY: Math.round(p.y),
          screenX: Math.round((p.x - cam.scrollX) * cam.zoom),
          screenY: Math.round((p.y - cam.scrollY) * cam.zoom),
          offsetY: cam.followOffset.y,
        };
      },
      ready: false,
    };
    if (!root.Phaser) {
      root.UI.showFatal("ゲーム画面を読み込めなかった");
      return;
    }
    if (params.get("play") === "1") startGame(loaded.state);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(globalThis);
