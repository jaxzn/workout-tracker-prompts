(function () {
  "use strict";

  // Smolov Jr incline plan for Jackson Irby.
  // Three lift days use the classic wave. Training max starts at 200 lb
  // and climbs 5 lb each week toward a 225 lb incline. Week indexes use
  // calendar dates, not elapsed milliseconds, so daylight saving cannot
  // move a Monday into the wrong week.

  var ATHLETE = "Jackson Irby";

  var FEELS = ["Easy", "Solid", "Grind", "Rough"];

  var SESSION_ORDER = ["push", "pull", "legs", "run"];

  var SESSIONS = {
    push: {
      id: "push",
      label: "Smolov + push",
      short: "Push",
      weekday: 1,
      time: "6pm ET",
      sets: 6,
      reps: 6,
      pct: 0.7,
      accessoryHint: "Press variation, laterals, triceps",
    },
    pull: {
      id: "pull",
      label: "Smolov + pull",
      short: "Pull",
      weekday: 2,
      time: "6pm ET",
      sets: 7,
      reps: 5,
      pct: 0.75,
      accessoryHint: "Rows, chins, rear delts",
    },
    legs: {
      id: "legs",
      label: "Smolov + legs",
      short: "Legs",
      weekday: 4,
      time: "6pm ET",
      sets: 8,
      reps: 4,
      pct: 0.8,
      accessoryHint: "Knee-friendly: TKE, Spanish squats, step-downs",
    },
    run: {
      id: "run",
      label: "Easy run",
      short: "Run",
      weekday: 6,
      time: "about 12-1pm ET",
      accessoryHint: "",
    },
  };

  var INTENSITY = { sets: 10, reps: 3, pct: 0.85 };

  var DEFAULT_SETTINGS = {
    tm: 200,
    goal: 225,
    weeklyBump: 5,
    roundTo: 5,
    cycleStart: "",
    legsIntensity: false,
  };

  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

  function formatLong(date) {
    return WEEKDAYS[date.getDay()] + " " + MONTHS[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
  }

  function formatWeekdayDay(date) {
    return WEEKDAYS[date.getDay()] + " " + date.getDate();
  }

  function formatWeekRange(monday) {
    var sunday = addDays(monday, 6);
    if (monday.getMonth() === sunday.getMonth()) {
      return MONTHS[monday.getMonth()] + " " + monday.getDate() + "–" + sunday.getDate();
    }
    return MONTHS[monday.getMonth()] + " " + monday.getDate() + "–" + MONTHS[sunday.getMonth()] + " " + sunday.getDate();
  }

  function formatNumber(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return String(Math.round(n * 100) / 100);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    var next = startOfDay(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function mondayOf(date) {
    var day = startOfDay(date).getDay();
    var delta = day === 0 ? -6 : 1 - day;
    return addDays(date, delta);
  }

  function daysBetween(start, end) {
    var utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    var utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((utcEnd - utcStart) / 86400000);
  }

  function weekNumber(date, cycleMonday) {
    return Math.floor(daysBetween(cycleMonday, date) / 7) + 1;
  }

  function effectiveTm(settings, week) {
    var steps = Number.isFinite(week) ? Math.max(0, week - 1) : 0;
    return settings.tm + steps * settings.weeklyBump;
  }

  function roundToStep(value, step) {
    var size = Number(step);
    if (!Number.isFinite(value) || !Number.isFinite(size) || size <= 0) return value;
    return Math.round((Math.round(value / size) * size) * 100) / 100;
  }

  function percentLabel(pct) {
    return Math.round(pct * 100) + "%";
  }

  function plannedLift(sessionId, settings, week) {
    var session = SESSIONS[sessionId];
    if (!session || sessionId === "run") {
      throw new Error("No incline plan for " + sessionId);
    }
    var intensity = sessionId === "legs" && settings.legsIntensity === true;
    var sets = intensity ? INTENSITY.sets : session.sets;
    var reps = intensity ? INTENSITY.reps : session.reps;
    var pct = intensity ? INTENSITY.pct : session.pct;
    var tm = effectiveTm(settings, week);
    var raw = tm * pct;
    return {
      weight: roundToStep(raw, settings.roundTo),
      raw: raw,
      sets: sets,
      reps: reps,
      pct: pct,
      pctLabel: percentLabel(pct),
      intensity: intensity,
      tm: tm,
    };
  }

  function planCaption(plan) {
    var bits = [
      plan.sets + "×" + plan.reps,
      plan.pctLabel + " of TM " + formatNumber(plan.tm) + " lb",
    ];
    if (plan.intensity) bits.push("optional intensity");
    var raw = formatNumber(plan.raw);
    if (Number(raw) !== Number(plan.weight)) {
      bits.push(raw + " rounds to " + formatNumber(plan.weight));
    }
    return bits.join(" · ");
  }

  function sessionIdForDate(date) {
    var day = date.getDay();
    for (var i = 0; i < SESSION_ORDER.length; i += 1) {
      var id = SESSION_ORDER[i];
      if (SESSIONS[id].weekday === day) return id;
    }
    return null;
  }

  function nextPlanOnOrAfter(date) {
    var cursor = startOfDay(date);
    for (var i = 0; i < 8; i += 1) {
      var session = sessionIdForDate(cursor);
      if (session) return { date: cursor, session: session };
      cursor = addDays(cursor, 1);
    }
    return null;
  }

  function trainingWeek(date, settings) {
    var monday = mondayOf(date);
    var cycle = parseISODate(settings.cycleStart);
    var origin = Number.isNaN(cycle.getTime()) ? monday : cycle;
    var week = weekNumber(date, origin);
    return {
      week: week,
      monday: monday,
      range: formatWeekRange(monday),
      tm: effectiveTm(settings, week),
      label: week < 1 ? "Before week 1" : "Week " + week,
    };
  }

  function weekPlan(settings, date) {
    var monday = mondayOf(date);
    return SESSION_ORDER.map(function (id) {
      var session = SESSIONS[id];
      var day = addDays(monday, session.weekday - 1);
      var week = weekNumber(day, parseISODate(settings.cycleStart));
      return {
        id: id,
        date: day,
        session: session,
        week: week,
        plan: id === "run" ? null : plannedLift(id, settings, week),
      };
    });
  }

  function formatDuration(minutes, seconds) {
    var minuteText = String(minutes == null ? "" : minutes).trim();
    var secondText = String(seconds == null ? "" : seconds).trim();
    var hasMinutes = minuteText !== "" && Number.isFinite(Number(minuteText));
    var hasSeconds = secondText !== "" && Number.isFinite(Number(secondText));
    if (!hasMinutes && !hasSeconds) return "";
    if (hasMinutes && hasSeconds) {
      return Number(minuteText) + ":" + String(Math.floor(Number(secondText))).padStart(2, "0");
    }
    if (hasMinutes) return Number(minuteText) + " min";
    return "0:" + String(Math.floor(Number(secondText))).padStart(2, "0");
  }

  function formatLoad(weight, sets, reps) {
    var weightText = String(weight == null ? "" : weight).trim();
    var hasWeight = weightText !== "" && Number.isFinite(Number(weightText));
    var setsText = String(sets == null ? "" : sets).trim() || "-";
    var repsText = String(reps == null ? "" : reps).trim() || "-";
    return (hasWeight ? formatNumber(weightText) + " lb" : "- lb") + ", " + setsText + "x" + repsText;
  }

  function formatRun(draft) {
    var distanceText = String(draft.distance == null ? "" : draft.distance).trim();
    var hasDistance = distanceText !== "" && Number.isFinite(Number(distanceText));
    var duration = formatDuration(draft.minutes, draft.seconds);
    var bits = [];
    if (hasDistance) bits.push(formatNumber(distanceText) + " mi");
    if (duration) bits.push("in " + duration);
    var body = bits.length ? bits.join(" ") : "not logged";
    return "Run: " + body + " (easy, about 3-5 mi)";
  }

  function formatMessage(draft, settings) {
    var session = SESSIONS[draft.session];
    if (!session) return "Session: unknown";
    var date = parseISODate(draft.date);
    var safeDate = Number.isNaN(date.getTime()) ? startOfDay(new Date()) : date;
    var cycle = parseISODate(settings.cycleStart);
    var origin = Number.isNaN(cycle.getTime()) ? mondayOf(safeDate) : cycle;
    var week = weekNumber(safeDate, origin);
    var tm = effectiveTm(settings, week);
    var weekLabel = week < 1 ? "before week 1" : "Week " + week;
    var lines = [
      ATHLETE + " - Smolov Jr incline",
      "Session: " + session.label,
      "Date: " + formatLong(safeDate) + " (" + weekLabel + ", " + session.time + ")",
      "TM: " + formatNumber(tm) + " lb (goal " + formatNumber(settings.goal) + " lb, +" + formatNumber(settings.weeklyBump) + " lb/week)",
      "",
    ];

    if (draft.session === "run") {
      lines.push(formatRun(draft));
    } else {
      var plan = plannedLift(draft.session, settings, week);
      lines.push(
        "Incline: planned " + formatLoad(plan.weight, plan.sets, plan.reps) +
        " (" + plan.pctLabel + ") -> actual " + formatLoad(draft.weight, draft.sets, draft.reps)
      );
      var raw = formatNumber(plan.raw);
      if (Number(raw) !== Number(plan.weight)) {
        lines.push(
          "Plan math: " + plan.pctLabel + " of TM " + formatNumber(plan.tm) +
          " is " + raw + " lb, rounded to " + formatNumber(plan.weight)
        );
      }
      if (plan.intensity) {
        lines.push("Note: optional 10x3 @ 85% instead of 8x4 @ 80%");
      }
      var accessories = String(draft.accessories == null ? "" : draft.accessories).trim();
      if (accessories) lines.push("Accessories: " + accessories);
    }

    var feel = String(draft.feel == null ? "" : draft.feel).trim();
    var notes = String(draft.notes == null ? "" : draft.notes).trim();
    if (feel) lines.push("Felt: " + feel);
    if (notes) lines.push("Notes: " + notes);
    lines.push("Done: " + (draft.done === "yes" ? "yes" : "no"));
    return lines.join("\n");
  }

  function freshDraft(settings, today) {
    var date = startOfDay(today || new Date());
    var session = sessionIdForDate(date) || "push";
    var draft = {
      session: session,
      date: formatISODate(date),
      weight: "",
      sets: "",
      reps: "",
      accessories: "",
      distance: "",
      minutes: "",
      seconds: "",
      feel: "",
      notes: "",
      done: "no",
      savedId: null,
    };
    if (session === "run") {
      draft.distance = "4";
      return draft;
    }
    var week = weekNumber(date, parseISODate(settings.cycleStart));
    var plan = plannedLift(session, settings, week);
    draft.weight = String(plan.weight);
    draft.sets = String(plan.sets);
    draft.reps = String(plan.reps);
    return draft;
  }

  function positive(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function nonNegative(value, fallback) {
    if (value === "" || value == null) return fallback;
    var n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  function normalizeSettings(raw, today) {
    var source = raw && typeof raw === "object" ? raw : {};
    var now = startOfDay(today || new Date());
    var roundTo = Number(source.roundTo);
    var allowed = [1, 2.5, 5];
    var cycleDate = parseISODate(source.cycleStart);
    if (Number.isNaN(cycleDate.getTime())) cycleDate = mondayOf(now);
    else cycleDate = mondayOf(cycleDate);
    return {
      tm: positive(source.tm, DEFAULT_SETTINGS.tm),
      goal: positive(source.goal, DEFAULT_SETTINGS.goal),
      weeklyBump: nonNegative(source.weeklyBump, DEFAULT_SETTINGS.weeklyBump),
      roundTo: allowed.indexOf(roundTo) === -1 ? DEFAULT_SETTINGS.roundTo : roundTo,
      cycleStart: formatISODate(cycleDate),
      legsIntensity: source.legsIntensity === true || source.legsIntensity === "true",
    };
  }

  function entrySummary(draft) {
    var date = parseISODate(draft.date);
    var session = SESSIONS[draft.session];
    var titleDate = Number.isNaN(date.getTime()) ? String(draft.date || "Session") : formatLong(date);
    var title = titleDate + " · " + (session ? session.short : "Session");
    var detail;
    if (draft.session === "run") {
      var bits = [];
      if (String(draft.distance == null ? "" : draft.distance).trim()) bits.push(formatNumber(draft.distance) + " mi");
      var duration = formatDuration(draft.minutes, draft.seconds);
      if (duration) bits.push(duration);
      detail = bits.join(" · ") || "Easy run";
    } else {
      detail = formatNumber(draft.weight) + " lb · " + (draft.sets || "—") + "×" + (draft.reps || "—");
    }
    return { title: title, detail: detail + " · " + (draft.done === "yes" ? "Done" : "Not yet") };
  }

  globalThis.InclineProgram = {
    ATHLETE: ATHLETE,
    FEELS: FEELS,
    SESSION_ORDER: SESSION_ORDER,
    SESSIONS: SESSIONS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    parseISODate: parseISODate,
    formatISODate: formatISODate,
    formatLong: formatLong,
    formatWeekdayDay: formatWeekdayDay,
    formatWeekRange: formatWeekRange,
    formatNumber: formatNumber,
    addDays: addDays,
    mondayOf: mondayOf,
    weekNumber: weekNumber,
    effectiveTm: effectiveTm,
    roundToStep: roundToStep,
    plannedLift: plannedLift,
    planCaption: planCaption,
    sessionIdForDate: sessionIdForDate,
    nextPlanOnOrAfter: nextPlanOnOrAfter,
    trainingWeek: trainingWeek,
    weekPlan: weekPlan,
    formatMessage: formatMessage,
    freshDraft: freshDraft,
    normalizeSettings: normalizeSettings,
    entrySummary: entrySummary,
  };
})();
