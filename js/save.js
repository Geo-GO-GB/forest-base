/* LocalStorage。savedAt は「いつ保存したか」の表示だけ。経過時間では生産しない。 */
(function (root) {
  "use strict";

  let saveLocked = false;
  let lockMessage = "";

  function cfg() {
    return root.GAME_CONFIG;
  }

  function store() {
    try {
      const ls = root.localStorage;
      if (!ls) return null;
      const probe = cfg().saveKey + ":probe";
      ls.setItem(probe, "1");
      ls.removeItem(probe);
      return ls;
    } catch (err) {
      return null;
    }
  }

  function emptyBag() {
    const bag = {};
    const order = cfg().resourceOrder;
    for (let i = 0; i < order.length; i += 1) bag[order[i]] = 0;
    return bag;
  }

  function defaultNodes() {
    const nodes = {};
    const list = cfg().nodes;
    for (let i = 0; i < list.length; i += 1) {
      nodes[list[i].id] = { depleted: false, respawnMs: 0 };
    }
    return nodes;
  }

  function defaultState() {
    const world = cfg().world;
    return {
      version: cfg().saveVersion,
      player: { x: world.baseX, y: world.baseY },
      coins: 0,
      carry: emptyBag(),
      storage: emptyBag(),
      backpack: false,
      buildings: { workbench: false, desk: false },
      helperHired: false,
      discoveredMushroom: false,
      nodes: defaultNodes(),
      progress: { helperMs: 0, workbenchMs: 0, customerMs: 0 },
      goods: root.Sim.emptyGoods(),
      display: root.Sim.emptyDisplay(),
      crew: root.Sim.emptyCrew(),
      tutorialStep: 0,
      savedAt: 0,
    };
  }

  const BIG = 9007199254740991;

  function clampInt(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, Math.floor(number)));
  }

  function normalize(raw) {
    const state = defaultState();
    const world = cfg().world;
    if (raw.player && Number.isFinite(Number(raw.player.x)) && Number.isFinite(Number(raw.player.y))) {
      state.player.x = Math.max(world.pad, Math.min(world.width - world.pad, Number(raw.player.x)));
      state.player.y = Math.max(world.pad, Math.min(world.height - world.pad, Number(raw.player.y)));
    }
    state.coins = clampInt(raw.coins, 0, BIG);
    const order = cfg().resourceOrder;
    for (let i = 0; i < order.length; i += 1) {
      const id = order[i];
      state.carry[id] = clampInt(raw.carry && raw.carry[id], 0, BIG);
      state.storage[id] = clampInt(raw.storage && raw.storage[id], 0, BIG);
    }
    const goods = raw.goods || {};
    const products = cfg().productOrder;
    for (let i = 0; i < products.length; i += 1) {
      state.goods[products[i]] = clampInt(goods[products[i]], 0, BIG);
    }
    const shown = Array.isArray(raw.display) ? raw.display : [];
    for (let i = 0; i < state.display.length; i += 1) {
      const id = shown[i];
      state.display[i] = cfg().products[id] ? id : "";
    }
    state.backpack = raw.backpack === true;
    state.buildings.workbench = !!(raw.buildings && raw.buildings.workbench);
    state.buildings.desk = !!(raw.buildings && raw.buildings.desk);
    if (raw.buildings && raw.buildings.box === true) {
      /* 木箱は無くした。建てていた保存には、当時の代金（コイン4、枝3、小石2）を一度返す。 */
      state.coins = clampInt(state.coins + 4, 0, BIG);
      state.storage.twig = clampInt(state.storage.twig + 3, 0, BIG);
      state.storage.pebble = clampInt(state.storage.pebble + 2, 0, BIG);
    }
    state.crew = root.Sim.emptyCrew();
    const savedCrew = raw.crew || {};
    const crewOrder = cfg().crewOrder;
    for (let i = 0; i < crewOrder.length; i += 1) {
      const id = crewOrder[i];
      const src = savedCrew[id] || {};
      state.crew[id] = {
        hired: src.hired === true,
        speed: clampInt(src.speed, 0, 6),
        carry: clampInt(src.carry, 0, 6),
        haste: clampInt(src.haste, 0, 6),
        n: clampInt(src.n, 0, 4),
      };
    }
    if (raw.helperHired === true) state.crew.twig.hired = true;
    state.helperHired = state.crew.twig.hired;
    state.discoveredMushroom = raw.discoveredMushroom === true || state.buildings.desk;
    const savedNodes = raw.nodes || {};
    const list = cfg().nodes;
    for (let i = 0; i < list.length; i += 1) {
      const saved = savedNodes[list[i].id];
      if (!saved || typeof saved !== "object") continue;
      state.nodes[list[i].id] = {
        depleted: saved.depleted === true,
        respawnMs: clampInt(saved.respawnMs, 0, 600000),
      };
    }
    const progress = raw.progress || {};
    state.progress.helperMs = clampInt(progress.helperMs, 0, 600000);
    state.progress.workbenchMs = clampInt(progress.workbenchMs, 0, 600000);
    state.progress.customerMs = clampInt(progress.customerMs, 0, 600000);
    state.tutorialStep = clampInt(raw.tutorialStep, 0, 20);
    state.savedAt = clampInt(raw.savedAt, 0, 9000000000000000);
    return state;
  }

  function load() {
    saveLocked = false;
    lockMessage = "";
    const fresh = defaultState();
    const ls = store();
    if (!ls) {
      return {
        state: fresh,
        hadSave: false,
        locked: false,
        warning: "このブラウザでは保存できない。遊びはできる",
      };
    }
    let rawText = null;
    try {
      rawText = ls.getItem(cfg().saveKey);
    } catch (err) {
      return { state: fresh, hadSave: false, locked: false, warning: "保存を読めなかった。新しくはじめる" };
    }
    if (!rawText) {
      return { state: fresh, hadSave: false, locked: false, warning: "" };
    }
    try {
      const raw = JSON.parse(rawText);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("shape");
      if (raw.version !== cfg().saveVersion) {
        if (typeof raw.version === "number" && raw.version > cfg().saveVersion) {
          saveLocked = true;
          lockMessage = "セーブがこのゲームより新しい。消すと、はじめから遊べる";
          return { state: fresh, hadSave: true, locked: true, warning: lockMessage };
        }
        throw new Error("version");
      }
      return { state: normalize(raw), hadSave: true, locked: false, warning: "" };
    } catch (err) {
      try {
        ls.setItem(cfg().saveKey + ":quarantine", rawText);
        ls.removeItem(cfg().saveKey);
      } catch (ignore) {
        /* 隔離できなくても、ゲーム自体は起動する */
      }
      return {
        state: fresh,
        hadSave: false,
        locked: false,
        warning: "セーブを読めなかったので、新しくはじめる",
      };
    }
  }

  function save(state) {
    if (saveLocked) return { ok: false, reason: "locked", message: lockMessage };
    const ls = store();
    if (!ls) return { ok: false, reason: "unavailable", message: "保存できない" };
    try {
      const copy = normalize(state);
      copy.savedAt = Date.now();
      ls.setItem(cfg().saveKey, JSON.stringify(copy));
      state.savedAt = copy.savedAt;
      return { ok: true, savedAt: copy.savedAt };
    } catch (err) {
      return { ok: false, reason: "failed", message: "保存できなかった" };
    }
  }

  function reset() {
    saveLocked = false;
    lockMessage = "";
    const ls = store();
    if (!ls) return;
    try {
      ls.removeItem(cfg().saveKey);
      ls.removeItem(cfg().saveKey + ":quarantine");
    } catch (err) {
      /* 消せなくても、次の読み込みでまた扱う */
    }
  }

  root.Save = {
    load: load,
    save: save,
    reset: reset,
    defaultState: defaultState,
  };
})(globalThis);
