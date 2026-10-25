/* ひみつきちつくろ — 仮の図形と同じ絵の一覧。
   ゲームは assets/{file} を読み、無いときは図形のまま。
   おえかき（draw/）もこの一覧をそのまま使う。 */
(function (root) {
  "use strict";

  const SPRITE_LIST = [
    { key: "player", name: "主人公（正面）", file: "player.png", width: 96, height: 128, displayW: 48, displayH: 64, anchorY: 0.85 },
    { key: "backpack", name: "ちいさなりゅっく", file: "backpack.png", width: 64, height: 80, displayW: 18, displayH: 22, anchorY: 0.5 },
    { key: "helper", name: "きこり", file: "helper.png", width: 96, height: 128, displayW: 44, displayH: 60, anchorY: 0.85 },
    { key: "twig", name: "えだ", file: "twig.png", width: 128, height: 64, displayW: 36, displayH: 18, anchorY: 0.5 },
    { key: "pebble", name: "こいし", file: "pebble.png", width: 64, height: 64, displayW: 28, displayH: 22, anchorY: 0.5 },
    { key: "berry", name: "きのみ", file: "berry.png", width: 64, height: 64, displayW: 28, displayH: 28, anchorY: 0.5 },
    { key: "plank", name: "もくざい", file: "plank.png", width: 128, height: 64, displayW: 36, displayH: 18, anchorY: 0.5 },
    { key: "mushroom", name: "ひかるきのこ", file: "mushroom.png", width: 64, height: 96, displayW: 32, displayH: 40, anchorY: 0.8 },
    { key: "box", name: "きばこ", file: "box.png", width: 96, height: 80, displayW: 48, displayH: 40, anchorY: 0.75 },
    { key: "workbench", name: "さぎょうだい", file: "workbench.png", width: 112, height: 80, displayW: 56, displayH: 40, anchorY: 0.75 },
    { key: "desk", name: "けんきゅうづくえ", file: "desk.png", width: 96, height: 80, displayW: 48, displayH: 40, anchorY: 0.75 },
    { key: "shop", name: "おみせ", file: "shop.png", width: 128, height: 96, displayW: 64, displayH: 52, anchorY: 0.8 },
    { key: "marker", name: "たてる場所", file: "marker.png", width: 80, height: 64, displayW: 40, displayH: 28, anchorY: 0.7 },
    { key: "tree", name: "木", file: "tree.png", width: 96, height: 128, displayW: 48, displayH: 72, anchorY: 0.9 },
    { key: "tree-dark", name: "木（こいみどり）", file: "tree-dark.png", width: 96, height: 128, displayW: 48, displayH: 72, anchorY: 0.9 },
    { key: "flower", name: "花（きいろ）", file: "flower.png", width: 64, height: 64, displayW: 14, displayH: 14, anchorY: 0.5 },
    { key: "flower-pink", name: "花（ピンク）", file: "flower-pink.png", width: 64, height: 64, displayW: 14, displayH: 14, anchorY: 0.5 },
    { key: "flower-white", name: "花（しろ）", file: "flower-white.png", width: 64, height: 64, displayW: 14, displayH: 14, anchorY: 0.5 },
    { key: "stone", name: "まわりのいし", file: "stone.png", width: 48, height: 32, displayW: 18, displayH: 12, anchorY: 0.5 },
  ];

  const SPRITE_BY_KEY = {};
  SPRITE_LIST.forEach(function (sprite) {
    SPRITE_BY_KEY[sprite.key] = sprite;
  });

  root.SPRITE_LIST = SPRITE_LIST;
  root.SPRITE_BY_KEY = SPRITE_BY_KEY;
})(globalThis);
