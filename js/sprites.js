/* ひみつきちつくろ — 絵の一覧。
   ゲームは assets/{file} を読み、無いときは図形のまま。
   display と anchor は、描いた線の範囲に合わせて地面に乗る大きさ。PNG は加工しない。
   おえかき（draw/）もこの一覧をそのまま使う。 */
(function (root) {
  "use strict";

  const SPRITE_LIST = [
    { key: "player", name: "主人公（正面）", file: "player.png", width: 96, height: 128, displayW: 53, displayH: 71, anchorX: 0.58, anchorY: 0.91 },
    { key: "backpack", name: "小さなリュック", file: "backpack.png", width: 64, height: 80, displayW: 31, displayH: 39, anchorX: 0.5, anchorY: 0.52 },
    { key: "helper", name: "木こり", file: "helper.png", width: 96, height: 128, displayW: 58, displayH: 77, anchorX: 0.58, anchorY: 0.9 },
    { key: "twig", name: "枝", file: "twig.png", width: 128, height: 64, displayW: 50, displayH: 25, anchorX: 0.56, anchorY: 0.41 },
    { key: "pebble", name: "小石", file: "pebble.png", width: 64, height: 64, displayW: 45, displayH: 45, anchorX: 0.41, anchorY: 0.62 },
    { key: "berry", name: "木の実", file: "berry.png", width: 64, height: 64, displayW: 32, displayH: 32, anchorX: 0.51, anchorY: 0.58 },
    { key: "plank", name: "木材", file: "plank.png", width: 128, height: 64, displayW: 36, displayH: 18, anchorX: 0.53, anchorY: 0.54 },
    { key: "mushroom", name: "光るキノコ", file: "mushroom.png", width: 64, height: 96, displayW: 26, displayH: 39, anchorX: 0.49, anchorY: 0.97 },
    { key: "box", name: "木箱", file: "box.png", width: 96, height: 80, displayW: 68, displayH: 57, anchorX: 0.52, anchorY: 0.84 },
    { key: "workbench", name: "作業台", file: "workbench.png", width: 112, height: 80, displayW: 71, displayH: 51, anchorX: 0.56, anchorY: 0.93 },
    { key: "desk", name: "研究机", file: "desk.png", width: 96, height: 80, displayW: 76, displayH: 63, anchorX: 0.43, anchorY: 0.88 },
    { key: "shop", name: "お店", file: "shop.png", width: 128, height: 96, displayW: 74, displayH: 56, anchorX: 0.53, anchorY: 0.93 },
    { key: "marker", name: "建てる場所", file: "marker.png", width: 80, height: 64, displayW: 41, displayH: 33, anchorX: 0.54, anchorY: 0.86 },
    { key: "tree", name: "木", file: "tree.png", width: 96, height: 128, displayW: 64, displayH: 86, anchorX: 0.52, anchorY: 0.98 },
    { key: "tree-dark", name: "木（濃い緑）", file: "tree-dark.png", width: 96, height: 128, displayW: 61, displayH: 81, anchorX: 0.51, anchorY: 0.96 },
    { key: "flower", name: "花（黄色）", file: "flower.png", width: 64, height: 64, displayW: 20, displayH: 20, anchorX: 0.48, anchorY: 0.52 },
    { key: "flower-pink", name: "花（ピンク）", file: "flower-pink.png", width: 64, height: 64, displayW: 20, displayH: 20, anchorX: 0.49, anchorY: 0.43 },
    { key: "flower-white", name: "花（白）", file: "flower-white.png", width: 64, height: 64, displayW: 22, displayH: 22, anchorX: 0.58, anchorY: 0.49 },
    { key: "stone", name: "周りの石", file: "stone.png", width: 48, height: 32, displayW: 51, displayH: 34, anchorX: 0.5, anchorY: 0.69 },
  ];

  const SPRITE_BY_KEY = {};
  SPRITE_LIST.forEach(function (sprite) {
    SPRITE_BY_KEY[sprite.key] = sprite;
  });

  root.SPRITE_LIST = SPRITE_LIST;
  root.SPRITE_BY_KEY = SPRITE_BY_KEY;
})(globalThis);
