(function () {
  "use strict";

  function showBootError(message) {
    var banner = document.getElementById("boot-error");
    if (!banner) {
      banner = document.createElement("p");
      banner.id = "boot-error";
      banner.className = "banner storage-blocked";
      banner.setAttribute("role", "alert");
      var main = document.querySelector("main");
      if (main && main.parentNode) main.parentNode.insertBefore(banner, main);
      else document.body.appendChild(banner);
    }
    banner.hidden = false;
    banner.textContent = message;
    var days = document.getElementById("days");
    if (days && !days.childElementCount) {
      var note = document.createElement("p");
      note.className = "hint";
      note.id = "days-error";
      note.textContent = message;
      days.appendChild(note);
    }
  }

  var program = globalThis.WorkoutProgram;
  if (
    !program ||
    typeof program.smolovCycle !== "function" ||
    typeof program.formatSmolovCopy !== "function" ||
    typeof program.openBrowserStore !== "function"
  ) {
    showBootError("Smolov Jr couldn't start. This browser loaded an old script. Refresh the page. In Brave, turn Shields down for this site if the weeks stay blank.");
    return;
  }

  var STORAGE = program.STORAGE;
  var els = {};
  var copyTimer = 0;
  var copyButton = null;

  function $(id) {
    return document.getElementById(id);
  }

  function parseJSON(value) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  var store = program.openBrowserStore();

  function showStorageNote() {
    if (!els.storageNote) return;
    els.storageNote.hidden = store.kind() !== "none";
  }

  function retireOldKeys() {
    var keys = program.RETIRED_KEYS || [];
    keys.forEach(function (key) {
      store.remove(key);
      try { localStorage.removeItem(key); } catch (error) { /* already gone */ }
      try { sessionStorage.removeItem(key); } catch (error) { /* already gone */ }
    });
  }

  function defaultSettings() {
    return { tm: "200", weeklyBump: "5", lift: "Incline bench" };
  }

  function loadSettings() {
    var raw = parseJSON(store.get(STORAGE.smolov)) || {};
    var defaults = defaultSettings();
    return {
      tm: raw.tm == null || raw.tm === "" ? defaults.tm : String(raw.tm),
      weeklyBump: raw.weeklyBump == null || raw.weeklyBump === "" ? defaults.weeklyBump : String(raw.weeklyBump),
      lift: raw.lift == null || String(raw.lift).trim() === "" ? defaults.lift : String(raw.lift),
    };
  }

  function readSettings() {
    return {
      tm: els.tm.value,
      weeklyBump: els.bump.value,
      lift: els.lift.value,
    };
  }

  function persistSettings() {
    var ok = store.set(STORAGE.smolov, JSON.stringify(readSettings()));
    showStorageNote();
    return ok;
  }

  function currentCycle() {
    return program.smolovCycle(readSettings());
  }

  function summaryText(cycle) {
    return cycle.lift + " · " + program.formatNumber(cycle.baseTm) + " lb · +" +
      program.formatNumber(cycle.bump) + " lb each week";
  }

  function clearCopyTimer() {
    if (copyTimer) window.clearTimeout(copyTimer);
    copyTimer = 0;
    copyButton = null;
  }

  function renderDays() {
    clearCopyTimer();
    var cycle = currentCycle();
    els.summary.textContent = summaryText(cycle);
    els.days.replaceChildren();
    cycle.weeks.forEach(function (week) {
      els.days.append(renderWeek(week));
    });
    if (els.status) els.status.textContent = "";
  }

  function renderWeek(week) {
    var block = document.createElement("section");
    block.className = "week-block";
    var heading = document.createElement("h3");
    heading.textContent = "Week " + week.week + " · " + program.formatNumber(week.tm) + " lb";
    var list = document.createElement("div");
    list.className = "week-days";
    week.days.forEach(function (day) {
      list.append(renderDay(day, week));
    });
    block.append(heading, list);
    return block;
  }

  function renderDay(day, week) {
    var line = program.formatSmolovCopy(week, day);
    var card = document.createElement("article");
    card.className = "card day-line";

    var meta = document.createElement("div");
    meta.className = "day-meta";
    var kickerRow = document.createElement("div");
    kickerRow.className = "kicker-row";
    var kicker = document.createElement("p");
    kicker.className = "kicker";
    kicker.textContent = day.label;
    kickerRow.append(kicker);
    if (day.optional) {
      var badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Optional";
      kickerRow.append(badge);
    }
    var raw = program.formatNumber(day.raw);
    var rounded = program.formatNumber(day.weight);
    var caption = document.createElement("p");
    caption.className = "plan-caption";
    caption.textContent = day.sets + "\u00d7" + day.reps + " @ " + day.pctLabel +
      (raw !== rounded ? " · " + raw + "\u2192" + rounded : "");
    var paste = document.createElement("p");
    paste.className = "paste-line";
    paste.textContent = line;
    meta.append(kickerRow, caption, paste);

    var figure = document.createElement("p");
    figure.className = "plan-figure";
    figure.append(document.createTextNode(rounded + " "));
    var unit = document.createElement("span");
    unit.className = "unit";
    unit.textContent = "lb";
    figure.append(unit);

    var copy = document.createElement("button");
    copy.type = "button";
    copy.className = "primary copy-btn";
    copy.dataset.action = "copy";
    copy.dataset.week = String(week.week);
    copy.dataset.day = day.id;
    copy.dataset.label = "Copy";
    copy.textContent = "Copy";
    copy.setAttribute("aria-label", "Copy " + line);

    card.append(meta, figure, copy);
    return card;
  }

  function findSlot(weekNumber, dayId) {
    var weeks = currentCycle().weeks;
    for (var i = 0; i < weeks.length; i += 1) {
      if (String(weeks[i].week) !== String(weekNumber)) continue;
      var days = weeks[i].days;
      for (var d = 0; d < days.length; d += 1) {
        if (days[d].id === dayId) return { week: weeks[i], day: days[d] };
      }
    }
    return null;
  }

  function copyWithSelection(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.setAttribute("aria-hidden", "true");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.width = "1px";
    area.style.height = "1px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    try {
      area.focus({ preventScroll: true });
    } catch (error) {
      area.focus();
    }
    area.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    area.remove();
    return ok;
  }

  function flashStatus(message) {
    if (!els.status) return;
    els.status.textContent = message;
  }

  function rememberLabel(button) {
    var current = button.getAttribute("aria-label") || "Copy";
    if (current !== "Copied" && current !== "Couldn't copy") button.dataset.restorableLabel = current;
  }

  function restoreCopyButton(button) {
    if (!button || !button.isConnected) return;
    button.textContent = button.dataset.label || "Copy";
    button.classList.remove("is-copied");
    if (button.dataset.restorableLabel) button.setAttribute("aria-label", button.dataset.restorableLabel);
  }

  function refocus(button) {
    try {
      button.focus({ preventScroll: true });
    } catch (error) {
      button.focus();
    }
  }

  function markCopied(button) {
    if (copyButton && copyButton !== button) restoreCopyButton(copyButton);
    if (copyTimer) window.clearTimeout(copyTimer);
    copyButton = button;
    rememberLabel(button);
    button.textContent = "Copied";
    button.classList.add("is-copied");
    button.setAttribute("aria-label", "Copied");
    flashStatus("Copied");
    refocus(button);
    copyTimer = window.setTimeout(function () {
      copyTimer = 0;
      restoreCopyButton(button);
      if (copyButton === button) copyButton = null;
      if (els.status && els.status.textContent === "Copied") els.status.textContent = "";
    }, 1600);
  }

  function markFailed(button) {
    if (copyButton && copyButton !== button) restoreCopyButton(copyButton);
    if (copyTimer) window.clearTimeout(copyTimer);
    copyButton = button;
    rememberLabel(button);
    button.textContent = "Couldn't copy";
    button.classList.remove("is-copied");
    button.setAttribute("aria-label", "Couldn't copy");
    flashStatus("Couldn't copy. Select the line under that day.");
    refocus(button);
    copyTimer = window.setTimeout(function () {
      copyTimer = 0;
      restoreCopyButton(button);
      if (copyButton === button) copyButton = null;
    }, 2200);
  }

  function copyText(text, button) {
    var finished = false;
    function succeed() {
      if (finished) return;
      finished = true;
      markCopied(button);
    }
    function fail() {
      if (finished) return;
      finished = true;
      markFailed(button);
    }
    var pending = null;
    if (window.isSecureContext && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      pending = navigator.clipboard.writeText(text);
    }
    var legacyOk = copyWithSelection(text);
    if (legacyOk) succeed();
    if (!pending) {
      if (!legacyOk) fail();
      return;
    }
    var timer = window.setTimeout(function () {
      if (!finished) fail();
    }, 1000);
    pending.then(function () {
      window.clearTimeout(timer);
      succeed();
    }).catch(function () {
      window.clearTimeout(timer);
      if (!finished) fail();
    });
  }

  function onDayClick(event) {
    var button = event.target.closest("[data-action='copy']");
    if (!button || !els.days.contains(button)) return;
    var slot = findSlot(button.dataset.week, button.dataset.day);
    if (!slot) return;
    copyText(program.formatSmolovCopy(slot.week, slot.day), button);
  }

  function fillLifts() {
    var lifts = program.LIFTS || [];
    lifts.forEach(function (name) {
      var option = document.createElement("option");
      option.value = name;
      els.lifts.append(option);
    });
  }

  function onSettingsInput() {
    persistSettings();
    renderDays();
  }

  function bind() {
    els.form.addEventListener("submit", function (event) { event.preventDefault(); });
    els.form.addEventListener("input", onSettingsInput);
    els.form.addEventListener("change", onSettingsInput);
    els.form.addEventListener("wheel", function (event) {
      var active = document.activeElement;
      if (active && active.type === "number" && event.target === active) event.preventDefault();
    }, { passive: false });
    els.days.addEventListener("click", onDayClick);
  }

  function boot() {
    try {
      els.form = $("smolov-form");
      els.lift = $("lift");
      els.lifts = $("lifts");
      els.tm = $("tm");
      els.bump = $("bump");
      els.summary = $("week-summary");
      els.days = $("days");
      els.status = $("copy-status");
      els.storageNote = $("storage-note");
      retireOldKeys();
      showStorageNote();
      fillLifts();
      var settings = loadSettings();
      els.lift.value = settings.lift;
      els.tm.value = settings.tm;
      els.bump.value = settings.weeklyBump;
      bind();
      persistSettings();
      renderDays();
      if (!els.days || !els.days.querySelector(".day-line")) {
        showBootError("Smolov Jr didn't list the weeks. Refresh the page.");
      }
    } catch (error) {
      showBootError("Smolov Jr couldn't start. Refresh the page. In Brave, turn Shields down for this site if the weeks stay blank.");
    }
  }

  boot();
})();
