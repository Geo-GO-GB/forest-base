/* 画面の文字とボタン。キャンバスの上に重ねる。 */
(function (root) {
  "use strict";

  const CFG = function () {
    return root.GAME_CONFIG;
  };

  let actions = {};
  let current = "";
  let lastState = null;
  let lastExtra = null;

  function $(id) {
    return document.getElementById(id);
  }

  function blocksGame() {
    return document.body.classList.contains("panel-open");
  }

  function formatTime(ts) {
    if (!ts) return "なし";
    const date = new Date(ts);
    const pad = function (n) {
      return String(n).padStart(2, "0");
    };
    return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
  }

  function sec(ms) {
    const value = ms / 1000;
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function fmt(n) {
    return root.Format ? root.Format.count(n) : String(n);
  }

  function costLine(def) {
    const parts = [];
    if (def.coins) parts.push("コイン " + fmt(def.coins));
    const ids = Object.keys(def.cost);
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      parts.push(
        CFG().resources[id].name +
          " " +
          def.cost[id] +
          "（いま <span data-have='" +
          id +
          "'>0</span>）"
      );
    }
    return parts.join("、");
  }

  function resourceRows(mode) {
    const order = CFG().resourceOrder;
    let html = "";
    for (let i = 0; i < order.length; i += 1) {
      const id = order[i];
      const resource = CFG().resources[id];
      html += '<div class="row">';
      html += '<span class="icon">';
      html += '<img alt="" src="assets/' + id + '.png" />';
      html += '<span class="swatch" style="background:' + CFG().hex(resource.color) + '"></span>';
      html += "</span>";
      html += '<span class="name">' + resource.name + "</span>";
      if (mode === "items") {
        html += "<span>所持 <b data-count='carry." + id + "'>0</b></span>";
        html += "<span>保管 <b data-count='storage." + id + "'>0</b></span>";
        html += '<span class="note">' + resource.blurb + "</span>";
      } else {
        html += "<span>保管 <b data-count='storage." + id + "'>0</b> / 所持 <b data-count='carry." + id + "'>0</b></span>";
        html += "<span class='note'>" + fmt(resource.sellPrice) + "コイン</span>";
        html += '<button type="button" data-sell="' + id + '">1つ</button>';
        html += '<button type="button" data-sell-all="' + id + '">全部</button>';
      }
      html += "</div>";
    }
    return html;
  }

  function renderItems() {
    return (
      '<p class="summary" data-summary></p>' +
      '<p class="hint">近づくと拾えるものと、ボタンで拾うものがある。</p>' +
      resourceRows("items")
    );
  }

  function renderShop() {
    const cfg = CFG();
    return (
      '<p class="summary" data-summary></p>' +
      '<p class="hint" data-base-hint></p>' +
      resourceRows("shop") +
      '<section class="offer">' +
      "<h3>" +
      cfg.backpackName +
      "</h3>" +
      "<p>背負うと、背中にリュックがつく。</p>" +
      "<p>コイン " +
      fmt(cfg.backpackCost) +
      "</p>" +
      '<button type="button" data-buy="backpack">買う</button>' +
      '<p class="note" data-buy-note></p>' +
      "</section>"
    );
  }

  function renderBuild() {
    const cfg = CFG();
    let html = '<p class="summary" data-summary></p><p class="hint" data-base-hint></p>';
    html += "<p class='hint'>場所は秘密基地のなかに決まっている。</p>";
    for (let i = 0; i < cfg.buildingOrder.length; i += 1) {
      const id = cfg.buildingOrder[i];
      const def = cfg.buildings[id];
      const effect = def.effect;
      html += '<section class="offer">';
      html += "<h3>" + def.name + "</h3>";
      html += "<p>" + effect + "</p>";
      html += "<p>" + costLine(def) + "</p>";
      html += '<button type="button" data-build="' + id + '">建てる</button>';
      html += '<p class="note" data-build-note="' + id + '"></p>';
      html += "</section>";
    }
    return html;
  }

  function renderCrewBlock(id) {
    const spec = CFG().crew[id];
    const blurb = {
      gather: spec.resource === "twig"
        ? "枝のある場所まで歩いて拾い、何本か持って秘密基地に届ける。"
        : spec.resource === "pebble"
          ? "小石のある場所まで歩いて拾い、秘密基地に届ける。"
          : "木の実のある場所まで歩いて拾い、秘密基地に届ける。",
      craft: "作業台まで歩いて品を作り、在庫に入れる。",
      clerk: "在庫の品を持ってお店の台まで歩き、空いた場所に飾る。",
    };
    let html = '<section class="offer">';
    html += "<h3>" + spec.name + "</h3>";
    html += "<p>" + (blurb[spec.kind] || "") + "</p>";
    html += "<p>コイン " + fmt(spec.hireCost) + "</p>";
    html += '<button type="button" data-hire-role="' + id + '">雇う</button>';
    html += '<p class="note" data-hire-note="' + id + '"></p>';
    html += '<p data-crew-line="' + id + '"></p>';
    const tracks = ["speed", "carry", "haste", "n"];
    for (let i = 0; i < tracks.length; i += 1) {
      const track = tracks[i];
      const row = spec.upgrades[track];
      html += '<p class="note" data-upgrade-line="' + id + ":" + track + '">' + row.name + "</p>";
      html += '<button type="button" data-upgrade="' + id + ":" + track + '">' + row.name + "</button>";
    }
    html += "</section>";
    return html;
  }

  function renderHelpers() {
    const cfg = CFG();
    const inputName = cfg.resources[cfg.workbench.input].name;
    const outputName = cfg.resources[cfg.workbench.output].name;
    let html =
      '<p class="summary" data-summary></p>' +
      '<p class="hint" data-base-hint></p>' +
      "<p>仲間が材料を届け、作業台が品を作り、店番が台に飾る。</p>" +
      "<p class='hint'>開いているあいだだけ歩く。閉じている間は増えない。</p>";
    for (let i = 0; i < cfg.crewOrder.length; i += 1) html += renderCrewBlock(cfg.crewOrder[i]);
    html +=
      '<section class="offer">' +
      "<h3>作業台</h3>" +
      "<p>" +
      sec(cfg.workbench.intervalMs) +
      "秒ごとに" +
      inputName +
      " " +
      cfg.workbench.inputAmount +
      " → " +
      outputName +
      " " +
      cfg.workbench.outputAmount +
      "</p>" +
      '<p data-status="workbench"></p>' +
      '<p class="note" data-remedy="workbench"></p>' +
      '<div class="bar" data-bar-wrap="workbench"><div data-bar="workbench"></div></div>' +
      "</section>" +
      renderCraft();
    return html;
  }

  function productCost(def) {
    const ids = Object.keys(def.cost);
    const parts = [];
    for (let i = 0; i < ids.length; i += 1) {
      parts.push(CFG().resources[ids[i]].name + " " + fmt(def.cost[ids[i]]));
    }
    return parts.join("、");
  }

  function renderCraft() {
    const cfg = CFG();
    let html = '<section class="offer">';
    html += "<h3>品物を作る</h3>";
    html += "<p>作業台で材料を使い、お店の台に飾る。お客さんが買うとコインになる。</p>";
    for (let i = 0; i < cfg.productOrder.length; i += 1) {
      const id = cfg.productOrder[i];
      const def = cfg.products[id];
      html += '<div class="row">';
      html += '<span class="name">' + def.name + "</span>";
      html += "<span>" + productCost(def) + "</span>";
      html += "<span>売り " + fmt(def.price) + "</span>";
      html += "<span>在庫 <b data-goods='" + id + "'>0</b></span>";
      html += '<button type="button" data-craft="' + id + '">作る</button>';
      html += '<button type="button" data-show="' + id + '">飾る</button>';
      html += "</div>";
    }
    html += '<p data-display-line>飾り: なし</p>';
    html += '<p class="note" data-craft-note></p>';
    html += "</section>";
    return html;
  }

  function renderSettings(loaded) {
    return (
      "<p>このゲームは、開いているあいだだけ進む。閉じている間は増えない。</p>" +
      "<p>拾ったとき、売ったとき、建てたとき、雇ったとき、数秒ごと、ページを閉じるときに保存する。</p>" +
      "<p>データの形: " +
      CFG().saveVersion +
      "</p>" +
      '<p id="settings-saved"></p>' +
      (loaded && loaded.warning ? "<p class='warn'>" + loaded.warning + "</p>" : "") +
      '<button type="button" data-save>今保存する</button>' +
      '<button type="button" class="danger" data-reset>データを消す</button>' +
      '<div id="confirm" hidden>' +
      "<p>本当に消す？もとに戻せない。</p>" +
      '<button type="button" class="danger" data-confirm-reset>消す</button>' +
      '<button type="button" data-cancel-reset>やめる</button>' +
      "</div>"
    );
  }

  const panels = {
    items: { title: "持ち物", render: renderItems },
    shop: { title: "売る", render: renderShop },
    build: { title: "建てる", render: renderBuild },
    helpers: { title: "仲間", render: renderHelpers },
    settings: { title: "設定", render: renderSettings },
  };

  function toast(message) {
    const host = $("toasts");
    if (!host) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    host.appendChild(el);
    while (host.children.length > 3) host.removeChild(host.firstChild);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () {
        el.remove();
      }, 280);
    }, 2600);
  }

  function statusName(code, inputName) {
    if (code === "run") return "働いている";
    if (code === "full") return "保管がいっぱい";
    if (code === "no-input") return inputName + "が足りない";
    if (code === "off") return "まだ動いていない";
    return "";
  }

  function remedy(code) {
    if (code === "full") return "売って減らすとまた動く";
    if (code === "no-input") return "枝を拾うか、枝拾いおじさんを雇うと進む";
    if (code === "run") return "開いているあいだだけ進む";
    return "";
  }

  function setDisabled(button, disabled, label) {
    if (!button) return;
    button.disabled = disabled;
    if (label) button.textContent = label;
  }

  function sync(state, extra) {
    if (!state) return;
    lastState = state;
    lastExtra = extra || lastExtra || { inBase: false, statuses: { helper: "off", workbench: "off" }, nearMushroom: false };
    const pocketCoins = $("pocket-coins");
    if (pocketCoins) pocketCoins.textContent = fmt(state.coins);
    const hold = (lastExtra && lastExtra.hudHold) || {};
    CFG().resourceOrder.forEach(function (id) {
      const el = document.querySelector("[data-pocket='" + id + "']");
      if (!el) return;
      // 左上は保管の数。運んでいるあいだは足さず、飛んできたときに増える。
      const shown = Math.max(0, (state.storage[id] || 0) - (hold[id] || 0));
      const prev = Number(el.dataset.shown || "0");
      el.dataset.shown = String(shown);
      el.textContent = fmt(shown);
      if (shown > prev) {
        el.classList.remove("tick");
        void el.offsetWidth;
        el.classList.add("tick");
      }
    });
    $("save-label").textContent = state.savedAt ? "保存 " + formatTime(state.savedAt) : "未保存";
    const statuses = lastExtra.statuses || { helper: "off", workbench: "off" };
    const inputName = CFG().resources[CFG().workbench.input].name;
    const bits = [];
    root.Sim.ensureCrew(state);
    const hiredNames = [];
    CFG().crewOrder.forEach(function (id) {
      if (state.crew[id].hired) hiredNames.push(CFG().crew[id].name);
    });
    if (hiredNames.length) bits.push(hiredNames[0] + (hiredNames.length > 1 ? "、ほか" : ""));
    if (state.buildings.workbench) bits.push("作業台: " + statusName(statuses.workbench, inputName));
    const pill = $("status-pill");
    pill.textContent = bits.length ? bits.join(" / ") : "歩いて、枝や小石を集めよう";
    const action = $("action-btn");
    action.hidden = !lastExtra.nearMushroom;
    action.textContent = "光るキノコを拾う";
    const hud = $("hud");
    if (hud) document.documentElement.style.setProperty("--hud-h", hud.offsetHeight + "px");
    if (current) updatePanel(state, lastExtra);
  }

  function updatePanel(state, extra) {
    const body = $("panel-body");
    if (!body) return;
    const summary = body.querySelector("[data-summary]");
    if (summary) {
      summary.textContent =
        "コイン " +
        fmt(state.coins) +
        "　所持 " +
        fmt(root.Sim.bagCount(state.carry)) +
        "　保管 " +
        fmt(root.Sim.bagCount(state.storage));
    }
    body.querySelectorAll("[data-count]").forEach(function (el) {
      const parts = el.dataset.count.split(".");
      el.textContent = fmt((state[parts[0]] && state[parts[0]][parts[1]]) || 0);
    });
    body.querySelectorAll("[data-have]").forEach(function (el) {
      el.textContent = fmt(root.Sim.haveTotal(state, el.dataset.have));
    });
    body.querySelectorAll("[data-goods]").forEach(function (el) {
      el.textContent = fmt((state.goods && state.goods[el.dataset.goods]) || 0);
    });
    const displayLine = body.querySelector("[data-display-line]");
    if (displayLine) {
      const names = [];
      const shown = state.display || [];
      for (let i = 0; i < shown.length; i += 1) {
        const def = shown[i] && CFG().products[shown[i]];
        if (def) names.push(def.name);
      }
      displayLine.textContent = names.length ? "飾り: " + names.join("、") : "飾り: なし";
    }
    body.querySelectorAll("[data-craft]").forEach(function (button) {
      const check = root.Sim.canCraft(state, button.dataset.craft);
      setDisabled(button, !extra.inBase || !check.ok);
    });
    body.querySelectorAll("[data-show]").forEach(function (button) {
      const id = button.dataset.show;
      const stock = (state.goods && state.goods[id]) || 0;
      const open = (state.display || []).some(function (slot) {
        return !slot;
      });
      setDisabled(button, !extra.inBase || stock <= 0 || !open);
    });
    const craftNote = body.querySelector("[data-craft-note]");
    if (craftNote) {
      if (!state.buildings.workbench) craftNote.textContent = "作業台を建てると作れる";
      else if (!extra.inBase) craftNote.textContent = "秘密基地に戻ると作れる・飾れる";
      else craftNote.textContent = "飾ると、お客さんが歩いてきて買う";
    }
    const hint = body.querySelector("[data-base-hint]");
    if (hint) {
      hint.textContent = extra.inBase
        ? "秘密基地の上でできる"
        : "秘密基地に戻ると、売れる・建てられる・雇える";
    }
    body.querySelectorAll("[data-sell]").forEach(function (button) {
      const id = button.dataset.sell;
      setDisabled(button, !extra.inBase || root.Sim.haveTotal(state, id) <= 0);
    });
    body.querySelectorAll("[data-sell-all]").forEach(function (button) {
      const id = button.dataset.sellAll;
      setDisabled(button, !extra.inBase || root.Sim.haveTotal(state, id) <= 0);
    });
    const buy = body.querySelector("[data-buy]");
    if (buy) {
      if (state.backpack) setDisabled(buy, true, "買った");
      else setDisabled(buy, !extra.inBase || !root.Sim.canBuyBackpack(state).ok, "買う");
    }
    const buyNote = body.querySelector("[data-buy-note]");
    if (buyNote) {
      if (state.backpack) buyNote.textContent = "持っている";
      else if (!extra.inBase) buyNote.textContent = "秘密基地に戻ると買える";
      else if (!root.Sim.canBuyBackpack(state).ok) buyNote.textContent = "コインが足りない";
      else buyNote.textContent = "買える";
    }
    CFG().buildingOrder.forEach(function (id) {
      const button = body.querySelector('[data-build="' + id + '"]');
      const note = body.querySelector('[data-build-note="' + id + '"]');
      if (!button) return;
      const check = root.Sim.canBuild(state, id);
      if (state.buildings[id]) setDisabled(button, true, "建てた");
      else if (check.reason === "locked") setDisabled(button, true, "未発見");
      else setDisabled(button, !extra.inBase || !check.ok, "建てる");
      if (!note) return;
      if (state.buildings[id]) note.textContent = "建てた";
      else if (check.reason === "locked") note.textContent = "光る林で光るキノコを拾うと開く";
      else if (!extra.inBase) note.textContent = "秘密基地に戻ると建てられる";
      else if (check.reason === "no-coins") note.textContent = "コインが足りない";
      else if (check.reason === "no-materials") note.textContent = "材料が足りない";
      else note.textContent = "建てられる";
    });
    root.Sim.ensureCrew(state);
    const jobs = (extra && extra.jobs) || {};
    CFG().crewOrder.forEach(function (id) {
      const spec = CFG().crew[id];
      const rec = state.crew[id];
      const stats = root.Sim.crewStats(state, id);
      const hire = body.querySelector('[data-hire-role="' + id + '"]');
      const note = body.querySelector('[data-hire-note="' + id + '"]');
      const check = root.Sim.canHireRole(state, id);
      if (hire) {
        if (rec.hired) setDisabled(hire, true, "来た");
        else setDisabled(hire, !extra.inBase || !check.ok, "雇う");
      }
      if (note) {
        if (rec.hired) note.textContent = "人数 " + fmt(stats.n);
        else if (!extra.inBase) note.textContent = "秘密基地に戻ると雇える";
        else if (check.reason === "need-bench") note.textContent = "作業台を建てると雇える";
        else if (check.reason === "no-coins") note.textContent = "コインが足りない";
        else note.textContent = "雇える";
      }
      const line = body.querySelector('[data-crew-line="' + id + '"]');
      if (line) line.textContent = rec.hired ? jobs[id] || "基地で待っている" : "";
      ["speed", "carry", "haste", "n"].forEach(function (track) {
        const button = body.querySelector('[data-upgrade="' + id + ":" + track + '"]');
        const label = body.querySelector('[data-upgrade-line="' + id + ":" + track + '"]');
        const row = spec.upgrades[track];
        const level = rec[track] || 0;
        const max = row.costs.length;
        const cost = root.Sim.upgradeCost(state, id, track);
        if (label) {
          label.textContent = row.name + " " + fmt(level + 1) + "/" + fmt(max + 1);
        }
        if (!button) return;
        if (!rec.hired || !(cost > 0)) setDisabled(button, true, rec.hired ? "上限" : row.name);
        else setDisabled(button, !extra.inBase || state.coins < cost, row.name + " " + fmt(cost));
      });
    });
    const inputName = CFG().resources[CFG().workbench.input].name;
    ["workbench"].forEach(function (key) {
      const statusEl = body.querySelector('[data-status="' + key + '"]');
      const remedyEl = body.querySelector('[data-remedy="' + key + '"]');
      const active = state.buildings.workbench;
      const code = active ? extra.statuses[key] : "off";
      if (statusEl) statusEl.textContent = active ? statusName(code, inputName) : "まだない";
      if (remedyEl) remedyEl.textContent = active ? remedy(code) : "";
      const bar = body.querySelector('[data-bar="' + key + '"]');
      const wrap = body.querySelector('[data-bar-wrap="' + key + '"]');
      if (wrap) wrap.hidden = !active;
      if (bar && active) {
        const interval = CFG().workbench.intervalMs;
        const value = state.progress.workbenchMs;
        bar.style.width = Math.max(0, Math.min(1, value / interval)) * 100 + "%";
      }
    });
    const saved = $("settings-saved");
    if (saved) saved.textContent = "最後に保存: " + formatTime(state.savedAt);
  }

  function openPanel(name) {
    const panel = panels[name];
    if (!panel || !lastState) return;
    current = name;
    document.body.classList.add("panel-open");
    $("scrim").hidden = false;
    $("panel-title").textContent = panel.title;
    $("panel-body").innerHTML = panel.render(actions.loaded);
    $("panel-body").querySelectorAll(".icon img").forEach(function (img) {
      img.addEventListener("error", function () {
        img.classList.add("missing");
      });
    });
    $("panel-body").scrollTop = 0;
    updatePanel(lastState, lastExtra);
    $("panel-close").focus();
  }

  function closePanel() {
    current = "";
    document.body.classList.remove("panel-open");
    const scrim = $("scrim");
    if (scrim) scrim.hidden = true;
  }

  function showFatal(message) {
    const note = $("title-note");
    if (note) note.textContent = message;
  }

  function buildPocket() {
    const pocket = $("pocket");
    if (!pocket || pocket.childElementCount) return;
    let html = '<p class="pocket-row"><img class="coin-icon" alt="" src="assets/coin.png" /><b id="pocket-coins">0</b><span class="sr">コイン</span></p>';
    CFG().resourceOrder.forEach(function (id) {
      const resource = CFG().resources[id];
      html += '<p class="pocket-row">';
      html += '<img alt="" src="assets/' + id + '.png" />';
      html += '<b data-pocket="' + id + '">0</b>';
      html += '<span class="sr">' + resource.name + "</span>";
      html += "</p>";
    });
    pocket.innerHTML = html;
    const coin = pocket.querySelector("img.coin-icon");
    if (coin) {
      coin.addEventListener("error", function () {
        const fallback = document.createElement("span");
        fallback.className = "coin-icon";
        fallback.setAttribute("aria-hidden", "true");
        coin.replaceWith(fallback);
      });
    }
  }

  function init(nextActions) {
    actions = nextActions;
    buildPocket();
    const loaded = nextActions.loaded;
    const start = $("start-btn");
    if (loaded.locked) start.textContent = "見てみる";
    else if (loaded.hadSave) start.textContent = "続きから";
    else start.textContent = "始める";
    if (loaded.warning) $("title-note").textContent = loaded.warning;
    start.addEventListener("click", function () {
      actions.onStart();
    });
    document.querySelectorAll("[data-panel]").forEach(function (button) {
      button.addEventListener("click", function () {
        openPanel(button.dataset.panel);
      });
    });
    $("panel-close").addEventListener("click", closePanel);
    $("scrim").addEventListener("click", function (event) {
      if (event.target === $("scrim")) closePanel();
    });
    $("action-btn").addEventListener("click", function () {
      actions.onAction();
    });
    $("panel-body").addEventListener("click", function (event) {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      if (button.dataset.sell) actions.onSell(button.dataset.sell, false);
      else if (button.dataset.sellAll) actions.onSell(button.dataset.sellAll, true);
      else if (button.dataset.build) actions.onBuild(button.dataset.build);
      else if (button.dataset.craft) actions.onCraft(button.dataset.craft);
      else if (button.dataset.show) actions.onShow(button.dataset.show);
      else if (button.dataset.buy) actions.onBuy();
      else if (button.dataset.hireRole) actions.onHireRole(button.dataset.hireRole);
      else if (button.dataset.upgrade) {
        const parts = button.dataset.upgrade.split(":");
        actions.onUpgrade(parts[0], parts[1]);
      }
      else if (button.dataset.save != null) actions.onSave();
      else if (button.dataset.reset != null) $("confirm").hidden = false;
      else if (button.dataset.confirmReset != null) actions.onReset();
      else if (button.dataset.cancelReset != null) $("confirm").hidden = true;
    });
    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closePanel();
    });
    window.addEventListener("resize", function () {
      const hud = $("hud");
      if (hud) document.documentElement.style.setProperty("--hud-h", hud.offsetHeight + "px");
    });
  }

  root.UI = {
    init: init,
    sync: sync,
    toast: toast,
    blocksGame: blocksGame,
    closePanel: closePanel,
    showFatal: showFatal,
  };
})(globalThis);
