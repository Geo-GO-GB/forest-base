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

  function generateDecor(cfg) {
    const rand = mulberry32(cfg.layoutSeed);
    const world = cfg.world;
    const trees = [];
    let guard = 0;
    while (trees.length < cfg.treeCount && guard < 5000) {
      guard += 1;
      const x = world.pad + rand() * (world.width - world.pad * 2);
      const y = world.pad + rand() * (world.height - world.pad * 2);
      if (dist(x, y, world.baseX, world.baseY) < world.baseRadius + 78) continue;
      if (dist(x, y, world.groveX, world.groveY) < world.groveRadius * 0.7) continue;
      let blocked = false;
      for (let i = 0; i < cfg.nodes.length; i += 1) {
        const node = cfg.nodes[i];
        if (dist(x, y, node.x, node.y) < 44) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      for (let i = 0; i < trees.length; i += 1) {
        if (dist(x, y, trees[i].x, trees[i].y) < 76) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      trees.push({ x: x, y: y, scale: 0.85 + rand() * 0.45, shade: rand() });
    }

    const flowers = [];
    guard = 0;
    while (flowers.length < cfg.flowerCount && guard < 5000) {
      guard += 1;
      const x = world.pad + rand() * (world.width - world.pad * 2);
      const y = world.pad + rand() * (world.height - world.pad * 2);
      if (dist(x, y, world.baseX, world.baseY) < world.baseRadius - 10) continue;
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
