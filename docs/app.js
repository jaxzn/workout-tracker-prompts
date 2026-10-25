(function () {
  "use strict";

  var program = globalThis.InclineProgram;
  var SESSIONS = program.SESSIONS;
  var FEELS = program.FEELS;

  var STORAGE = {
    settings: "incline-log.settings.v1",
    draft: "incline-log.draft.v1",
    entries: "incline-log.entries.v1",
  };

  var state = {
    settings: null,
    draft: null,
    entries: [],
    persistOk: true,
  };

  var memoryStore = new Map();
  var chipSignature = "";
  var flashToken = 0;
  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function storageGet(key) {
    if (!state.persistOk) return memoryStore.has(key) ? memoryStore.get(key) : null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      state.persistOk = false;
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    }
  }

  function storageSet(key, value) {
    memoryStore.set(key, value);
    if (!state.persistOk) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      state.persistOk = false;
    }
  }

  function parseJSON(value) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function uid() {
    if (globalThis.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function asText(value) {
    return value == null ? "" : String(value);
  }

  function blankTo(value, fallback) {
    return String(value).trim() === "" ? fallback : value;
  }

  function loadSettings() {
    return program.normalizeSettings(parseJSON(storageGet(STORAGE.settings)) || program.DEFAULT_SETTINGS, new Date());
  }

  function coerceDraft(raw, settings) {
    if (!raw || typeof raw !== "object" || !SESSIONS[raw.session]) {
      return program.freshDraft(settings, new Date());
    }
    var date = program.parseISODate(raw.date);
    var feel = FEELS.indexOf(raw.feel) === -1 ? "" : raw.feel;
    return {
      session: raw.session,
      date: Number.isNaN(date.getTime()) ? program.formatISODate(new Date()) : raw.date,
      weight: asText(raw.weight),
      sets: asText(raw.sets),
      reps: asText(raw.reps),
      accessories: asText(raw.accessories).slice(0, 500),
      distance: asText(raw.distance),
      minutes: asText(raw.minutes),
      seconds: asText(raw.seconds),
      feel: feel,
      notes: asText(raw.notes).slice(0, 1000),
      done: raw.done === "no" ? "no" : "yes",
      savedId: typeof raw.savedId === "string" ? raw.savedId : null,
    };
  }

  function loadEntries() {
    var raw = parseJSON(storageGet(STORAGE.entries));
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (entry) {
      return entry && typeof entry.id === "string" && entry.draft && SESSIONS[entry.draft.session];
    }).slice(0, 40);
  }

  function currentDate() {
    var date = program.parseISODate(state.draft.date);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function currentPlan() {
    if (state.draft.session === "run") return null;
    var week = program.trainingWeek(currentDate(), state.settings).week;
    return program.plannedLift(state.draft.session, state.settings, week);
  }

  function followingPlan() {
    if (state.draft.session === "run") return true;
    var plan = currentPlan();
    if (!plan) return false;
    if (String(state.draft.weight).trim() === "") return false;
    return Number(state.draft.weight) === Number(plan.weight) &&
      Number(state.draft.sets) === Number(plan.sets) &&
      Number(state.draft.reps) === Number(plan.reps);
  }

  function writePlanNumbers() {
    var plan = currentPlan();
    if (!plan) return;
    state.draft.weight = String(plan.weight);
    state.draft.sets = String(plan.sets);
    state.draft.reps = String(plan.reps);
  }

  function readDraftFromForm() {
    state.draft.weight = els.weight.value;
    state.draft.sets = els.sets.value;
    state.draft.reps = els.reps.value;
    state.draft.accessories = els.accessories.value;
    state.draft.distance = els.distance.value;
    state.draft.minutes = els.minutes.value;
    state.draft.seconds = els.seconds.value;
    state.draft.notes = els.notes.value;
  }

  function fillLiftFields() {
    els.weight.value = state.draft.weight;
    els.sets.value = state.draft.sets;
    els.reps.value = state.draft.reps;
  }

  function fillForm() {
    els.date.value = state.draft.date;
    fillLiftFields();
    els.accessories.value = state.draft.accessories;
    els.distance.value = state.draft.distance;
    els.minutes.value = state.draft.minutes;
    els.seconds.value = state.draft.seconds;
    els.notes.value = state.draft.notes;
  }

  function fillSettings() {
    els.tm.value = state.settings.tm;
    els.goal.value = state.settings.goal;
    els.bump.value = state.settings.weeklyBump;
    els.roundTo.value = String(state.settings.roundTo);
    els.cycleStart.value = state.settings.cycleStart;
    els.intensity.checked = state.settings.legsIntensity;
  }

  function persistDraft() {
    storageSet(STORAGE.draft, JSON.stringify(state.draft));
    showStorageNote();
  }

  function persistSettings() {
    storageSet(STORAGE.settings, JSON.stringify(state.settings));
    showStorageNote();
  }

  function persistEntries() {
    storageSet(STORAGE.entries, JSON.stringify(state.entries));
    showStorageNote();
  }

  function showStorageNote() {
    els.storageNote.hidden = state.persistOk;
  }

  function flash(text) {
    var token = ++flashToken;
    els.status.textContent = text;
    window.setTimeout(function () {
      if (flashToken === token) els.status.textContent = "";
    }, 4000);
  }

  function setPressed(nodes, attr, value) {
    nodes.forEach(function (node) {
      node.setAttribute("aria-pressed", node.getAttribute(attr) === value ? "true" : "false");
    });
  }

  function updateLede(week) {
    var tm = program.formatNumber(week.tm);
    var goal = program.formatNumber(state.settings.goal);
    if (Number(tm) > Number(goal)) {
      els.lede.textContent = week.label + " · TM " + tm + " lb · past the " + goal + " lb goal";
    } else if (Number(tm) === Number(goal)) {
      els.lede.textContent = week.label + " · TM " + tm + " lb · at the incline goal";
    } else {
      els.lede.textContent = week.label + " · TM " + tm + " lb → " + goal;
    }
  }

  function renderChips(weekItems) {
    var signature = weekItems.map(function (item) {
      var weight = item.plan ? item.plan.weight + "x" + item.plan.sets + "x" + item.plan.reps : "run";
      return item.id + ":" + program.formatISODate(item.date) + ":" + weight;
    }).join("|") + ">" + state.draft.date + ":" + state.draft.session;
    if (signature === chipSignature) return;
    chipSignature = signature;
    var fragment = document.createDocumentFragment();
    weekItems.forEach(function (item) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      var selected = program.formatISODate(item.date) === state.draft.date && item.id === state.draft.session;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      var title = document.createElement("span");
      title.className = "choice-title";
      title.textContent = program.formatWeekdayDay(item.date);
      var meta = document.createElement("span");
      meta.className = "choice-meta";
      meta.textContent = item.id === "run"
        ? "Easy run · 3–5 mi"
        : item.plan.weight + " lb · " + item.plan.sets + "×" + item.plan.reps;
      button.append(title, meta);
      button.addEventListener("click", function () {
        applyPlanSelection({ date: item.date, session: item.id });
      });
      fragment.append(button);
    });
    els.weekPlan.replaceChildren(fragment);
  }

  function updateOffday() {
    var date = program.parseISODate(state.draft.date);
    var base = Number.isNaN(date.getTime()) ? new Date() : date;
    if (program.sessionIdForDate(base)) {
      els.offday.hidden = true;
      return;
    }
    var next = program.nextPlanOnOrAfter(base);
    els.offday.hidden = !next;
    if (!next) return;
    els.jumpNext.textContent = "Go to " + program.formatWeekdayDay(next.date) + " · " + SESSIONS[next.session].short;
  }

  function updateDerived() {
    var date = currentDate();
    var week = program.trainingWeek(date, state.settings);
    var isRun = state.draft.session === "run";
    updateLede(week);
    els.weekTitle.textContent = week.label;
    els.weekRange.textContent = week.range + " · TM " + program.formatNumber(week.tm) + " lb";
    renderChips(program.weekPlan(state.settings, date));
    setPressed(els.sessionButtons, "data-session", state.draft.session);
    setPressed(els.feelButtons, "data-feel", state.draft.feel);
    setPressed(els.doneButtons, "data-done", state.draft.done);
    els.legsMeta.textContent = state.settings.legsIntensity ? "Thu · 10×3 @ 85%" : "Thu · 8×4 @ 80%";
    els.liftFields.hidden = isRun;
    els.runFields.hidden = !isRun;
    els.workLabel.textContent = isRun ? "Easy run" : "Incline";
    els.matchPlan.hidden = isRun || followingPlan();
    if (!isRun) {
      var plan = currentPlan();
      els.planWeight.textContent = program.formatNumber(plan.weight);
      els.planCaption.textContent = program.planCaption(plan);
      els.accessoryHint.textContent = SESSIONS[state.draft.session].accessoryHint;
    }
    updateOffday();
    els.message.textContent = program.formatMessage(state.draft, state.settings);
    els.save.textContent = state.draft.savedId ? "Update saved session" : "Save session";
    showStorageNote();
  }

  function applyPlanSelection(item) {
    state.draft.date = program.formatISODate(item.date);
    state.draft.session = item.session;
    state.draft.savedId = null;
    if (item.session === "run") {
      if (String(state.draft.distance).trim() === "") state.draft.distance = "4";
    } else {
      writePlanNumbers();
    }
    fillForm();
    updateDerived();
    persistDraft();
  }

  function selectSession(id) {
    if (!SESSIONS[id] || state.draft.session === id) return;
    state.draft.session = id;
    state.draft.savedId = null;
    if (id === "run") {
      if (String(state.draft.distance).trim() === "") state.draft.distance = "4";
    } else {
      writePlanNumbers();
    }
    fillForm();
    updateDerived();
    persistDraft();
  }

  function shiftWeek(delta) {
    var wasFollowing = followingPlan();
    state.draft.date = program.formatISODate(program.addDays(currentDate(), 7 * delta));
    state.draft.savedId = null;
    if (wasFollowing && state.draft.session !== "run") writePlanNumbers();
    fillForm();
    updateDerived();
    persistDraft();
  }

  function onDateChange() {
    var next = els.date.value;
    var parsed = program.parseISODate(next);
    if (!next || Number.isNaN(parsed.getTime())) {
      els.date.value = state.draft.date;
      return;
    }
    if (next === state.draft.date) return;
    var wasFollowing = followingPlan();
    state.draft.date = next;
    state.draft.savedId = null;
    if (wasFollowing && state.draft.session !== "run") writePlanNumbers();
    fillForm();
    updateDerived();
    persistDraft();
  }

  function selectFeel(feel) {
    state.draft.feel = state.draft.feel === feel ? "" : feel;
    updateDerived();
    persistDraft();
  }

  function selectDone(done) {
    state.draft.done = done === "no" ? "no" : "yes";
    updateDerived();
    persistDraft();
  }

  function commitSettings() {
    var wasFollowing = followingPlan();
    var pickedCycle = els.cycleStart.value;
    state.settings = program.normalizeSettings({
      tm: blankTo(els.tm.value, state.settings.tm),
      goal: blankTo(els.goal.value, state.settings.goal),
      weeklyBump: blankTo(els.bump.value, state.settings.weeklyBump),
      roundTo: els.roundTo.value,
      cycleStart: els.cycleStart.value || state.settings.cycleStart,
      legsIntensity: els.intensity.checked,
    }, new Date());
    fillSettings();
    if (pickedCycle && state.settings.cycleStart !== pickedCycle) {
      flash("Weeks start on Monday, so week 1 starts " + program.formatLong(program.parseISODate(state.settings.cycleStart)) + ".");
    }
    if (wasFollowing && state.draft.session !== "run") {
      writePlanNumbers();
      fillLiftFields();
    }
    chipSignature = "";
    updateDerived();
    persistSettings();
    persistDraft();
  }

  function draftSnapshot() {
    return {
      session: state.draft.session,
      date: state.draft.date,
      weight: state.draft.weight,
      sets: state.draft.sets,
      reps: state.draft.reps,
      accessories: state.draft.accessories,
      distance: state.draft.distance,
      minutes: state.draft.minutes,
      seconds: state.draft.seconds,
      feel: state.draft.feel,
      notes: state.draft.notes,
      done: state.draft.done,
    };
  }

  function saveEntry() {
    readDraftFromForm();
    var draft = draftSnapshot();
    var existingIndex = state.entries.findIndex(function (entry) {
      return entry.id === state.draft.savedId;
    });
    if (existingIndex >= 0) {
      var existing = state.entries[existingIndex];
      existing.draft = draft;
      existing.savedAt = new Date().toISOString();
      state.entries.splice(existingIndex, 1);
      state.entries.unshift(existing);
      flash("Updated the saved session.");
    } else {
      var id = uid();
      state.draft.savedId = id;
      state.entries.unshift({ id: id, savedAt: new Date().toISOString(), draft: draft });
      flash("Saved on this phone.");
    }
    state.entries = state.entries.slice(0, 40);
    persistEntries();
    persistDraft();
    updateDerived();
    renderLog();
  }

  function loadEntry(id) {
    var entry = state.entries.find(function (item) { return item.id === id; });
    if (!entry) return;
    state.draft = coerceDraft(entry.draft, state.settings);
    state.draft.savedId = id;
    fillForm();
    chipSignature = "";
    updateDerived();
    persistDraft();
    flash("Loaded into the form.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteEntry(id) {
    state.entries = state.entries.filter(function (entry) { return entry.id !== id; });
    if (state.draft.savedId === id) state.draft.savedId = null;
    persistEntries();
    persistDraft();
    updateDerived();
    renderLog();
    flash("Removed from this phone.");
  }

  function clearLog() {
    if (els.clearLog.dataset.armed !== "true") {
      els.clearLog.dataset.armed = "true";
      els.clearLog.textContent = "Confirm clear";
      window.setTimeout(function () {
        if (els.clearLog.dataset.armed === "true") {
          els.clearLog.dataset.armed = "false";
          els.clearLog.textContent = "Clear all";
        }
      }, 2500);
      return;
    }
    els.clearLog.dataset.armed = "false";
    els.clearLog.textContent = "Clear all";
    state.entries = [];
    state.draft.savedId = null;
    persistEntries();
    persistDraft();
    updateDerived();
    renderLog();
    flash("Cleared the log on this phone.");
  }

  function renderLog() {
    els.logList.replaceChildren();
    els.logEmpty.hidden = state.entries.length > 0;
    els.clearLog.hidden = state.entries.length === 0;
    state.entries.forEach(function (entry) {
      var item = document.createElement("li");
      item.className = "log-item";
      var open = document.createElement("button");
      open.type = "button";
      open.className = "log-open";
      var summary = program.entrySummary(entry.draft);
      var title = document.createElement("span");
      title.className = "log-title";
      title.textContent = summary.title;
      var detail = document.createElement("span");
      detail.className = "log-detail";
      detail.textContent = summary.detail;
      open.append(title, detail);
      open.addEventListener("click", function () { loadEntry(entry.id); });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove " + summary.title);
      remove.addEventListener("click", function () {
        if (remove.dataset.armed === "true") {
          deleteEntry(entry.id);
          return;
        }
        remove.dataset.armed = "true";
        remove.textContent = "Confirm";
        window.setTimeout(function () {
          if (!remove.isConnected) return;
          remove.dataset.armed = "false";
          remove.textContent = "Remove";
        }, 2500);
      });
      item.append(open, remove);
      els.logList.append(item);
    });
  }

  function startNewSession() {
    var dirty = state.draft.notes.trim() || state.draft.accessories.trim() || state.draft.feel;
    if (dirty && els.newSession.dataset.armed !== "true") {
      els.newSession.dataset.armed = "true";
      els.newSession.textContent = "Confirm clear";
      window.setTimeout(function () {
        if (els.newSession.dataset.armed !== "true") return;
        els.newSession.dataset.armed = "false";
        els.newSession.textContent = "Start a new session";
      }, 2500);
      return;
    }
    els.newSession.dataset.armed = "false";
    els.newSession.textContent = "Start a new session";
    state.draft = program.freshDraft(state.settings, new Date());
    fillForm();
    chipSignature = "";
    updateDerived();
    persistDraft();
    flash("Started a new session.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectMessage() {
    var selection = window.getSelection();
    if (!selection) return;
    var range = document.createRange();
    range.selectNodeContents(els.message);
    selection.removeAllRanges();
    selection.addRange(range);
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
    area.focus();
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

  function markCopied() {
    els.copy.textContent = "Copied";
    flash("Copied. Paste it into the trainer chat.");
    window.setTimeout(function () {
      if (els.copy.textContent === "Copied") els.copy.textContent = "Copy message";
    }, 2500);
  }

  function markCopyFailed() {
    selectMessage();
    els.copy.textContent = "Copy message";
    flash("Couldn't use the clipboard. The message is selected, so you can copy it by hand.");
  }

  function copyMessage() {
    var text = els.message.textContent || "";
    var finished = false;
    function succeed() {
      if (finished) return;
      finished = true;
      markCopied();
    }
    function fail() {
      if (finished) return;
      finished = true;
      markCopyFailed();
    }

    // Start the async clipboard write during the click, before any fallback
    // focus change. Some browsers leave that promise pending, so the fallback
    // and a short timeout still update the button.
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

  function cacheElements() {
    els.form = $("session-form");
    els.lede = $("lede");
    els.weekTitle = $("week-title");
    els.weekRange = $("week-range");
    els.weekPlan = $("week-plan");
    els.prevWeek = $("prev-week");
    els.nextWeek = $("next-week");
    els.date = $("date");
    els.offday = $("offday");
    els.jumpNext = $("jump-next");
    els.workLabel = $("work-label");
    els.liftFields = $("lift-fields");
    els.runFields = $("run-fields");
    els.planWeight = $("plan-weight");
    els.planCaption = $("plan-caption");
    els.matchPlan = $("match-plan");
    els.weight = $("weight");
    els.sets = $("sets");
    els.reps = $("reps");
    els.accessories = $("accessories");
    els.accessoryHint = $("accessory-hint");
    els.distance = $("distance");
    els.minutes = $("minutes");
    els.seconds = $("seconds");
    els.notes = $("notes");
    els.message = $("message");
    els.copy = $("copy");
    els.save = $("save");
    els.newSession = $("new-session");
    els.status = $("status");
    els.logList = $("log-list");
    els.logEmpty = $("log-empty");
    els.clearLog = $("clear-log");
    els.storageNote = $("storage-note");
    els.tm = $("tm");
    els.goal = $("goal");
    els.bump = $("bump");
    els.roundTo = $("round-to");
    els.cycleStart = $("cycle-start");
    els.intensity = $("legs-intensity");
    els.legsMeta = $("legs-meta");
    els.sessionButtons = document.querySelectorAll("[data-session]");
    els.feelButtons = document.querySelectorAll("[data-feel]");
    els.doneButtons = document.querySelectorAll("[data-done]");
  }

  function bind() {
    els.form.addEventListener("submit", function (event) { event.preventDefault(); });
    els.form.addEventListener("input", function (event) {
      var target = event.target;
      if (target === els.date) return;
      if (!target || !target.id) return;
      readDraftFromForm();
      updateDerived();
      persistDraft();
    });
    els.form.addEventListener("wheel", function (event) {
      var active = document.activeElement;
      if (active && active.type === "number" && event.target === active) event.preventDefault();
    }, { passive: false });
    els.date.addEventListener("change", onDateChange);
    els.sessionButtons.forEach(function (button) {
      button.addEventListener("click", function () { selectSession(button.getAttribute("data-session")); });
    });
    els.feelButtons.forEach(function (button) {
      button.addEventListener("click", function () { selectFeel(button.getAttribute("data-feel")); });
    });
    els.doneButtons.forEach(function (button) {
      button.addEventListener("click", function () { selectDone(button.getAttribute("data-done")); });
    });
    els.prevWeek.addEventListener("click", function () { shiftWeek(-1); });
    els.nextWeek.addEventListener("click", function () { shiftWeek(1); });
    els.jumpNext.addEventListener("click", function () {
      var next = program.nextPlanOnOrAfter(currentDate());
      if (next) applyPlanSelection(next);
    });
    els.matchPlan.addEventListener("click", function () {
      writePlanNumbers();
      fillLiftFields();
      updateDerived();
      persistDraft();
    });
    els.copy.addEventListener("click", copyMessage);
    els.save.addEventListener("click", saveEntry);
    els.newSession.addEventListener("click", startNewSession);
    els.clearLog.addEventListener("click", clearLog);
    [els.tm, els.goal, els.bump, els.roundTo, els.cycleStart, els.intensity].forEach(function (input) {
      input.addEventListener("change", commitSettings);
    });
  }

  function boot() {
    cacheElements();
    state.settings = loadSettings();
    state.entries = loadEntries();
    state.draft = coerceDraft(parseJSON(storageGet(STORAGE.draft)), state.settings);
    if (state.draft.savedId && !state.entries.some(function (entry) { return entry.id === state.draft.savedId; })) {
      state.draft.savedId = null;
    }
    bind();
    fillSettings();
    fillForm();
    updateDerived();
    renderLog();
    persistSettings();
    persistDraft();
  }

  boot();
})();
