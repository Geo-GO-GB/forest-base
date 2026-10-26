/* 依存なし。node tests/logic.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

function load(file) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function(code)();
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: function (key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem: function (key, value) {
      map.set(key, String(value));
    },
    removeItem: function (key) {
      map.delete(key);
    },
  };
}

load("js/config.js");
load("js/format.js");
load("js/layout.js");
load("js/nav.js");
load("js/sim.js");
load("js/save.js");
load("js/sprites.js");

const CFG = globalThis.GAME_CONFIG;
const Nav = globalThis.Nav;
const Sim = globalThis.Sim;
const Format = globalThis.Format;
const Save = globalThis.Save;
globalThis.localStorage = memoryStorage();

let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("ok", name);
  } catch (err) {
    failed += 1;
    console.error("FAIL", name);
    console.error(err);
  }
}

function fresh() {
  globalThis.localStorage = memoryStorage();
  return Save.load().state;
}

test("nodes stay inside the map and out of the base circle", function () {
  let closest = Infinity;
  CFG.nodes.forEach(function (node, index) {
    assert.ok(node.x > CFG.world.pad && node.x < CFG.world.width - CFG.world.pad, node.id);
    assert.ok(node.y > CFG.world.pad && node.y < CFG.world.height - CFG.world.pad, node.id);
    const home = Math.hypot(node.x - CFG.world.baseX, node.y - CFG.world.baseY);
    if (!CFG.resources[node.type].special) {
      assert.ok(home > CFG.world.baseRadius + 20, node.id + " home " + home);
    }
    for (let j = index + 1; j < CFG.nodes.length; j += 1) {
      const other = CFG.nodes[j];
      closest = Math.min(closest, Math.hypot(node.x - other.x, node.y - other.y));
    }
  });
  assert.ok(closest >= 48, "closest nodes " + closest);
  const mushrooms = CFG.nodes.filter(function (node) {
    return node.type === "mushroom";
  });
  assert.equal(mushrooms.length, 3);
  mushrooms.forEach(function (node) {
    assert.equal(CFG.resources[node.type].special, true);
    const d = Math.hypot(node.x - CFG.world.groveX, node.y - CFG.world.groveY);
    assert.ok(d < CFG.world.groveRadius, node.id);
  });
});

test("decor is stable and keeps the clearing open", function () {
  const a = Layout.generateDecor(CFG);
  const b = Layout.generateDecor(CFG);
  assert.deepEqual(a, b);
  assert.ok(a.trees.length >= 20, "trees " + a.trees.length);
  a.trees.forEach(function (tree) {
    const home = Math.hypot(tree.x - CFG.world.baseX, tree.y - CFG.world.baseY);
    assert.ok(home > CFG.world.baseRadius);
  });
});

test("special mushrooms are not auto-collected", function () {
  const state = fresh();
  const id = "mushroom-1";
  const skipped = Sim.collect(state, id, false);
  assert.equal(skipped.ok, false);
  assert.equal(skipped.reason, "manual");
  assert.equal(state.nodes[id].depleted, false);
  const picked = Sim.collect(state, id, true);
  assert.equal(picked.ok, true);
  assert.equal(picked.discovered, true);
  assert.equal(state.discoveredMushroom, true);
  assert.equal(state.carry.mushroom, 1);
  assert.equal(Sim.collect(state, "mushroom-2", true).discovered, false);
});

test("common resources have no carry or storage cap", function () {
  const state = fresh();
  const twigs = CFG.nodes.filter(function (node) {
    return node.type === "twig";
  });
  for (let i = 0; i < twigs.length; i += 1) {
    assert.equal(Sim.collect(state, twigs[i].id, false).ok, true);
  }
  assert.equal(state.carry.twig, twigs.length);
  state.carry.twig = 5000;
  const deposited = Sim.deposit(state);
  assert.equal(deposited.moved, 5000);
  assert.equal(deposited.blocked, false);
  assert.equal(state.carry.twig, 0);
  assert.equal(state.storage.twig, 5000);
});

test("deposit, sell, backpack, build, and hire", function () {
  const state = fresh();
  state.carry.twig = 6;
  state.carry.pebble = 4;
  state.carry.berry = 2;
  const deposited = Sim.deposit(state);
  assert.ok(deposited.moved >= 8);
  assert.equal(Sim.bagCount(state.carry), 0);
  const sold = Sim.sell(state, "berry", true);
  assert.equal(sold.gained, 4);
  assert.equal(state.coins, 4);
  Sim.sell(state, "twig", false);
  assert.equal(state.coins, 5);
  assert.equal(state.storage.twig, 5);
  state.coins = 30;
  assert.equal(Sim.buyBackpack(state).ok, true);
  assert.equal(state.backpack, true);
  assert.equal(Sim.buyBackpack(state).reason, "owned");
  assert.equal(Sim.build(state, "workbench").ok, true);
  assert.equal(state.buildings.workbench, true);
  assert.equal(Sim.build(state, "desk").reason, "locked");
  state.discoveredMushroom = true;
  state.carry.mushroom = 1;
  state.storage.plank = 1;
  assert.equal(Sim.build(state, "desk").ok, true);
  assert.equal(state.buildings.desk, true);
  assert.equal(Sim.hire(state).ok, true);
  assert.equal(state.helperHired, true);
});

test("workbench stops without twigs, then crafts", function () {
  const state = fresh();
  state.buildings.workbench = true;
  let result = Sim.tickProduction(state, 16);
  assert.equal(result.workbench, "no-input");
  assert.equal(state.storage.plank, 0);
  state.storage.twig = 4;
  const frames = Math.ceil(CFG.workbench.intervalMs / 16);
  for (let i = 0; i < frames; i += 1) result = Sim.tickProduction(state, 16);
  assert.equal(state.storage.plank, 1);
  assert.equal(state.storage.twig, 2);
  assert.equal(result.workbench, "run");
});

test("helper keeps gathering without a storage cap", function () {
  const state = fresh();
  state.helperHired = true;
  state.storage.twig = 100;
  assert.equal(Sim.grantStorage(state, "twig", 3), 3);
  assert.equal(state.storage.twig, 103);
  Sim.tickProduction(state, 16 * 40);
  assert.equal(state.storage.twig, 103);
});

test("a huge delta does not grant offline production", function () {
  const state = fresh();
  state.helperHired = true;
  state.buildings.workbench = true;
  state.storage.twig = 6;
  state.progress.helperMs = 0;
  state.progress.workbenchMs = 0;
  Sim.tickProduction(state, 24 * 60 * 60 * 1000);
  Sim.tickRespawn(state, 24 * 60 * 60 * 1000);
  assert.ok(state.progress.helperMs <= CFG.maxFrameMs);
  assert.ok(state.progress.workbenchMs <= CFG.maxFrameMs);
  assert.equal(state.storage.twig, 6);
  assert.equal(state.storage.plank, 0);
});

test("zero delta does not finish a craft", function () {
  const state = fresh();
  state.helperHired = true;
  state.progress.helperMs = 40;
  Sim.tickProduction(state, 0);
  assert.equal(state.storage.twig, 0);
  assert.equal(state.progress.helperMs, 40);
});

test("counts use short suffixes and drop a trailing zero", function () {
  assert.equal(Format.count(0), "0");
  assert.equal(Format.count(999), "999");
  assert.equal(Format.count(1000), "1k");
  assert.equal(Format.count(1200), "1.2k");
  assert.equal(Format.count(1999), "2k");
  assert.equal(Format.count(3400000), "3.4M");
  assert.equal(Format.count(5600000000), "5.6G");
  assert.equal(Format.count(7800000000000), "7.8T");
  assert.equal(Format.count(7800000000000000), "7.8P");
});

test("workbench products can be displayed and sold to a visitor", function () {
  const state = fresh();
  assert.equal(Sim.craft(state, "tombo").reason, "need-bench");
  state.buildings.workbench = true;
  state.storage.twig = 3;
  state.storage.plank = 2;
  state.storage.berry = 2;
  assert.equal(Sim.craft(state, "tombo").ok, true);
  assert.equal(state.goods.tombo, 1);
  assert.equal(state.storage.twig, 2);
  assert.equal(state.storage.plank, 1);
  assert.equal(Sim.craft(state, "ame").ok, true);
  assert.equal(Sim.displayProduct(state, "tombo").ok, true);
  assert.equal(state.goods.tombo, 0);
  assert.equal(state.display[0], "tombo");
  assert.equal(Sim.displayProduct(state, "ame").index, 1);
  state.display[2] = "tombo";
  state.goods.koma = 1;
  assert.equal(Sim.displayProduct(state, "koma").reason, "display-full");
  state.progress.customerMs = CFG.shop.customerMs - 10;
  assert.equal(Sim.customerDue(state, 16), true);
  const sale = Sim.buyDisplayed(state);
  assert.equal(sale.id, "tombo");
  assert.equal(sale.gained, CFG.products.tombo.price);
  assert.equal(state.coins, CFG.products.tombo.price);
  assert.equal(state.display[0], "");
  state.progress.customerMs = 0;
  Sim.customerDue(state, 24 * 60 * 60 * 1000);
  assert.ok(state.progress.customerMs <= CFG.maxFrameMs);
  assert.equal(state.coins, CFG.products.tombo.price);
});

test("save roundtrip keeps progress and ignores an old timestamp", function () {
  globalThis.localStorage = memoryStorage();
  const state = Save.load().state;
  state.coins = 12;
  state.player.x = 700;
  state.player.y = 900;
  state.helperHired = true;
  state.buildings.workbench = true;
  state.discoveredMushroom = true;
  state.storage.twig = 3;
  state.carry.berry = 1;
  state.coins = 7800000000000;
  state.carry.twig = 1200;
  state.goods.tombo = 2;
  state.display[0] = "ame";
  state.progress.customerMs = 40;
  state.progress.helperMs = 40;
  state.crew.twig.speed = 1;
  state.crew.twig.n = 1;
  state.crew.pebble.hired = true;
  state.nodes["twig-1"].depleted = true;
  state.nodes["twig-1"].respawnMs = 1234;
  state.savedAt = Date.now() - 48 * 60 * 60 * 1000;
  assert.equal(Save.save(state).ok, true);
  const loaded = Save.load();
  assert.equal(loaded.warning, "");
  assert.equal(loaded.state.coins, 7800000000000);
  assert.equal(loaded.state.carry.twig, 1200);
  assert.equal(loaded.state.player.x, 700);
  assert.equal(loaded.state.storage.twig, 3);
  assert.equal(loaded.state.carry.berry, 1);
  assert.equal(loaded.state.goods.tombo, 2);
  assert.equal(loaded.state.display[0], "ame");
  assert.equal(loaded.state.progress.customerMs, 40);
  assert.equal(loaded.state.progress.helperMs, 40);
  assert.equal(loaded.state.crew.twig.hired, true);
  assert.equal(loaded.state.crew.twig.speed, 1);
  assert.equal(loaded.state.crew.twig.n, 1);
  assert.equal(loaded.state.crew.pebble.hired, true);
  assert.equal(loaded.state.nodes["twig-1"].depleted, true);
  assert.equal(loaded.state.nodes["twig-1"].respawnMs, 1234);
  assert.equal(loaded.state.helperHired, true);
  assert.notEqual(loaded.state.savedAt, 0);
});

test("an old wooden box save refunds its cost and still loads", function () {
  const ls = memoryStorage();
  globalThis.localStorage = ls;
  ls.setItem(CFG.saveKey, JSON.stringify({
    version: 1,
    coins: 3,
    buildings: { box: true, workbench: true, desk: false },
    storage: { twig: 1, pebble: 4 },
    helperHired: true,
  }));
  const loaded = Save.load();
  assert.equal(loaded.warning, "");
  assert.equal(loaded.locked, false);
  assert.equal(loaded.state.coins, 7);
  assert.equal(loaded.state.storage.twig, 4);
  assert.equal(loaded.state.storage.pebble, 6);
  assert.equal(loaded.state.buildings.box, undefined);
  assert.equal(loaded.state.buildings.workbench, true);
  assert.equal(loaded.state.buildings.desk, false);
  assert.equal(loaded.state.helperHired, true);
  assert.equal(Sim.build(loaded.state, "box").reason, "missing");
  assert.equal(Save.save(loaded.state).ok, true);
  const again = Save.load();
  assert.equal(again.state.coins, 7);
  assert.equal(again.state.storage.twig, 4);
  assert.equal(again.state.storage.pebble, 6);
});

test("corrupt saves are quarantined and a newer version is not overwritten", function () {
  const ls = memoryStorage();
  globalThis.localStorage = ls;
  ls.setItem(CFG.saveKey, "{");
  const broken = Save.load();
  assert.match(broken.warning, /読めなかった/);
  assert.equal(broken.state.coins, 0);
  assert.equal(ls.getItem(CFG.saveKey), null);
  assert.equal(ls.getItem(CFG.saveKey + ":quarantine"), "{");

  const future = JSON.stringify({ version: 99, coins: 50 });
  ls.setItem(CFG.saveKey, future);
  const newer = Save.load();
  assert.equal(newer.locked, true);
  assert.equal(newer.state.coins, 0);
  assert.equal(Save.save(newer.state).ok, false);
  assert.equal(ls.getItem(CFG.saveKey), future);
});

test("sprite list is one entry per placeholder the game can swap", function () {
  const list = globalThis.SPRITE_LIST;
  const by = globalThis.SPRITE_BY_KEY;
  assert.equal(list.length, 30);
  const seen = {};
  list.forEach(function (sprite) {
    assert.ok(!seen[sprite.key], "duplicate " + sprite.key);
    seen[sprite.key] = true;
    assert.equal(by[sprite.key], sprite);
    assert.equal(sprite.file, sprite.key + ".png");
    assert.equal(typeof sprite.name, "string");
    assert.ok(sprite.name.length > 0, sprite.key);
    assert.ok(sprite.width >= 16 && sprite.height >= 16, sprite.key);
    assert.ok(sprite.displayW > 0 && sprite.displayH > 0, sprite.key);
  });
  const game = fs.readFileSync(path.join(__dirname, "../js/game.js"), "utf8");
  const ui = fs.readFileSync(path.join(__dirname, "../js/ui.js"), "utf8");
  ["player", "backpack", "helper", "twig", "pebble", "berry", "mushroom", "workbench", "desk", "shop", "marker", "tree", "tree-dark", "flower", "flower-pink", "flower-white", "stone"].forEach(function (key) {
    assert.ok(game.includes('"' + key + '"'), key);
  });
  assert.equal(seen.plank, true);
  ["pebble-actor", "berry-actor", "craft", "clerk", "customer", "tombo", "ame", "koma", "lamp", "coin", "saw", "stand"].forEach(function (key) {
    assert.equal(seen[key], true, key);
  });
  assert.ok(!game.includes("setTint"), "crew and visitors use their own sprites");
  assert.ok(game.includes('"customer"'));
  assert.ok(game.includes('"stand"'));
  assert.ok(game.includes('"saw"'));
  assert.ok(game.includes('"coin"'));
  assert.ok(CFG.resourceOrder.indexOf("plank") >= 0);
  assert.ok(ui.includes("assets/"));
  assert.ok(game.includes('scene.load.image(sprite.key, "assets/" + sprite.file)'));
  const drawJs = fs.readFileSync(path.join(__dirname, "../draw/draw.js"), "utf8");
  const drawHtml = fs.readFileSync(path.join(__dirname, "../draw/index.html"), "utf8");
  const drawCss = fs.readFileSync(path.join(__dirname, "../draw/draw.css"), "utf8");
  const pages = fs.readFileSync(path.join(__dirname, "../.github/workflows/pages.yml"), "utf8");
  assert.ok(drawJs.includes("himitsukichi-draw-v1"));
  assert.ok(drawJs.includes("manifest.json"));
  assert.ok(drawJs.includes("destination-out"));
  assert.ok(drawJs.includes("preventDefault"));
  assert.ok(drawHtml.includes("まとめて保存"));
  assert.ok(drawHtml.includes("jszip@3.10.1"));
  assert.ok(drawHtml.includes("../js/sprites.js"));
  assert.ok(drawCss.includes("touch-action: none"));
  assert.ok(pages.includes("draw"));
  assert.ok(pages.includes("assets"));
});

test("approved art scales and walk speed stay on the manifest", function () {
  const art = CFG.art;
  assert.equal(CFG.playerSpeed, 110);
  assert.equal(art.characters, 0.55);
  assert.equal(art.trees, 1.4);
  assert.equal(art.base, 1.25);
  assert.equal(art.flowers, 1);
  assert.equal(art.stone, 1);
  assert.equal(art.furniture, 1);
  assert.equal(art.pickups.twig, 0.4);
  assert.equal(art.pickups.pebble, 0.6);
  assert.equal(art.pickups.berry, 0.63);
  assert.equal(art.pickups.plank, 0.54);
  assert.equal(art.pickups.mushroom, 0.47);
  assert.equal(art.pickups.backpack, 0.51);
  assert.equal(art.walkFps, 14);
  assert.equal(art.idleFps, 2);
  assert.equal(art.swayFps, 3);
  assert.equal(art.shadowW, 28);
  assert.equal(art.shadowH, 8);
  assert.equal(art.feetY, 126);
  assert.equal(art.frame, 128);
});

test("the game loop does not fast-forward from savedAt", function () {
  const game = fs.readFileSync(path.join(__dirname, "../js/game.js"), "utf8");
  const save = fs.readFileSync(path.join(__dirname, "../js/save.js"), "utf8");
  const sim = fs.readFileSync(path.join(__dirname, "../js/sim.js"), "utf8");
  assert.ok(game.includes("document.hidden"));
  assert.ok(!game.includes("savedAt"));
  assert.ok(!save.includes("tickProduction"));
  assert.ok(!sim.includes("Date.now"));
  assert.equal(CFG.title, "ひみつきちつくろ");
  assert.ok(CFG.camera.phone <= 1, "phone camera stays zoomed out");
  assert.equal(CFG.camera.lookAhead, undefined);
  const input = fs.readFileSync(path.join(__dirname, "../js/input.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const drawPage = fs.readFileSync(path.join(__dirname, "../draw/index.html"), "utf8");
  assert.ok(input.includes("gesturestart"));
  assert.ok(html.includes("user-scalable=no"));
  assert.ok(html.includes("maximum-scale=1"));
  assert.ok(drawPage.includes("user-scalable=no"));
  assert.ok(game.includes("resolution: 1"));
  assert.ok(!game.includes("lookAhead"));
});

test("routes bend around a solid obstacle", function () {
  const world = { width: 400, height: 400, pad: 8 };
  const colliders = [{ t: "ellipse", x: 200, y: 200, rx: 50, ry: 36 }];
  const path = Nav.route({ x: 200, y: 80 }, { x: 200, y: 320 }, colliders, world, 11);
  assert.ok(path.length >= 2);
  let crossed = false;
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    const steps = 8;
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      if (Nav.hits(x, y, 11, colliders)) crossed = true;
    }
  }
  assert.equal(crossed, false);
});

test("crew upgrades scale and old helper saves hire the uncle", function () {
  const state = fresh();
  state.coins = 100;
  assert.equal(Sim.hireRole(state, "craft").reason, "need-bench");
  assert.equal(Sim.hire(state).ok, true);
  assert.equal(state.helperHired, true);
  assert.equal(state.crew.twig.hired, true);
  assert.equal(Sim.crewStats(state, "twig").n, 1);
  assert.equal(Sim.crewStats(state, "twig").carry, 3);
  const first = Sim.upgradeCost(state, "twig", "n");
  assert.equal(Sim.upgradeRole(state, "twig", "n").ok, true);
  assert.equal(Sim.crewStats(state, "twig").n, 2);
  const second = Sim.upgradeCost(state, "twig", "n");
  assert.ok(second > first);
  assert.equal(Sim.upgradeRole(state, "twig", "speed").ok, true);
  assert.ok(Sim.crewStats(state, "twig").speed > 100);
  state.buildings.workbench = true;
  state.storage.twig = 4;
  state.storage.plank = 2;
  assert.equal(Sim.hireRole(state, "craft").ok, true);
  assert.equal(Sim.hireRole(state, "clerk").ok, true);
  const ls = memoryStorage();
  globalThis.localStorage = ls;
  ls.setItem(CFG.saveKey, JSON.stringify({ version: 1, helperHired: true, coins: 3 }));
  const old = Save.load();
  assert.equal(old.state.helperHired, true);
  assert.equal(old.state.crew.twig.hired, true);
  assert.equal(old.state.crew.pebble.hired, false);
  assert.equal(old.state.coins, 3);
});

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("all logic tests passed");
