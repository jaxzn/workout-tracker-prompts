(function () {
  "use strict";

  // Smolov Jr math for the static calculator page. No DOM here.
  // The page and the node tests both use this file.

  var LIFTS = [
    "Incline bench",
    "Bench press",
    "Close-grip bench",
    "Overhead press",
    "Squat",
    "Front squat",
    "Deadlift",
  ];

  var DAYS = [
    { id: "day1", label: "Day 1", sets: 6, reps: 6, pct: 0.7 },
    { id: "day2", label: "Day 2", sets: 7, reps: 5, pct: 0.75 },
    { id: "day3", label: "Day 3", sets: 8, reps: 4, pct: 0.8 },
    { id: "day4", label: "Day 4", sets: 10, reps: 3, pct: 0.85, optional: true },
  ];

  var STORAGE = {
    smolov: "smolov.settings.v1",
  };

  var SMOLOV_WEEKS = 3;

  // Left behind by the removed workout composer. Cleared on boot.
  var RETIRED_KEYS = ["workout.draft.v1", "workout.saved.v1", "workout.pending.v1"];

  function formatNumber(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return "";
    return String(Math.round(n * 100) / 100);
  }

  function roundToStep(value, step) {
    var size = Number(step);
    if (!Number.isFinite(value) || !Number.isFinite(size) || size <= 0) return value;
    var units = Math.round((value / size) * 1e8) / 1e8;
    return Math.round(Math.round(units) * size * 100) / 100;
  }

  function asText(value, max) {
    var text = value == null ? "" : String(value);
    return max ? text.slice(0, max) : text;
  }

  function normalizeTm(value) {
    if (value === "" || value == null) return 200;
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 200;
    return n;
  }

  function normalizeBump(value) {
    if (value === "" || value == null) return 5;
    var n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 5;
    return n;
  }

  function normalizeWeek(value) {
    if (value === "" || value == null) return 1;
    var n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1) return 1;
    if (n > 52) return 52;
    return n;
  }

  function smolovCycle(settings) {
    var input = settings && typeof settings === "object" ? settings : {};
    var base = normalizeTm(input.tm);
    var bump = normalizeBump(input.weeklyBump);
    var lift = asText(input.lift).trim().slice(0, 80) || "Incline bench";
    var weeks = [];
    for (var week = 1; week <= SMOLOV_WEEKS; week += 1) {
      weeks.push(smolovWeek({
        tm: base,
        weeklyBump: bump,
        week: week,
        lift: lift,
      }));
    }
    return {
      lift: lift,
      baseTm: base,
      bump: bump,
      weeks: weeks,
    };
  }

  function smolovWeek(settings) {
    var input = settings && typeof settings === "object" ? settings : {};
    var base = normalizeTm(input.tm);
    var bump = normalizeBump(input.weeklyBump);
    var week = normalizeWeek(input.week);
    var tm = base + (week - 1) * bump;
    var lift = asText(input.lift).trim().slice(0, 80) || "Incline bench";
    return {
      lift: lift,
      week: week,
      baseTm: base,
      bump: bump,
      tm: tm,
      days: DAYS.map(function (day) {
        var raw = tm * day.pct;
        return {
          id: day.id,
          label: day.label,
          sets: day.sets,
          reps: day.reps,
          pct: day.pct,
          pctLabel: Math.round(day.pct * 100) + "%",
          optional: day.optional === true,
          raw: raw,
          weight: roundToStep(raw, 5),
        };
      }),
    };
  }

  // One paste-ready line for a specific week-day slot.
  // Week 2 Day 3 at a 200 lb max and a +5 bump is "8×4 @ 165".
  function formatSmolovCopy(week, day) {
    var lift = asText(week && week.lift).trim() || "Incline bench";
    var label = asText(day && day.label).trim() || "Day";
    var weekNumber = week && week.week ? week.week : 1;
    var sets = day && day.sets;
    var reps = day && day.reps;
    var weight = formatNumber(day && day.weight);
    return "Week " + weekNumber + " " + label + ": " + lift + " " + sets + "\u00d7" + reps + " @ " + weight;
  }

  // localStorage first, then sessionStorage, same keys either way.
  // Brave Shields / block-all-cookies throws, or a write that does not
  // read back, drops to the next backend. kind() "none" means nothing
  // was stored.
  var STORAGE_PROBE = "workout.storage.probe";

  function canUseStorage(storage) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      return false;
    }
    var previous;
    try {
      previous = storage.getItem(STORAGE_PROBE);
    } catch (error) {
      return false;
    }
    try {
      storage.setItem(STORAGE_PROBE, "1");
      if (storage.getItem(STORAGE_PROBE) !== "1") return false;
    } catch (error) {
      return false;
    }
    try {
      if (previous == null) {
        if (typeof storage.removeItem === "function") storage.removeItem(STORAGE_PROBE);
      } else {
        storage.setItem(STORAGE_PROBE, previous);
      }
    } catch (error) {
      /* a leftover probe key is harmless */
    }
    return true;
  }

  function createStore(backends) {
    var local = backends && backends.localStorage;
    var session = backends && backends.sessionStorage;
    var prefer = "local";
    var probed = false;

    function detect() {
      if (probed) return;
      probed = true;
      if (canUseStorage(local)) prefer = "local";
      else if (canUseStorage(session)) prefer = "session";
      else prefer = "none";
    }

    function current() {
      detect();
      if (prefer === "local") return local;
      if (prefer === "session") return session;
      return null;
    }

    function read(storage, key) {
      try {
        return { ok: true, value: storage.getItem(key) };
      } catch (error) {
        return { ok: false, value: null };
      }
    }

    function demote() {
      if (prefer === "local" && canUseStorage(session)) {
        prefer = "session";
        probed = true;
        return true;
      }
      prefer = "none";
      probed = true;
      return false;
    }

    return {
      get: function (key) {
        var storage = current();
        if (!storage) return null;
        var result = read(storage, key);
        if (result.ok) return result.value;
        if (!demote()) return null;
        storage = current();
        if (!storage) return null;
        result = read(storage, key);
        return result.ok ? result.value : null;
      },
      set: function (key, value) {
        var storage = current();
        if (!storage) return false;
        var text = String(value);
        try {
          storage.setItem(key, text);
          if (storage.getItem(key) !== text) {
            if (!demote()) return false;
            return this.set(key, value);
          }
          return true;
        } catch (error) {
          if (!demote()) return false;
          return this.set(key, value);
        }
      },
      remove: function (key) {
        var storage = current();
        if (!storage || typeof storage.removeItem !== "function") return false;
        try {
          storage.removeItem(key);
          return true;
        } catch (error) {
          if (!demote()) return false;
          return this.remove(key);
        }
      },
      kind: function () {
        detect();
        return prefer;
      },
    };
  }

  function browserStore(kind) {
    try {
      var storage = globalThis[kind];
      if (!storage || typeof storage.getItem !== "function") return null;
      return storage;
    } catch (error) {
      return null;
    }
  }

  function openBrowserStore() {
    return createStore({
      localStorage: browserStore("localStorage"),
      sessionStorage: browserStore("sessionStorage"),
    });
  }

  globalThis.WorkoutProgram = {
    LIFTS: LIFTS,
    DAYS: DAYS,
    STORAGE: STORAGE,
    RETIRED_KEYS: RETIRED_KEYS,
    formatNumber: formatNumber,
    roundToStep: roundToStep,
    smolovWeek: smolovWeek,
    smolovCycle: smolovCycle,
    formatSmolovCopy: formatSmolovCopy,
    createStore: createStore,
    openBrowserStore: openBrowserStore,
  };
})();
