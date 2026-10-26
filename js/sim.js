/* 拾う・しまう・うる・たてる・生産。時刻は見ない。渡されたミリ秒だけ進む。 */
(function (root) {
  "use strict";

  function cfg() {
    return root.GAME_CONFIG;
  }

  function bagCount(bag) {
    let total = 0;
    const order = cfg().resourceOrder;
    for (let i = 0; i < order.length; i += 1) {
      total += bag[order[i]] || 0;
    }
    return total;
  }

  function carryCap(state) {
    return state.backpack ? cfg().backpackCarry : cfg().baseCarry;
  }

  function storageCap(state) {
    return cfg().baseStorage + (state.buildings.box ? cfg().boxStorageBonus : 0);
  }

  function haveTotal(state, id) {
    return (state.storage[id] || 0) + (state.carry[id] || 0);
  }

  function clampStep(dtMs) {
    if (!Number.isFinite(dtMs) || dtMs <= 0) return 0;
    return Math.min(dtMs, cfg().maxFrameMs);
  }

  function collect(state, nodeId, manual) {
    const node = cfg().nodeMap[nodeId];
    const record = state.nodes[nodeId];
    if (!node || !record) return { ok: false, reason: "missing" };
    if (record.depleted) return { ok: false, reason: "empty" };
    const resource = cfg().resources[node.type];
    if (resource.special && !manual) return { ok: false, reason: "manual" };
    const amount = resource.gatherAmount;
    if (!(amount > 0)) return { ok: false, reason: "empty" };
    state.carry[node.type] += amount;
    record.depleted = true;
    record.respawnMs = resource.respawnMs;
    let discovered = false;
    if (node.type === "mushroom" && !state.discoveredMushroom) {
      state.discoveredMushroom = true;
      discovered = true;
    }
    return { ok: true, type: node.type, amount: amount, discovered: discovered };
  }

  function deposit(state) {
    let moved = 0;
    const order = cfg().resourceOrder;
    for (let i = 0; i < order.length; i += 1) {
      const id = order[i];
      const n = state.carry[id] || 0;
      if (n <= 0) continue;
      state.storage[id] = (state.storage[id] || 0) + n;
      state.carry[id] = 0;
      moved += n;
    }
    return { ok: moved > 0, moved: moved, blocked: false, reason: "" };
  }

  function sell(state, id, all) {
    const resource = cfg().resources[id];
    if (!resource) return { ok: false, reason: "missing" };
    const total = haveTotal(state, id);
    const count = all ? total : Math.min(1, total);
    if (count <= 0) return { ok: false, reason: "empty" };
    let left = count;
    const fromStore = Math.min(state.storage[id] || 0, left);
    state.storage[id] -= fromStore;
    left -= fromStore;
    state.carry[id] -= left;
    const gained = count * resource.sellPrice;
    state.coins += gained;
    return { ok: true, id: id, n: count, gained: gained };
  }

  function spend(state, id, amount) {
    let left = amount;
    const fromStore = Math.min(state.storage[id] || 0, left);
    state.storage[id] -= fromStore;
    left -= fromStore;
    if ((state.carry[id] || 0) < left) return false;
    state.carry[id] -= left;
    return true;
  }

  function canBuild(state, id) {
    const def = cfg().buildings[id];
    if (!def) return { ok: false, reason: "missing" };
    if (state.buildings[id]) return { ok: false, reason: "built" };
    if (def.requiresDiscovery && !state.discoveredMushroom) {
      return { ok: false, reason: "locked" };
    }
    if (state.coins < def.coins) return { ok: false, reason: "no-coins" };
    const ids = Object.keys(def.cost);
    for (let i = 0; i < ids.length; i += 1) {
      const rid = ids[i];
      if (haveTotal(state, rid) < def.cost[rid]) return { ok: false, reason: "no-materials" };
    }
    return { ok: true };
  }

  function build(state, id) {
    const check = canBuild(state, id);
    if (!check.ok) return check;
    const def = cfg().buildings[id];
    const ids = Object.keys(def.cost);
    for (let i = 0; i < ids.length; i += 1) {
      if (!spend(state, ids[i], def.cost[ids[i]])) {
        return { ok: false, reason: "no-materials" };
      }
    }
    state.coins -= def.coins;
    state.buildings[id] = true;
    return { ok: true, id: id };
  }

  function canBuyBackpack(state) {
    if (state.backpack) return { ok: false, reason: "owned" };
    if (state.coins < cfg().backpackCost) return { ok: false, reason: "no-coins" };
    return { ok: true };
  }

  function buyBackpack(state) {
    const check = canBuyBackpack(state);
    if (!check.ok) return check;
    state.coins -= cfg().backpackCost;
    state.backpack = true;
    return { ok: true };
  }

  function canHire(state) {
    if (state.helperHired) return { ok: false, reason: "owned" };
    if (state.coins < cfg().helper.hireCost) return { ok: false, reason: "no-coins" };
    return { ok: true };
  }

  function hire(state) {
    const check = canHire(state);
    if (!check.ok) return check;
    state.coins -= cfg().helper.hireCost;
    state.helperHired = true;
    return { ok: true };
  }

  function runCycle(state, step, spec) {
    const interval = spec.intervalMs;
    if (!(interval > 0)) return { status: "off", produced: 0 };
    state.progress[spec.progressKey] += step;
    let produced = 0;
    let guard = 0;
    while (state.progress[spec.progressKey] >= interval && guard < 8) {
      guard += 1;
      const blocked = spec.blocked();
      if (blocked) {
        state.progress[spec.progressKey] = Math.min(state.progress[spec.progressKey], interval);
        return { status: blocked, produced: produced };
      }
      spec.apply();
      state.progress[spec.progressKey] -= interval;
      produced += spec.outputAmount;
    }
    return { status: "run", produced: produced };
  }

  function tickHelper(state, step) {
    const helper = cfg().helper;
    if (!state.helperHired) return { status: "off", produced: 0 };
    return runCycle(state, step, {
      intervalMs: helper.intervalMs,
      progressKey: "helperMs",
      outputAmount: helper.amount,
      blocked: function () {
        return "";
      },
      apply: function () {
        state.storage[helper.resource] += helper.amount;
      },
    });
  }

  function tickWorkbench(state, step) {
    const work = cfg().workbench;
    if (!state.buildings.workbench) return { status: "off", produced: 0 };
    if ((state.storage[work.input] || 0) < work.inputAmount) {
      return { status: "no-input", produced: 0 };
    }
    return runCycle(state, step, {
      intervalMs: work.intervalMs,
      progressKey: "workbenchMs",
      outputAmount: work.outputAmount,
      blocked: function () {
        if ((state.storage[work.input] || 0) < work.inputAmount) return "no-input";
        return "";
      },
      apply: function () {
        state.storage[work.input] -= work.inputAmount;
        state.storage[work.output] += work.outputAmount;
      },
    });
  }

  function emptyGoods() {
    const goods = {};
    const order = cfg().productOrder;
    for (let i = 0; i < order.length; i += 1) goods[order[i]] = 0;
    return goods;
  }

  function emptyDisplay() {
    const slots = [];
    const count = cfg().shop.displaySlots;
    for (let i = 0; i < count; i += 1) slots.push("");
    return slots;
  }

  function canCraft(state, productId) {
    const def = cfg().products[productId];
    if (!def) return { ok: false, reason: "missing" };
    if (!state.buildings.workbench) return { ok: false, reason: "need-bench" };
    const ids = Object.keys(def.cost);
    for (let i = 0; i < ids.length; i += 1) {
      if (haveTotal(state, ids[i]) < def.cost[ids[i]]) return { ok: false, reason: "no-materials" };
    }
    return { ok: true };
  }

  function craft(state, productId) {
    const check = canCraft(state, productId);
    if (!check.ok) return check;
    const def = cfg().products[productId];
    const ids = Object.keys(def.cost);
    for (let i = 0; i < ids.length; i += 1) {
      if (!spend(state, ids[i], def.cost[ids[i]])) return { ok: false, reason: "no-materials" };
    }
    if (!state.goods) state.goods = emptyGoods();
    state.goods[productId] = (state.goods[productId] || 0) + 1;
    return { ok: true, id: productId };
  }

  function displayProduct(state, productId) {
    const def = cfg().products[productId];
    if (!def) return { ok: false, reason: "missing" };
    if (!state.goods || !(state.goods[productId] > 0)) return { ok: false, reason: "empty" };
    if (!state.display) state.display = emptyDisplay();
    let index = -1;
    for (let i = 0; i < state.display.length; i += 1) {
      if (!state.display[i]) {
        index = i;
        break;
      }
    }
    if (index < 0) return { ok: false, reason: "display-full" };
    state.goods[productId] -= 1;
    state.display[index] = productId;
    return { ok: true, id: productId, index: index };
  }

  function hasDisplay(state) {
    const slots = state.display || [];
    for (let i = 0; i < slots.length; i += 1) {
      if (slots[i]) return true;
    }
    return false;
  }

  function customerDue(state, dtMs) {
    const step = clampStep(dtMs);
    if (!state.progress) state.progress = {};
    if (!hasDisplay(state)) {
      state.progress.customerMs = 0;
      return false;
    }
    if (step <= 0) return false;
    state.progress.customerMs = (state.progress.customerMs || 0) + step;
    if (state.progress.customerMs < cfg().shop.customerMs) return false;
    state.progress.customerMs -= cfg().shop.customerMs;
    return true;
  }

  function buyDisplayed(state) {
    if (!state.display) state.display = emptyDisplay();
    for (let i = 0; i < state.display.length; i += 1) {
      const id = state.display[i];
      const def = id && cfg().products[id];
      if (!def) continue;
      state.display[i] = "";
      state.coins += def.price;
      return { ok: true, id: id, gained: def.price, index: i };
    }
    return { ok: false, reason: "empty" };
  }

  function tickProduction(state, dtMs) {
    const step = clampStep(dtMs);
    const helper = tickHelper(state, step);
    const workbench = tickWorkbench(state, step);
    return {
      helper: helper.status,
      workbench: workbench.status,
      gathered: helper.produced,
      crafted: workbench.produced,
    };
  }

  function tickRespawn(state, dtMs) {
    const step = clampStep(dtMs);
    if (step <= 0) return;
    const nodes = cfg().nodes;
    for (let i = 0; i < nodes.length; i += 1) {
      const record = state.nodes[nodes[i].id];
      if (!record || !record.depleted) continue;
      record.respawnMs -= step;
      if (record.respawnMs <= 0) {
        record.depleted = false;
        record.respawnMs = 0;
      }
    }
  }

  root.Sim = {
    bagCount: bagCount,
    carryCap: carryCap,
    storageCap: storageCap,
    haveTotal: haveTotal,
    collect: collect,
    deposit: deposit,
    sell: sell,
    canBuild: canBuild,
    build: build,
    canBuyBackpack: canBuyBackpack,
    buyBackpack: buyBackpack,
    canHire: canHire,
    hire: hire,
    tickProduction: tickProduction,
    tickRespawn: tickRespawn,
    canCraft: canCraft,
    craft: craft,
    displayProduct: displayProduct,
    customerDue: customerDue,
    buyDisplayed: buyDisplayed,
    emptyGoods: emptyGoods,
    emptyDisplay: emptyDisplay,
  };
})(globalThis);
