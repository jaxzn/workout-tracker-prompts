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
  if (!program || typeof program.smolovCycle !== "function" || typeof program.openBrowserStore !== "function") {
    showBootError("Smolov Jr couldn't start. This browser loaded an old script. Refresh the page. In Brave, turn Shields down for this site if the weeks stay blank.");
    return;
  }

  var STORAGE = program.STORAGE;
  var els = {};

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

  function storageGet(key) {
    return store.get(key);
  }

  function showStorageNote() {
    if (!els.storageNote) return;
    els.storageNote.hidden = store.kind() !== "none";
  }

  function defaultSettings() {
    return { tm: "200", weeklyBump: "5", lift: "Incline bench" };
  }

  function loadSettings() {
    var raw = parseJSON(storageGet(STORAGE.smolov)) || {};
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

  function currentDraft() {
    return program.normalizeDraft(parseJSON(storageGet(STORAGE.draft)), new Date());
  }

  function workoutNote(draft) {
    var exercises = draft.exercises || [];
    if (!exercises.length) return "Nothing in the current workout yet. This starts one.";
    var names = [];
    exercises.forEach(function (exercise) {
      if (exercise.name) names.push(exercise.name);
    });
    var shown = names.slice(0, 3).join(", ");
    if (names.length > 3) shown += " +" + (names.length - 3);
    var noun = exercises.length === 1 ? "exercise" : "exercises";
    return "Current workout has " + exercises.length + " " + noun +
      (shown ? " (" + shown + ")" : "") + ". Adding keeps them.";
  }

  function summaryText(cycle) {
    return cycle.lift + " · " + program.formatNumber(cycle.baseTm) + " lb · +" +
      program.formatNumber(cycle.bump) + " lb each week";
  }

  function renderDays() {
    var cycle = currentCycle();
    var draft = currentDraft();
    var hasWorkout = draft.exercises.length > 0;
    els.summary.textContent = summaryText(cycle);
    els.note.textContent = workoutNote(draft);
    els.days.replaceChildren();
    cycle.weeks.forEach(function (week) {
      els.days.append(renderWeek(week, hasWorkout));
    });
  }

  function renderWeek(week, hasWorkout) {
    var block = document.createElement("section");
    block.className = "week-block";
    var heading = document.createElement("h3");
    heading.textContent = "Week " + week.week + " · " + program.formatNumber(week.tm) + " lb";
    var list = document.createElement("div");
    list.className = "week-days";
    week.days.forEach(function (day) {
      list.append(renderDay(day, week, hasWorkout));
    });
    block.append(heading, list);
    return block;
  }

  function renderDay(day, week, hasWorkout) {
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
    meta.append(kickerRow, caption);

    var figure = document.createElement("p");
    figure.className = "plan-figure";
    figure.append(document.createTextNode(rounded + " "));
    var unit = document.createElement("span");
    unit.className = "unit";
    unit.textContent = "lb";
    figure.append(unit);

    var actions = document.createElement("div");
    actions.className = "day-actions";
    var add = document.createElement("button");
    add.type = "button";
    add.className = "primary";
    add.dataset.action = "add";
    add.dataset.week = String(week.week);
    add.dataset.day = day.id;
    add.textContent = "Add";
    add.setAttribute(
      "aria-label",
      "Add to current workout: week " + week.week + " " + day.label + ", " +
        week.lift + " " + rounded + " lb, " + day.sets + " by " + day.reps
    );
    actions.append(add);
    if (hasWorkout) {
      var replace = document.createElement("button");
      replace.type = "button";
      replace.className = "secondary";
      replace.dataset.action = "replace";
      replace.dataset.week = String(week.week);
      replace.dataset.day = day.id;
      replace.textContent = "Replace";
      replace.setAttribute("aria-label", "Replace current workout");
      actions.append(replace);
    }
    card.append(meta, figure, actions);
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

  function openComposer(week, day, mode) {
    var pending = {
      mode: mode,
      name: week.lift,
      weight: String(day.weight),
      reps: String(day.reps),
      sets: String(day.sets),
    };
    var query = program.pendingToQuery(pending);
    try {
      sessionStorage.setItem(STORAGE.pending, JSON.stringify(pending));
    } catch (error) {
      /* the query string is enough on its own */
    }
    window.location.href = "./index.html?" + query + "#add";
  }

  function onDayClick(event) {
    var button = event.target.closest("[data-action]");
    if (!button || !els.days.contains(button)) return;
    var slot = findSlot(button.dataset.week, button.dataset.day);
    if (!slot) return;
    if (button.dataset.action === "add") {
      openComposer(slot.week, slot.day, "append");
      return;
    }
    if (button.dataset.action !== "replace") return;
    if (button.dataset.armed !== "true") {
      button.dataset.armed = "true";
      button.textContent = "Confirm";
      window.setTimeout(function () {
        if (!button.isConnected || button.dataset.armed !== "true") return;
        button.dataset.armed = "false";
        button.textContent = "Replace";
      }, 2800);
      return;
    }
    openComposer(slot.week, slot.day, "replace");
  }

  function fillLifts() {
    program.EXERCISES.forEach(function (name) {
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
    window.addEventListener("pageshow", renderDays);
  }

  function boot() {
    try {
      els.form = $("smolov-form");
      els.lift = $("lift");
      els.lifts = $("lifts");
      els.tm = $("tm");
      els.bump = $("bump");
      els.summary = $("week-summary");
      els.note = $("workout-note");
      els.days = $("days");
      els.storageNote = $("storage-note");
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
