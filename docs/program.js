(function () {
  "use strict";

  // Shared workout and Smolov Jr math for the static pages.
  // No DOM here. Both pages and the node tests use this file.

  var CATEGORIES = ["Upper", "Lower", "Free weights", "Banded", "BW", "Barbell", "Machine"];

  // An exercise can sit in more than one group. The name list stays in the
  // original order so saved notes and the calculator datalist do not shuffle.
  var EXERCISE_CATALOG = [
    { name: "Incline bench", groups: ["Upper", "Barbell", "Free weights"] },
    { name: "Dips", groups: ["Upper", "BW"] },
    { name: "Laterals", groups: ["Upper", "Free weights"] },
    { name: "TKE", groups: ["Lower", "Banded"] },
    { name: "Spanish squat", groups: ["Lower", "Banded"] },
    { name: "Step-downs", groups: ["Lower", "BW"] },
    { name: "Lat pulldown", groups: ["Upper", "Machine"] },
    { name: "Rows", groups: ["Upper", "Free weights", "Barbell", "Machine"] },
    { name: "Curls", groups: ["Upper", "Free weights", "Barbell"] },
    { name: "OHP", groups: ["Upper", "Barbell", "Free weights"] },
    { name: "Fly", groups: ["Upper", "Free weights", "Machine"] },
  ];

  var EXERCISES = EXERCISE_CATALOG.map(function (item) { return item.name; });

  var DAYS = [
    { id: "day1", label: "Day 1", sets: 6, reps: 6, pct: 0.7 },
    { id: "day2", label: "Day 2", sets: 7, reps: 5, pct: 0.75 },
    { id: "day3", label: "Day 3", sets: 8, reps: 4, pct: 0.8 },
    { id: "day4", label: "Day 4", sets: 10, reps: 3, pct: 0.85, optional: true },
  ];

  var STORAGE = {
    draft: "workout.draft.v1",
    saved: "workout.saved.v1",
    smolov: "smolov.settings.v1",
    pending: "workout.pending.v1",
  };

  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MAX_SETS = 20;
  var MAX_EXERCISES = 40;

  function uid() {
    if (globalThis.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function parseISODate(iso) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(NaN);
    var parts = iso.split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return new Date(NaN);
    }
    return date;
  }

  function formatISODate(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function todayISO(now) {
    return formatISODate(now || new Date());
  }

  function formatLong(date) {
    return WEEKDAYS[date.getDay()] + " " + MONTHS[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
  }

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

  function formatLoad(weight) {
    var text = asText(weight).trim();
    if (!text) return "\u2014";
    if (/^(bw|bodyweight|body\s+weight)$/i.test(text)) return "BW";
    if (/^[+-]?\d+(\.\d+)?$/.test(text)) return formatNumber(text);
    return text;
  }

  function formatReps(reps) {
    var text = asText(reps).trim();
    if (!text) return "\u2014";
    if (/^\d+(\.\d+)?$/.test(text)) return formatNumber(text);
    return text;
  }

  function formatSetToken(set) {
    return formatLoad(set && set.weight) + "\u00d7" + formatReps(set && set.reps);
  }

  function exerciseName(exercise) {
    var name = asText(exercise && exercise.name).trim();
    return name || "Exercise";
  }

  function formatChat(draft) {
    var date = parseISODate(draft && draft.date);
    var safe = Number.isNaN(date.getTime()) ? new Date() : date;
    var lines = ["Workout \u2014 " + formatLong(safe)];
    var exercises = draft && Array.isArray(draft.exercises) ? draft.exercises : [];
    exercises.forEach(function (exercise) {
      if (!exercise || !Array.isArray(exercise.sets) || exercise.sets.length === 0) return;
      var tokens = exercise.sets.map(formatSetToken);
      lines.push(exerciseName(exercise) + ": " + tokens.join(", "));
    });
    return lines.join("\n");
  }

  function tsvCell(value) {
    return asText(value).replace(/[\t\r\n]+/g, " ").trim();
  }

function sheetWeight(value) {
  var text = tsvCell(value);
  if (/^(bw|bodyweight|body\s+weight)$/i.test(text)) return "BW";
  return text;
}

function formatSheets(draft) {
  var rows = [["Date", "Exercise", "Set", "Weight", "Reps"]];
  var date = tsvCell(draft && draft.date);
  var exercises = draft && Array.isArray(draft.exercises) ? draft.exercises : [];
  exercises.forEach(function (exercise) {
    if (!exercise || !Array.isArray(exercise.sets)) return;
    exercise.sets.forEach(function (set, index) {
      rows.push([
        date,
        tsvCell(exerciseName(exercise)),
        String(index + 1),
        sheetWeight(set && set.weight),
        tsvCell(set && set.reps),
      ]);
    });
  });
    return rows.map(function (row) {
      return row.join("\t");
    }).join("\n");
  }

  function newSet(sets) {
    var last = sets && sets.length ? sets[sets.length - 1] : null;
    return {
      id: uid(),
      weight: last ? asText(last.weight, 16) : "",
      reps: last ? asText(last.reps, 8) : "",
    };
  }

  function createExercise(name) {
    var trimmed = asText(name).trim().slice(0, 80);
    return {
      id: uid(),
      name: trimmed || "Exercise",
      sets: [newSet([])],
    };
  }

  function cloneExercises(exercises) {
    if (!Array.isArray(exercises)) return [];
    return exercises.slice(0, MAX_EXERCISES).map(function (exercise) {
      var sets = Array.isArray(exercise && exercise.sets) ? exercise.sets : [];
      return {
        id: uid(),
        name: exerciseName(exercise).slice(0, 80),
        sets: sets.slice(0, 30).map(function (set) {
          return {
            id: uid(),
            weight: asText(set && set.weight, 16),
            reps: asText(set && set.reps, 8),
          };
        }),
      };
    });
  }

  function normalizeDraft(raw, now) {
    var source = raw && typeof raw === "object" ? raw : {};
    var date = parseISODate(source.date);
    var exercises = [];
    if (Array.isArray(source.exercises)) {
      source.exercises.slice(0, MAX_EXERCISES).forEach(function (exercise) {
        if (!exercise || (typeof exercise.name !== "string" && typeof exercise.name !== "number")) return;
        var sets = [];
        if (Array.isArray(exercise.sets)) {
          exercise.sets.slice(0, 30).forEach(function (set) {
            if (!set || typeof set !== "object") return;
            sets.push({
              id: typeof set.id === "string" && set.id ? set.id : uid(),
              weight: asText(set.weight, 16),
              reps: asText(set.reps, 8),
            });
          });
        }
        exercises.push({
          id: typeof exercise.id === "string" && exercise.id ? exercise.id : uid(),
          name: asText(exercise.name).trim().slice(0, 80) || "Exercise",
          sets: sets,
        });
      });
    }
    return {
      date: Number.isNaN(date.getTime()) ? todayISO(now) : formatISODate(date),
      savedId: typeof source.savedId === "string" && source.savedId ? source.savedId : null,
      exercises: exercises,
    };
  }

  function blankDraft(date) {
    var parsed = parseISODate(date);
    return {
      date: Number.isNaN(parsed.getTime()) ? todayISO() : formatISODate(parsed),
      savedId: null,
      exercises: [],
    };
  }

  function normalizeSaved(raw) {
    if (!Array.isArray(raw)) return [];
    var entries = [];
    raw.slice(0, 40).forEach(function (entry) {
      if (!entry || typeof entry.id !== "string" || !entry.draft) return;
      entries.push({
        id: entry.id,
        savedAt: typeof entry.savedAt === "string" ? entry.savedAt : "",
        draft: normalizeDraft(entry.draft),
      });
    });
    return entries;
  }

  function savedLabel(entry) {
    var draft = entry && entry.draft ? entry.draft : {};
    var date = parseISODate(draft.date);
    var names = [];
    if (Array.isArray(draft.exercises)) {
      draft.exercises.forEach(function (exercise) {
        if (exercise && exercise.name) names.push(String(exercise.name));
      });
    }
    var detail = names.slice(0, 3).join(", ");
    if (names.length > 3) detail += " +" + (names.length - 3);
    return {
      title: Number.isNaN(date.getTime()) ? "Saved workout" : formatLong(date),
      detail: detail || "No exercises",
    };
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

  var SMOLOV_WEEKS = 3;

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

  function coercePending(raw) {
    if (!raw || typeof raw !== "object") return null;
    var sets = Math.floor(Number(raw.sets));
    if (!Number.isFinite(sets) || sets < 1) return null;
    return {
      mode: raw.mode === "replace" ? "replace" : "append",
      name: asText(raw.name).trim().slice(0, 80) || "Incline bench",
      weight: asText(raw.weight, 16),
      reps: asText(raw.reps, 8),
      sets: Math.min(sets, MAX_SETS),
    };
  }

  function pendingToQuery(pending) {
    var clean = coercePending(pending);
    if (!clean) return "";
    var params = new URLSearchParams();
    params.set("add", "1");
    params.set("mode", clean.mode);
    params.set("name", clean.name);
    params.set("weight", clean.weight);
    params.set("reps", clean.reps);
    params.set("sets", String(clean.sets));
    return params.toString();
  }

  function pendingFromQuery(search) {
    var text = asText(search);
    if (text.charAt(0) === "?") text = text.slice(1);
    if (!text) return null;
    var params = new URLSearchParams(text);
    if (params.get("add") !== "1") return null;
    return coercePending({
      mode: params.get("mode"),
      name: params.get("name"),
      weight: params.get("weight"),
      reps: params.get("reps"),
      sets: params.get("sets"),
    });
  }

  function applyPending(draft, pending) {
    var clean = coercePending(pending);
    if (!draft || !clean) return null;
    if (!Array.isArray(draft.exercises)) draft.exercises = [];
    var sets = [];
    for (var i = 0; i < clean.sets; i += 1) {
      sets.push({ id: uid(), weight: clean.weight, reps: clean.reps });
    }
    var exercise = { id: uid(), name: clean.name, sets: sets };
    if (clean.mode === "replace") draft.exercises = [exercise];
    else draft.exercises.push(exercise);
    draft.savedId = null;
    return exercise;
  }

  function exercisesInGroup(group) {
    var names = [];
    EXERCISE_CATALOG.forEach(function (item) {
      if (item.groups.indexOf(group) !== -1) names.push(item.name);
    });
    return names;
  }

  // Sections for the exercise dropdown. "All" repeats a lift under every
  // group it belongs to. Any other value is one flat group.
  function exerciseMenu(group) {
    if (group && group !== "All" && CATEGORIES.indexOf(group) !== -1) {
      return [{ label: group, names: exercisesInGroup(group) }];
    }
    return CATEGORIES.map(function (category) {
      return { label: category, names: exercisesInGroup(category) };
    }).filter(function (section) {
      return section.names.length > 0;
    });
  }

  // localStorage first, then sessionStorage, same keys either way.
  // Brave Shields / block-all-cookies throws, or a write that does not
  // read back, drops to the next backend. kind() "none" means nothing
  // was stored. Callers must not report a successful save in that case.
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

  function savedRecordContains(raw, id) {
    if (!id || raw == null || raw === "") return false;
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return false;
    }
    if (!Array.isArray(parsed)) return false;
    for (var i = 0; i < parsed.length; i += 1) {
      if (parsed[i] && parsed[i].id === id) return true;
    }
    return false;
  }

  function snapshotDraft(draft) {
    return {
      date: draft.date,
      exercises: (draft.exercises || []).map(function (exercise) {
        return {
          name: exercise.name,
          sets: (exercise.sets || []).map(function (set) {
            return { weight: set.weight, reps: set.reps };
          }),
        };
      }),
    };
  }

  globalThis.WorkoutProgram = {
    CATEGORIES: CATEGORIES,
    EXERCISE_CATALOG: EXERCISE_CATALOG,
    EXERCISES: EXERCISES,
    exercisesInGroup: exercisesInGroup,
    exerciseMenu: exerciseMenu,
    DAYS: DAYS,
    STORAGE: STORAGE,
    MAX_SETS: MAX_SETS,
    uid: uid,
    parseISODate: parseISODate,
    formatISODate: formatISODate,
    todayISO: todayISO,
    formatLong: formatLong,
    formatNumber: formatNumber,
    roundToStep: roundToStep,
    formatLoad: formatLoad,
    formatSetToken: formatSetToken,
    formatChat: formatChat,
    formatSheets: formatSheets,
    newSet: newSet,
    createExercise: createExercise,
    cloneExercises: cloneExercises,
    normalizeDraft: normalizeDraft,
    blankDraft: blankDraft,
    normalizeSaved: normalizeSaved,
    savedLabel: savedLabel,
    smolovWeek: smolovWeek,
    smolovCycle: smolovCycle,
    coercePending: coercePending,
    pendingToQuery: pendingToQuery,
    pendingFromQuery: pendingFromQuery,
    applyPending: applyPending,
    snapshotDraft: snapshotDraft,
    createStore: createStore,
    openBrowserStore: openBrowserStore,
    savedRecordContains: savedRecordContains,
  };
})();
