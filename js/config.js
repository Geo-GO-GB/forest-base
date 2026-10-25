/* ひみつきちつくろ — 調整する数値はすべてここ。 */
(function (root) {
  "use strict";

  const resources = {
    twig: {
      name: "枝",
      sellPrice: 1,
      gatherAmount: 1,
      respawnMs: 16000,
      special: false,
      color: 0x8d5a32,
      blurb: "近づくと拾える。売る、建てる、作業台の材料",
    },
    pebble: {
      name: "小石",
      sellPrice: 1,
      gatherAmount: 1,
      respawnMs: 16000,
      special: false,
      color: 0x8e9698,
      blurb: "近づくと拾える。建てるときに使う",
    },
    berry: {
      name: "木の実",
      sellPrice: 2,
      gatherAmount: 1,
      respawnMs: 18000,
      special: false,
      color: 0xd4534a,
      blurb: "近づくと拾える。売るとコインになる",
    },
    plank: {
      name: "木材",
      sellPrice: 4,
      gatherAmount: 0,
      respawnMs: 0,
      special: false,
      processed: true,
      color: 0xc4894a,
      blurb: "作業台で、枝から作る",
    },
    mushroom: {
      name: "光るキノコ",
      sellPrice: 8,
      gatherAmount: 1,
      respawnMs: 30000,
      special: true,
      color: 0x7a5cff,
      blurb: "ボタンで拾う。研究机の材料",
    },
  };

  const resourceOrder = ["twig", "pebble", "berry", "plank", "mushroom"];

  function node(type, index, x, y) {
    return { id: type + "-" + index, type: type, x: x, y: y };
  }

  const nodes = [
    node("twig", 1, 640, 1060),
    node("twig", 2, 470, 1160),
    node("twig", 3, 820, 1180),
    node("twig", 4, 500, 1420),
    node("twig", 5, 700, 960),
    node("twig", 6, 540, 540),
    node("twig", 7, 980, 1120),
    node("twig", 8, 1060, 1160),
    node("twig", 9, 1140, 1120),
    node("twig", 10, 1000, 1240),
    node("twig", 11, 1100, 1280),
    node("twig", 12, 960, 1340),
    node("twig", 13, 1080, 1380),
    node("twig", 14, 1160, 1320),
    node("pebble", 1, 780, 1460),
    node("pebble", 2, 430, 1280),
    node("pebble", 3, 560, 820),
    node("pebble", 4, 700, 420),
    node("pebble", 5, 250, 1200),
    node("pebble", 6, 320, 1420),
    node("pebble", 7, 200, 1000),
    node("pebble", 8, 380, 1000),
    node("pebble", 9, 900, 980),
    node("pebble", 10, 1040, 900),
    node("berry", 1, 690, 1500),
    node("berry", 2, 860, 1280),
    node("berry", 3, 730, 680),
    node("berry", 4, 300, 600),
    node("berry", 5, 400, 450),
    node("berry", 6, 250, 800),
    node("berry", 7, 150, 1480),
    node("berry", 8, 1180, 1480),
    node("mushroom", 1, 640, 250),
    node("mushroom", 2, 560, 330),
    node("mushroom", 3, 730, 310),
  ];

  const nodeMap = {};
  nodes.forEach(function (entry) {
    if (nodeMap[entry.id]) {
      throw new Error("duplicate node " + entry.id);
    }
    nodeMap[entry.id] = entry;
  });

  root.GAME_CONFIG = {
    title: "ひみつきちつくろ",
    saveVersion: 1,
    saveKey: "himitsukichi-tsukuro-v1",
    fontFamily:
      '"Hiragino Maru Gothic ProN", "Yu Gothic", "YuGothic", "Hiragino Sans", "Noto Sans JP", "WenQuanYi Micro Hei", "Droid Sans Fallback", sans-serif',

    playerSpeed: 190,
    autoCollectRadius: 48,
    interactRadius: 62,
    baseCarry: 8,
    backpackCarry: 18,
    backpackCost: 8,
    backpackName: "小さなリュック",
    baseStorage: 16,
    boxStorageBonus: 28,
    maxFrameMs: 100,
    autosaveMs: 4000,

    world: {
      width: 1280,
      height: 1680,
      pad: 28,
      baseX: 640,
      baseY: 1280,
      baseRadius: 120,
      groveX: 640,
      groveY: 280,
      groveRadius: 150,
    },

    slots: {
      box: { x: 560, y: 1340 },
      workbench: { x: 730, y: 1330 },
      desk: { x: 640, y: 1188 },
      shop: { x: 720, y: 1224 },
    },

    helperPath: { x1: 560, y1: 1200, x2: 720, y2: 1168 },

    camera: {
      /* CSS 幅に対する倍率。1 より小さいほど引いて、地図が広く見える。
         ブラウザのページ拡大とは別。実機の初期画面（旧 1.62）より引く。 */
      phone: 1,
      tablet: 1.05,
      desktop: 1.2,
    },

    helper: {
      name: "木こり",
      hireCost: 8,
      intervalMs: 2000,
      resource: "twig",
      amount: 1,
    },

    workbench: {
      intervalMs: 2500,
      input: "twig",
      inputAmount: 2,
      output: "plank",
      outputAmount: 1,
    },

    buildings: {
      box: {
        name: "木箱",
        effect: "保管が増える",
        coins: 4,
        cost: { twig: 3, pebble: 2 },
      },
      workbench: {
        name: "作業台",
        effect: "枝を木材にする",
        coins: 8,
        cost: { twig: 4, pebble: 2 },
      },
      desk: {
        name: "研究机",
        effect: "光る林の記録。次の不思議への入口",
        coins: 6,
        cost: { plank: 1, mushroom: 1 },
        requiresDiscovery: true,
      },
    },

    buildingOrder: ["box", "workbench", "desk"],
    treeCount: 30,
    flowerCount: 42,
    layoutSeed: 20261025,
    flowerColors: [0xf2d36b, 0xf3a3b5, 0xfffaf3],

    resources: resources,
    resourceOrder: resourceOrder,
    nodes: nodes,
    nodeMap: nodeMap,

    hex: function (color) {
      return "#" + color.toString(16).padStart(6, "0");
    },
  };
})(globalThis);
