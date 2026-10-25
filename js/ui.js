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
    if (!ts) return "まだ";
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

  function costLine(def) {
    const parts = [];
    if (def.coins) parts.push("コイン " + def.coins);
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
      html += '<span class="swatch" style="background:' + CFG().hex(resource.color) + '"></span>';
      html += '<span class="name">' + resource.name + "</span>";
      if (mode === "items") {
        html += "<span>もち <b data-count='carry." + id + "'>0</b></span>";
        html += "<span>ほかん <b data-count='storage." + id + "'>0</b></span>";
        html += '<span class="note">' + resource.blurb + "</span>";
      } else {
        html += "<span>ほかん <b data-count='storage." + id + "'>0</b> / もち <b data-count='carry." + id + "'>0</b></span>";
        html += "<span class='note'>" + resource.sellPrice + "コイン</span>";
        html += '<button type="button" data-sell="' + id + '">ひとつ</button>';
        html += '<button type="button" data-sell-all="' + id + '">ぜんぶ</button>';
      }
      html += "</div>";
    }
    return html;
  }

  function renderItems() {
    return (
      '<p class="summary" data-summary></p>' +
      '<p class="hint">ちかづくとひろえるものと、ボタンでひろうものがある。</p>' +
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
      "<p>もちもの " +
      cfg.baseCarry +
      " → " +
      cfg.backpackCarry +
      "</p>" +
      "<p>コイン " +
      cfg.backpackCost +
      "</p>" +
      '<button type="button" data-buy="backpack">かう</button>' +
      '<p class="note" data-buy-note></p>' +
      "</section>"
    );
  }

  function renderBuild() {
    const cfg = CFG();
    let html = '<p class="summary" data-summary></p><p class="hint" data-base-hint></p>';
    html += "<p class='hint'>ばしょはひみつきちのなかにきまっている。</p>";
    for (let i = 0; i < cfg.buildingOrder.length; i += 1) {
      const id = cfg.buildingOrder[i];
      const def = cfg.buildings[id];
      let effect = def.effect;
      if (id === "box") {
        effect += "（ほかん " + cfg.baseStorage + " → " + (cfg.baseStorage + cfg.boxStorageBonus) + "）";
      }
      html += '<section class="offer">';
      html += "<h3>" + def.name + "</h3>";
      html += "<p>" + effect + "</p>";
      html += "<p>" + costLine(def) + "</p>";
      html += '<button type="button" data-build="' + id + '">たてる</button>';
      html += '<p class="note" data-build-note="' + id + '"></p>';
      html += "</section>";
    }
    return html;
  }

  function renderHelpers() {
    const cfg = CFG();
    const inputName = cfg.resources[cfg.workbench.input].name;
    const outputName = cfg.resources[cfg.workbench.output].name;
    const helperName = cfg.resources[cfg.helper.resource].name;
    return (
      '<p class="summary" data-summary></p>' +
      '<p class="hint" data-base-hint></p>' +
      "<p>きこりが" +
      helperName +
      "をあつめる → さぎょうだいが" +
      inputName +
      cfg.workbench.inputAmount +
      "を" +
      outputName +
      cfg.workbench.outputAmount +
      "にする → ほかんにしまう。</p>" +
      "<p class='hint'>ひらいているあいだだけすすむ。とじている間はふえない。</p>" +
      '<section class="offer">' +
      "<h3>" +
      cfg.helper.name +
      "</h3>" +
      "<p>" +
      sec(cfg.helper.intervalMs) +
      "秒ごとに" +
      helperName +
      "を" +
      cfg.helper.amount +
      "こ、ほかんへ。</p>" +
      "<p>コイン " +
      cfg.helper.hireCost +
      "</p>" +
      '<button type="button" data-hire>やとう</button>' +
      '<p class="note" data-hire-note></p>' +
      '<p data-status="helper"></p>' +
      '<p class="note" data-remedy="helper"></p>' +
      '<div class="bar" data-bar-wrap="helper"><div data-bar="helper"></div></div>' +
      "</section>" +
      '<section class="offer">' +
      "<h3>さぎょうだい</h3>" +
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
      "</section>"
    );
  }

  function renderSettings(loaded) {
    return (
      "<p>このゲームは、ひらいているあいだだけすすむ。とじている間はふえない。</p>" +
      "<p>ひろったとき、うったとき、たてたとき、やとったとき、数秒ごと、ページをとじるときにほぞんする。</p>" +
      "<p>データのかたち: " +
      CFG().saveVersion +
      "</p>" +
      '<p id="settings-saved"></p>' +
      (loaded && loaded.warning ? "<p class='warn'>" + loaded.warning + "</p>" : "") +
      '<button type="button" data-save>いまほぞんする</button>' +
      '<button type="button" class="danger" data-reset>データをけす</button>' +
      '<div id="confirm" hidden>' +
      "<p>ほんとうにけす？もとに戻せない。</p>" +
      '<button type="button" class="danger" data-confirm-reset>けす</button>' +
      '<button type="button" data-cancel-reset>やめる</button>' +
      "</div>"
    );
  }

  const panels = {
    items: { title: "もちもの", render: renderItems },
    shop: { title: "うる", render: renderShop },
    build: { title: "たてる", render: renderBuild },
    helpers: { title: "なかま", render: renderHelpers },
    settings: { title: "せってい", render: renderSettings },
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
    if (code === "run") return "はたらいている";
    if (code === "full") return "ほかんがいっぱい";
    if (code === "no-input") return inputName + "がたりない";
    if (code === "off") return "まだうごいていない";
    return "";
  }

  function remedy(code) {
    if (code === "full") return "うってへらすか、きばこをたてるとまたうごく";
    if (code === "no-input") return "えだをひろうか、きこりをやとうとすすむ";
    if (code === "run") return "ひらいているあいだだけすすむ";
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
    const carry = root.Sim.bagCount(state.carry);
    const storage = root.Sim.bagCount(state.storage);
    $("coins").textContent = "コイン " + state.coins;
    $("carry-label").textContent = "もち " + carry + "/" + root.Sim.carryCap(state);
    $("storage-label").textContent = "ほかん " + storage + "/" + root.Sim.storageCap(state);
    $("save-label").textContent = "ほぞん " + formatTime(state.savedAt);
    const statuses = lastExtra.statuses || { helper: "off", workbench: "off" };
    const inputName = CFG().resources[CFG().workbench.input].name;
    const bits = [];
    if (state.helperHired) bits.push("きこり: " + statusName(statuses.helper, inputName));
    if (state.buildings.workbench) bits.push("さぎょうだい: " + statusName(statuses.workbench, inputName));
    const pill = $("status-pill");
    pill.textContent = bits.length ? bits.join(" / ") : "あるいて、えだやこいしをあつめよう";
    const action = $("action-btn");
    action.hidden = !lastExtra.nearMushroom;
    action.textContent = "ひかるきのこをひろう";
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
        state.coins +
        "　もち " +
        root.Sim.bagCount(state.carry) +
        "/" +
        root.Sim.carryCap(state) +
        "　ほかん " +
        root.Sim.bagCount(state.storage) +
        "/" +
        root.Sim.storageCap(state);
    }
    body.querySelectorAll("[data-count]").forEach(function (el) {
      const parts = el.dataset.count.split(".");
      el.textContent = String((state[parts[0]] && state[parts[0]][parts[1]]) || 0);
    });
    body.querySelectorAll("[data-have]").forEach(function (el) {
      el.textContent = String(root.Sim.haveTotal(state, el.dataset.have));
    });
    const hint = body.querySelector("[data-base-hint]");
    if (hint) {
      hint.textContent = extra.inBase
        ? "ひみつきちのうえでできる"
        : "ひみつきちのまるいしばふにもどると、うれる・たてられる・やとえる";
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
      if (state.backpack) setDisabled(buy, true, "かった");
      else setDisabled(buy, !extra.inBase || !root.Sim.canBuyBackpack(state).ok, "かう");
    }
    const buyNote = body.querySelector("[data-buy-note]");
    if (buyNote) {
      if (state.backpack) buyNote.textContent = "もっている";
      else if (!extra.inBase) buyNote.textContent = "ひみつきちでもどるとかえる";
      else if (!root.Sim.canBuyBackpack(state).ok) buyNote.textContent = "コインがたりない";
      else buyNote.textContent = "かえる";
    }
    CFG().buildingOrder.forEach(function (id) {
      const button = body.querySelector('[data-build="' + id + '"]');
      const note = body.querySelector('[data-build-note="' + id + '"]');
      if (!button) return;
      const check = root.Sim.canBuild(state, id);
      if (state.buildings[id]) setDisabled(button, true, "できた");
      else if (check.reason === "locked") setDisabled(button, true, "まだ");
      else setDisabled(button, !extra.inBase || !check.ok, "たてる");
      if (!note) return;
      if (state.buildings[id]) note.textContent = "できた";
      else if (check.reason === "locked") note.textContent = "ひかりのはやしでひかるきのこをひろうとひらく";
      else if (!extra.inBase) note.textContent = "ひみつきちでもどるとたてられる";
      else if (check.reason === "no-coins") note.textContent = "コインがたりない";
      else if (check.reason === "no-materials") note.textContent = "ざいりょうがたりない";
      else note.textContent = "たてられる";
    });
    const hire = body.querySelector("[data-hire]");
    if (hire) {
      if (state.helperHired) setDisabled(hire, true, "きた");
      else setDisabled(hire, !extra.inBase || !root.Sim.canHire(state).ok, "やとう");
    }
    const hireNote = body.querySelector("[data-hire-note]");
    if (hireNote) {
      if (state.helperHired) hireNote.textContent = "ひみつきちではたらいている";
      else if (!extra.inBase) hireNote.textContent = "ひみつきちでもどるとやとえる";
      else if (!root.Sim.canHire(state).ok) hireNote.textContent = "コインがたりない";
      else hireNote.textContent = "やとえる";
    }
    const inputName = CFG().resources[CFG().workbench.input].name;
    ["helper", "workbench"].forEach(function (key) {
      const statusEl = body.querySelector('[data-status="' + key + '"]');
      const remedyEl = body.querySelector('[data-remedy="' + key + '"]');
      const active = key === "helper" ? state.helperHired : state.buildings.workbench;
      const code = active ? extra.statuses[key] : "off";
      if (statusEl) {
        statusEl.textContent = active ? statusName(code, inputName) : key === "helper" ? "まだきていない" : "まだない";
      }
      if (remedyEl) remedyEl.textContent = active ? remedy(code) : "";
      const bar = body.querySelector('[data-bar="' + key + '"]');
      const wrap = body.querySelector('[data-bar-wrap="' + key + '"]');
      if (wrap) wrap.hidden = !active;
      if (bar && active) {
        const interval = key === "helper" ? CFG().helper.intervalMs : CFG().workbench.intervalMs;
        const value = key === "helper" ? state.progress.helperMs : state.progress.workbenchMs;
        bar.style.width = Math.max(0, Math.min(1, value / interval)) * 100 + "%";
      }
    });
    const saved = $("settings-saved");
    if (saved) saved.textContent = "さいごにほぞん: " + formatTime(state.savedAt);
  }

  function openPanel(name) {
    const panel = panels[name];
    if (!panel || !lastState) return;
    current = name;
    document.body.classList.add("panel-open");
    $("scrim").hidden = false;
    $("panel-title").textContent = panel.title;
    $("panel-body").innerHTML = panel.render(actions.loaded);
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

  function init(nextActions) {
    actions = nextActions;
    const loaded = nextActions.loaded;
    const start = $("start-btn");
    if (loaded.locked) start.textContent = "みてみる";
    else if (loaded.hadSave) start.textContent = "つづきから";
    else start.textContent = "はじめる";
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
      else if (button.dataset.buy) actions.onBuy();
      else if (button.dataset.hire != null) actions.onHire();
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
