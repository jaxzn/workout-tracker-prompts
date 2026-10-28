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
  var openWeek = 1;

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
    return { tm: "200", weeklyBump: "5", lift: "Incline bench", openWeek: 1 };
  }

  function normalizeOpenWeek(value) {
    var n = Math.floor(Number(value));
    if (n === 0 || n === 1 || n === 2 || n === 3) return n;
    return 1;
  }

  function loadSettings() {
    var raw = parseJSON(store.get(STORAGE.smolov)) || {};
    var defaults = defaultSettings();
    return {
      tm: raw.tm == null || raw.tm === "" ? defaults.tm : String(raw.tm),
      weeklyBump: raw.weeklyBump == null || raw.weeklyBump === "" ? defaults.weeklyBump : String(raw.weeklyBump),
      lift: raw.lift == null || String(raw.lift).trim() === "" ? defaults.lift : String(raw.lift),
      openWeek: raw.openWeek == null || raw.openWeek === "" ? defaults.openWeek : normalizeOpenWeek(raw.openWeek),
    };
  }

  function readSettings() {
    return {
      tm: els.tm.value,
      weeklyBump: els.bump.value,
      lift: els.lift.value,
      openWeek: openWeek,
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
    applyOpenWeek();
    if (els.status) els.status.textContent = "";
  }

  function makeChevron() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("class", "chevron");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M7 4l6 6-6 6");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
    return svg;
  }

  function renderWeek(week) {
    var block = document.createElement("section");
    block.className = "week-block";
    block.dataset.week = String(week.week);

    var heading = document.createElement("h3");
    heading.className = "week-heading";

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "week-toggle";
    toggle.id = "week-toggle-" + week.week;
    toggle.dataset.action = "toggle-week";
    toggle.dataset.week = String(week.week);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "week-panel-" + week.week);

    var name = document.createElement("span");
    name.className = "week-name";
    name.textContent = "Week " + week.week;

    var tm = document.createElement("span");
    tm.className = "week-tm";
    tm.textContent = program.formatNumber(week.tm) + " lb";

    toggle.append(makeChevron(), name, tm);
    heading.append(toggle);

    var panel = document.createElement("div");
    panel.className = "week-panel";
    panel.id = "week-panel-" + week.week;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", toggle.id);
    panel.hidden = true;

    var list = document.createElement("div");
    list.className = "week-days";
    week.days.forEach(function (day) {
      list.append(renderDay(day, week));
    });
    panel.append(list);
    block.append(heading, panel);
    return block;
  }

  function renderDay(day, week) {
    var line = program.formatSmolovCopy(week, day);
    var card = document.createElement("article");
    card.className = "day-line";

    var row = document.createElement("div");
    row.className = "day-row";

    var main = document.createElement("div");
    main.className = "day-main";

    var label = document.createElement("span");
    label.className = "day-label";
    label.textContent = day.label;
    main.append(label);

    if (day.optional) {
      var badge = document.createElement("span");
      badge.className = "badge";
      var full = document.createElement("span");
      full.className = "badge-full";
      full.textContent = "Optional";
      var short = document.createElement("span");
      short.className = "badge-short";
      short.textContent = "Opt";
      var rest = document.createElement("span");
      rest.className = "sr-only";
      rest.textContent = "ional";
      short.append(rest);
      badge.append(full, short);
      main.append(badge);
    }

    var rounded = program.formatNumber(day.weight);
    var raw = program.formatNumber(day.raw);
    var script = document.createElement("span");
    script.className = "day-script";
    var rx = document.createElement("span");
    rx.className = "day-rx";
    rx.append(document.createTextNode(day.sets + "\u00d7" + day.reps + " @ " + rounded));
    var unit = document.createElement("span");
    unit.className = "unit";
    unit.textContent = " lb";
    rx.append(unit);
    script.append(rx);
    if (raw !== rounded) {
      var drift = document.createElement("span");
      drift.className = "day-raw";
      drift.textContent = raw + "\u2192" + rounded;
      script.append(drift);
      script.title = day.pctLabel + " of the week is " + raw + " lb, rounded to " + rounded;
    } else {
      script.title = day.pctLabel;
    }
    main.append(script);

    var copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-btn";
    copy.dataset.action = "copy";
    copy.dataset.week = String(week.week);
    copy.dataset.day = day.id;
    copy.dataset.label = "Copy";
    copy.textContent = "Copy";
    copy.setAttribute("aria-label", "Copy " + line);

    row.append(main, copy);

    var paste = document.createElement("p");
    paste.className = "paste-line";
    paste.hidden = true;
    paste.textContent = line;

    card.append(row, paste);
    return card;
  }

  function applyOpenWeek() {
    if (!els.days) return;
    var blocks = els.days.querySelectorAll(".week-block");
    for (var i = 0; i < blocks.length; i += 1) {
      var block = blocks[i];
      var isOpen = Number(block.dataset.week) === openWeek;
      var toggle = block.querySelector(".week-toggle");
      var panel = block.querySelector(".week-panel");
      if (toggle) toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (panel) panel.hidden = !isOpen;
    }
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

  function hidePasteLines() {
    if (!els.days) return;
    var lines = els.days.querySelectorAll(".paste-line");
    for (var i = 0; i < lines.length; i += 1) lines[i].hidden = true;
  }

  function revealPasteLine(button) {
    var card = button.closest(".day-line");
    if (!card) return;
    hidePasteLines();
    var line = card.querySelector(".paste-line");
    if (!line) return;
    line.hidden = false;
    try {
      var range = document.createRange();
      range.selectNodeContents(line);
      var selection = window.getSelection();
      if (!selection) return;
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (error) {
      /* the line stays visible so it can be selected by hand */
    }
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
    hidePasteLines();
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
    flashStatus("Couldn't copy. The line under that day is selected.");
    refocus(button);
    revealPasteLine(button);
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

  function onToggleWeek(button) {
    var week = Number(button.dataset.week);
    if (week !== 1 && week !== 2 && week !== 3) return;
    openWeek = openWeek === week ? 0 : week;
    applyOpenWeek();
    persistSettings();
  }

  function onDaysClick(event) {
    var toggle = event.target.closest("[data-action='toggle-week']");
    if (toggle && els.days.contains(toggle)) {
      onToggleWeek(toggle);
      return;
    }
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
    els.days.addEventListener("click", onDaysClick);
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
      openWeek = settings.openWeek;
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
