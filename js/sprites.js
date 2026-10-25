/* ひみつきちつくろ — 絵の一覧。
   ゲームは assets/{file} を読み、無いときは図形のまま。
   表示倍率は config.js の art。おえかき（draw/）はこの幅と高さを使う。 */
(function (root) {
  "use strict";

  const SPRITE_LIST = [
    { key: "player", name: "主人公（正面）", file: "player.png", width: 96, height: 128, displayW: 48, displayH: 64, anchorY: 0.85 },
    { key: "backpack", name: "小さなリュック", file: "backpack.png", width: 64, height: 80, displayW: 18, displayH: 22, anchorY: 0.5 },
    { key: "helper", name: "木こり", file: "helper.png", width: 96, height: 128, displayW: 44, displayH: 60, anchorY: 0.85 },
    { key: "twig", name: "枝", file: "twig.png", width: 128, height: 64, displayW: 36, displayH: 18, anchorY: 0.5 },
    { key: "pebble", name: "小石", file: "pebble.png", width: 64, height: 64, displayW: 28, displayH: 22, anchorY: 0.5 },
    { key: "berry", name: "木の実", file: "berry.png", width: 64, height: 64, displayW: 28, displayH: 28, anchorY: 0.5 },
    { key: "plank", name: "木材", file: "plank.png", width: 128, height: 64, displayW: 36, displayH: 18, anchorY: 0.5 },
    { key: "mushroom", name: "光るキノコ", file: "mushroom.png", width: 64, height: 96, displayW: 32, displayH: 40, anchorY: 0.8 },
    { key: "box", name: "木箱", file: "box.png", width: 96, height: 80, displayW: 48, displayH: 40, anchorY: 0.75 },
    { key: "workbench", name: "作業台", file: "workbench.png", width: 112, height: 80, displayW: 56, displayH: 40, anchorY: 0.75 },
    { key: "desk", name: "研究机", file: "desk.png", width: 96, height: 80, displayW: 48, displayH: 40, anchorY: 0.75 },
    { key: "shop", name: "お店", file: "shop.png", width: 128, height: 96, displayW: 64, displayH: 52, anchorY: 0.8 },
    { key: "marker", name: "建てる場所", file: "marker.png", width: 80, height: 64, displayW: 40, displayH: 28, anchorY: 0.7 },
    { key: "tree", name: "木", file: "tree.png", width: 96, height: 128, displayW: 48, displayH: 72, anchorY: 0.9 },
    { key: "tree-dark", name: "木（濃い緑）", file: "tree-dark.png", width: 96, height: 128, displayW: 48, displayH: 72, anchorY: 0.9 },
    { key: "flower", name: "花（黄色）", file: "flower.png", width: 64, height: 64, displayW: 14, displayH: 14, anchorY: 0.5 },
    { key: "flower-pink", name: "花（ピンク）", file: "flower-pink.png", width: 64, height: 64, displayW: 14, displayH: 14, anchorY: 0.5 },
    { key: "flower-white", name: "花（白）", file: "flower-white.png", width: 64, height: 64, displayW: 14, displayH: 14, anchorY: 0.5 },
    { key: "stone", name: "周りの石", file: "stone.png", width: 48, height: 32, displayW: 18, displayH: 12, anchorY: 0.5 },
  ];

  const SPRITE_BY_KEY = {};
  SPRITE_LIST.forEach(function (sprite) {
    SPRITE_BY_KEY[sprite.key] = sprite;
  });

  root.SPRITE_LIST = SPRITE_LIST;
  root.SPRITE_BY_KEY = SPRITE_BY_KEY;
})(globalThis);
