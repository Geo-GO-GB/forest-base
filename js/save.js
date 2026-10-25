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
      buildings: { box: false, workbench: false, desk: false },
      helperHired: false,
      discoveredMushroom: false,
      nodes: defaultNodes(),
      progress: { helperMs: 0, workbenchMs: 0 },
      tutorialStep: 0,
      savedAt: 0,
    };
  }

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
    state.coins = clampInt(raw.coins, 0, 999999);
    const order = cfg().resourceOrder;
    for (let i = 0; i < order.length; i += 1) {
      const id = order[i];
      state.carry[id] = clampInt(raw.carry && raw.carry[id], 0, 9999);
      state.storage[id] = clampInt(raw.storage && raw.storage[id], 0, 9999);
    }
    state.backpack = raw.backpack === true;
    state.buildings.box = !!(raw.buildings && raw.buildings.box);
    state.buildings.workbench = !!(raw.buildings && raw.buildings.workbench);
    state.buildings.desk = !!(raw.buildings && raw.buildings.desk);
    state.helperHired = raw.helperHired === true;
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
        warning: "このブラウザではほぞんできない。遊びはできる",
      };
    }
    let rawText = null;
    try {
      rawText = ls.getItem(cfg().saveKey);
    } catch (err) {
      return { state: fresh, hadSave: false, locked: false, warning: "ほぞんをよめなかった。あたらしくはじめる" };
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
          lockMessage = "セーブがこのゲームよりあたらしい。けすと、はじめから遊べる";
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
        warning: "セーブをよめなかったので、あたらしくはじめる",
      };
    }
  }

  function save(state) {
    if (saveLocked) return { ok: false, reason: "locked", message: lockMessage };
    const ls = store();
    if (!ls) return { ok: false, reason: "unavailable", message: "ほぞんできない" };
    try {
      const copy = normalize(state);
      copy.savedAt = Date.now();
      ls.setItem(cfg().saveKey, JSON.stringify(copy));
      state.savedAt = copy.savedAt;
      return { ok: true, savedAt: copy.savedAt };
    } catch (err) {
      return { ok: false, reason: "failed", message: "ほぞんできなかった" };
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
