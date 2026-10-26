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
    node("twig", 1, 780, 1020),
    node("twig", 2, 470, 1160),
    node("twig", 3, 820, 1180),
    node("twig", 4, 360, 1180),
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
    node("pebble", 1, 1020, 1500),
    node("pebble", 2, 430, 1280),
    node("pebble", 3, 560, 820),
    node("pebble", 4, 700, 420),
    node("pebble", 5, 250, 1200),
    node("pebble", 6, 320, 1420),
    node("pebble", 7, 200, 1000),
    node("pebble", 8, 380, 1000),
    node("pebble", 9, 900, 980),
    node("pebble", 10, 1040, 900),
    node("berry", 1, 250, 1580),
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

    /* 110 は表示倍率 0.55 のときの世界座標 px/s。歩き 14fps の 4 コマが約 0.29 秒。 */
    playerSpeed: 110,
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

    /* 小屋（base.png × 1.25、足元が拠点の中心）の外に置く。机とお店は左右、木箱と作業台は手前。 */
    slots: {
      box: { x: 545, y: 1392 },
      workbench: { x: 755, y: 1392 },
      desk: { x: 500, y: 1508 },
      shop: { x: 760, y: 1524 },
    },

    /* manifest.json v5 の ingame。表示倍率はこの値のまま使う。 */
    art: {
      characters: 0.55,
      trees: 1.4,
      base: 1.25,
      flowers: 1,
      stone: 1,
      furniture: 1,
      pickups: {
        twig: 0.4,
        pebble: 0.6,
        berry: 0.63,
        plank: 0.54,
        mushroom: 0.47,
        backpack: 0.51,
      },
      walkFps: 14,
      idleFps: 2,
      swayFps: 3,
      feetY: 126,
      frame: 128,
      shadowW: 28,
      shadowH: 8,
      bodyRadius: 11,
      trunkRadius: 15,
      pathWidth: 188,
      pond: { x: 200, y: 455, w: 240, h: 150 },
      /* 扉の手前（拠点の中心）は歩ける。壁と屋根だけ止める。 */
      hut: { dx: 0, dy: -100, rx: 92, ry: 48 },
      stones: [
        { x: 360, y: 1040 },
        { x: 930, y: 1080 },
        { x: 250, y: 1360 },
        { x: 1040, y: 1320 },
        { x: 160, y: 640 },
        { x: 1100, y: 780 },
        { x: 420, y: 1560 },
        { x: 900, y: 1580 },
      ],
    },

    camera: {
      /* CSS 幅に対する倍率。1 より小さいほど引いて、地図が広く見える。
         ブラウザのページ拡大とは別。実機の初期画面（旧 1.62）より引く。 */
      phone: 1,
      tablet: 1.05,
      desktop: 1.2,
    },

    helper: {
      name: "枝拾いおじさん",
      hireCost: 8,
      resource: "twig",
      amount: 1,
    },

    /* 仲間。speed / carry / actMs は強化の段。upgrades の costs は次の段のコイン。 */
    crewOrder: ["twig", "pebble", "berry", "craft", "clerk"],
    crew: {
      twig: {
        name: "枝拾いおじさん",
        kind: "gather",
        resource: "twig",
        hireCost: 8,
        tint: 0,
        home: { x: 640, y: 1360 },
        speed: [100, 130, 165],
        carry: [3, 5, 8],
        actMs: [620, 400, 250],
        upgrades: {
          speed: { name: "足が速い", costs: [8, 18] },
          carry: { name: "たくさん持つ", costs: [10, 22] },
          haste: { name: "拾うのが速い", costs: [8, 18] },
          n: { name: "もう一人", costs: [16, 36] },
        },
      },
      pebble: {
        name: "石拾いさん",
        kind: "gather",
        resource: "pebble",
        hireCost: 10,
        tint: 0xc5d0d4,
        home: { x: 560, y: 1340 },
        speed: [96, 126, 160],
        carry: [3, 5, 8],
        actMs: [640, 420, 260],
        upgrades: {
          speed: { name: "足が速い", costs: [10, 22] },
          carry: { name: "たくさん持つ", costs: [12, 26] },
          haste: { name: "拾うのが速い", costs: [10, 22] },
          n: { name: "もう一人", costs: [20, 42] },
        },
      },
      berry: {
        name: "木の実拾いさん",
        kind: "gather",
        resource: "berry",
        hireCost: 14,
        tint: 0xf0b4b0,
        home: { x: 720, y: 1340 },
        speed: [96, 126, 160],
        carry: [2, 4, 6],
        actMs: [640, 420, 260],
        upgrades: {
          speed: { name: "足が速い", costs: [12, 26] },
          carry: { name: "たくさん持つ", costs: [14, 30] },
          haste: { name: "拾うのが速い", costs: [12, 26] },
          n: { name: "もう一人", costs: [24, 48] },
        },
      },
      craft: {
        name: "作業職人",
        kind: "craft",
        needs: "workbench",
        hireCost: 22,
        tint: 0xf0d59a,
        home: { x: 700, y: 1420 },
        stand: { x: 740, y: 1436 },
        speed: [90, 120, 150],
        carry: [1, 2, 3],
        actMs: [880, 560, 340],
        upgrades: {
          speed: { name: "足が速い", costs: [12, 26] },
          carry: { name: "まとめ作り", costs: [16, 34] },
          haste: { name: "手が速い", costs: [14, 30] },
          n: { name: "もう一人", costs: [28, 56] },
        },
      },
      clerk: {
        name: "店番",
        kind: "clerk",
        hireCost: 18,
        tint: 0xd2c2f4,
        home: { x: 800, y: 1560 },
        stand: { x: 760, y: 1572 },
        speed: [100, 130, 165],
        carry: [1, 2, 3],
        actMs: [520, 340, 220],
        upgrades: {
          speed: { name: "足が速い", costs: [12, 24] },
          carry: { name: "多く飾る", costs: [14, 30] },
          haste: { name: "置くのが速い", costs: [10, 22] },
          n: { name: "もう一人", costs: [24, 48] },
        },
      },
    },

    workbench: {
      intervalMs: 2500,
      input: "twig",
      inputAmount: 2,
      output: "plank",
      outputAmount: 1,
    },

    /* 作業台で材料から作る品。price はお客さんが買うコイン。 */
    products: {
      tombo: {
        name: "竹とんぼ",
        price: 12,
        cost: { twig: 1, plank: 1 },
        color: 0x7dae4a,
      },
      ame: {
        name: "木の実アメ",
        price: 10,
        cost: { berry: 2, twig: 1 },
        color: 0xd4534a,
      },
      koma: {
        name: "石のコマ",
        price: 8,
        cost: { pebble: 2, twig: 1 },
        color: 0x8a9396,
      },
      lamp: {
        name: "光るランプ",
        price: 28,
        cost: { mushroom: 1, plank: 1 },
        color: 0x7a5cff,
      },
    },
    productOrder: ["tombo", "ame", "koma", "lamp"],

    shop: {
      displaySlots: 3,
      customerMs: 5000,
    },

    /* リュックの底の位置。0 が足元。小さいほど背中の下。 */
    pack: { idleY: -8, downY: -8, upY: -6, sideY: -8, sideX: 7 },

    buildings: {
      box: {
        name: "木箱",
        effect: "秘密基地に置く木箱",
        coins: 4,
        cost: { twig: 3, pebble: 2 },
      },
      workbench: {
        name: "作業台",
        effect: "枝を木材にし、品物も作る",
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
