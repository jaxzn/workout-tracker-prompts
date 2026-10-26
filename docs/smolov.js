(function () {
  "use strict";

  var program = globalThis.WorkoutProgram;
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

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function defaultSettings() {
    return { tm: "200", weeklyBump: "5", week: "", lift: "Incline bench" };
  }

  function loadSettings() {
    var raw = parseJSON(storageGet(STORAGE.smolov)) || {};
    var defaults = defaultSettings();
    return {
      tm: raw.tm == null || raw.tm === "" ? defaults.tm : String(raw.tm),
      weeklyBump: raw.weeklyBump == null || raw.weeklyBump === "" ? defaults.weeklyBump : String(raw.weeklyBump),
      week: raw.week == null ? "" : String(raw.week),
      lift: raw.lift == null || String(raw.lift).trim() === "" ? defaults.lift : String(raw.lift),
    };
  }

  function readSettings() {
    return {
      tm: els.tm.value,
      weeklyBump: els.bump.value,
      week: els.week.value,
      lift: els.lift.value,
    };
  }

  function persistSettings() {
    try {
      localStorage.setItem(STORAGE.smolov, JSON.stringify(readSettings()));
    } catch (error) {
      /* the calculator still runs without storage */
    }
  }

  function currentWeek() {
    return program.smolovWeek(readSettings());
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

  function summaryText(week) {
    var text = week.lift + " · Week " + week.week + " · training max " + program.formatNumber(week.tm) + " lb";
    if (week.week > 1) {
      text += " · started at " + program.formatNumber(week.baseTm) + ", +" + program.formatNumber(week.bump) + " lb/week";
    }
    return text;
  }

  function renderDays() {
    var week = currentWeek();
    var draft = currentDraft();
    var hasWorkout = draft.exercises.length > 0;
    els.summary.textContent = summaryText(week);
    els.note.textContent = workoutNote(draft);
    els.days.replaceChildren();
    week.days.forEach(function (day) {
      els.days.append(renderDay(day, week, hasWorkout));
    });
  }

  function renderDay(day, week, hasWorkout) {
    var card = document.createElement("article");
    card.className = "card day";

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

    var figure = document.createElement("p");
    figure.className = "plan-figure";
    figure.append(document.createTextNode(program.formatNumber(day.weight) + " "));
    var unit = document.createElement("span");
    unit.className = "unit";
    unit.textContent = "lb";
    figure.append(unit);

    var caption = document.createElement("p");
    caption.className = "plan-caption";
    caption.textContent = day.sets + "\u00d7" + day.reps + " @ " + day.pctLabel + " of " + program.formatNumber(week.tm) + " lb";

    card.append(kickerRow, figure, caption);

    var raw = program.formatNumber(day.raw);
    var rounded = program.formatNumber(day.weight);
    if (raw !== rounded) {
      var note = document.createElement("p");
      note.className = "hint";
      note.textContent = raw + " rounds to " + rounded;
      card.append(note);
    }

    var actions = document.createElement("div");
    actions.className = "day-actions";
    var add = document.createElement("button");
    add.type = "button";
    add.className = "primary";
    add.dataset.action = "add";
    add.dataset.day = day.id;
    add.textContent = "Add to current workout";
    add.setAttribute(
      "aria-label",
      "Add " + day.label + " to the current workout: " + week.lift + " " + rounded + " lb, " + day.sets + " by " + day.reps
    );
    actions.append(add);
    if (hasWorkout) {
      var replace = document.createElement("button");
      replace.type = "button";
      replace.className = "text-btn";
      replace.dataset.action = "replace";
      replace.dataset.day = day.id;
      replace.textContent = "Replace current workout";
      actions.append(replace);
    }
    card.append(actions);
    return card;
  }

  function dayById(id) {
    var days = currentWeek().days;
    for (var i = 0; i < days.length; i += 1) {
      if (days[i].id === id) return days[i];
    }
    return null;
  }

  function openComposer(day, mode) {
    var week = currentWeek();
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
    var day = dayById(button.dataset.day);
    if (!day) return;
    if (button.dataset.action === "add") {
      openComposer(day, "append");
      return;
    }
    if (button.dataset.action !== "replace") return;
    if (button.dataset.armed !== "true") {
      button.dataset.armed = "true";
      button.textContent = "Confirm replace";
      window.setTimeout(function () {
        if (!button.isConnected || button.dataset.armed !== "true") return;
        button.dataset.armed = "false";
        button.textContent = "Replace current workout";
      }, 2800);
      return;
    }
    openComposer(day, "replace");
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
    els.form = $("smolov-form");
    els.lift = $("lift");
    els.lifts = $("lifts");
    els.tm = $("tm");
    els.bump = $("bump");
    els.week = $("week");
    els.summary = $("week-summary");
    els.note = $("workout-note");
    els.days = $("days");
    fillLifts();
    var settings = loadSettings();
    els.lift.value = settings.lift;
    els.tm.value = settings.tm;
    els.bump.value = settings.weeklyBump;
    els.week.value = settings.week;
    bind();
    persistSettings();
    renderDays();
  }

  boot();
})();
