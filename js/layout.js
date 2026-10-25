/* 見た目だけの木と花。位置は layoutSeed から毎回同じ。 */
(function (root) {
  "use strict";

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dist(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.hypot(dx, dy);
  }

  function inPond(cfg, x, y, pad) {
    const pond = cfg.art && cfg.art.pond;
    if (!pond) return false;
    const nx = (x - pond.x) / (pond.w / 2 + pad);
    const ny = (y - pond.y) / (pond.h / 2 + pad);
    return nx * nx + ny * ny < 1;
  }

  function coversPond(cfg, x, y, tall) {
    if (inPond(cfg, x, y, 24)) return true;
    if (inPond(cfg, x, y - 36, 8)) return true;
    if (!tall) return false;
    if (inPond(cfg, x, y - 150, 12)) return true;
    if (inPond(cfg, x - 54, y - 90, 8)) return true;
    if (inPond(cfg, x + 54, y - 90, 8)) return true;
    return false;
  }

  function blocksYard(cfg, x, y, kind) {
    const world = cfg.world;
    const hutW = 115;
    const hutH = 200;
    if (Math.abs(x - world.baseX) < hutW + 70 && y < world.baseY + 30 && y > world.baseY - hutH - 40) {
      return true;
    }
    const slots = cfg.slots || {};
    const ids = Object.keys(slots);
    for (let i = 0; i < ids.length; i += 1) {
      const slot = slots[ids[i]];
      const reach = kind === "tree" ? 120 : 70;
      if (Math.abs(x - slot.x) < reach && Math.abs(y - slot.y) < reach + 20) return true;
    }
    /* 木は幹が道の脇まで来ると、小屋の横を通れなくなる。花は道の縁に置いてよい。 */
    const pathHalf = kind === "tree" ? 176 : 62;
    if (Math.abs(x - world.baseX) < pathHalf && y > world.groveY - 30 && y < world.baseY + 40) return true;
    return false;
  }

  function generateDecor(cfg) {
    const rand = mulberry32(cfg.layoutSeed);
    const world = cfg.world;
    const trees = [];
    let guard = 0;
    while (trees.length < cfg.treeCount && guard < 8000) {
      guard += 1;
      const x = world.pad + rand() * (world.width - world.pad * 2);
      const y = world.pad + rand() * (world.height - world.pad * 2);
      if (dist(x, y, world.baseX, world.baseY) < world.baseRadius + 40) continue;
      if (blocksYard(cfg, x, y, "tree")) continue;
      if (coversPond(cfg, x, y, true)) continue;
      let blocked = false;
      for (let i = 0; i < cfg.nodes.length; i += 1) {
        const node = cfg.nodes[i];
        if (dist(x, y, node.x, node.y) < 96) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      for (let i = 0; i < trees.length; i += 1) {
        if (dist(x, y, trees[i].x, trees[i].y) < 128) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const inGrove = dist(x, y, world.groveX, world.groveY) < world.groveRadius + 30;
      trees.push({
        x: x,
        y: y,
        scale: 0.85 + rand() * 0.45,
        shade: inGrove ? 0.9 : rand(),
      });
    }

    const flowers = [];
    guard = 0;
    while (flowers.length < cfg.flowerCount && guard < 8000) {
      guard += 1;
      const x = world.pad + rand() * (world.width - world.pad * 2);
      const y = world.pad + rand() * (world.height - world.pad * 2);
      if (dist(x, y, world.baseX, world.baseY) < world.baseRadius + 24) continue;
      if (blocksYard(cfg, x, y, "flower")) continue;
      if (coversPond(cfg, x, y, false)) continue;
      let blocked = false;
      for (let i = 0; i < cfg.nodes.length; i += 1) {
        if (dist(x, y, cfg.nodes[i].x, cfg.nodes[i].y) < 52) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      for (let i = 0; i < flowers.length; i += 1) {
        if (dist(x, y, flowers[i].x, flowers[i].y) < 40) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      flowers.push({
        x: x,
        y: y,
        color: cfg.flowerColors[flowers.length % cfg.flowerColors.length],
      });
    }

    return { trees: trees, flowers: flowers };
  }

  root.Layout = { generateDecor: generateDecor };
})(globalThis);
