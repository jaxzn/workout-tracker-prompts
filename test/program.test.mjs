import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const programPath = join(root, "docs/program.js");
const sandbox = {};
vm.runInNewContext(readFileSync(programPath, "utf8"), sandbox, { filename: "program.js" });

const {
  DAYS,
  LIFTS,
  RETIRED_KEYS,
  STORAGE,
  createStore,
  formatNumber,
  formatSmolovCopy,
  roundToStep,
  smolovCycle,
  smolovWeek,
} = sandbox.WorkoutProgram;

function memoryStorage(initial) {
  const data = new Map(Object.entries(initial || {}));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(String(key), String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function throwingStorage() {
  return {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
}

function droppedWriteStorage() {
  return {
    getItem() {
      return null;
    },
    setItem() {},
    removeItem() {},
  };
}

test("the four Smolov Jr days keep their schemes", () => {
  assert.deepEqual([...DAYS].map((day) => ({
    id: day.id,
    label: day.label,
    sets: day.sets,
    reps: day.reps,
    pct: day.pct,
    optional: day.optional === true,
  })), [
    { id: "day1", label: "Day 1", sets: 6, reps: 6, pct: 0.7, optional: false },
    { id: "day2", label: "Day 2", sets: 7, reps: 5, pct: 0.75, optional: false },
    { id: "day3", label: "Day 3", sets: 8, reps: 4, pct: 0.8, optional: false },
    { id: "day4", label: "Day 4", sets: 10, reps: 3, pct: 0.85, optional: true },
  ]);
  assert.equal(LIFTS.includes("Incline bench"), true);
  assert.equal(STORAGE.smolov, "smolov.settings.v1");
  assert.deepEqual([...RETIRED_KEYS], [
    "workout.draft.v1",
    "workout.saved.v1",
    "workout.pending.v1",
  ]);
});

test("week 1 prescriptions round to the nearest 5 lb", () => {
  const week = smolovWeek({ tm: 200, weeklyBump: 5, week: 1, lift: "Incline bench" });
  assert.equal(week.tm, 200);
  assert.equal(week.lift, "Incline bench");
  assert.deepEqual([...week.days.map((day) => ({
    label: day.label,
    sets: day.sets,
    reps: day.reps,
    pctLabel: day.pctLabel,
    weight: day.weight,
    optional: day.optional,
  }))], [
    { label: "Day 1", sets: 6, reps: 6, pctLabel: "70%", weight: 140, optional: false },
    { label: "Day 2", sets: 7, reps: 5, pctLabel: "75%", weight: 150, optional: false },
    { label: "Day 3", sets: 8, reps: 4, pctLabel: "80%", weight: 160, optional: false },
    { label: "Day 4", sets: 10, reps: 3, pctLabel: "85%", weight: 170, optional: true },
  ]);
});

test("the weekly bump stacks and a blank week stays on the base max", () => {
  const week2 = smolovWeek({ tm: 200, weeklyBump: 5, week: 2 });
  assert.equal(week2.tm, 205);
  assert.equal(week2.days[0].weight, 145);
  assert.equal(week2.days[1].weight, 155);
  assert.equal(week2.days[2].weight, 165);

  const week3 = smolovWeek({ tm: 200, weeklyBump: 5, week: 3 });
  assert.equal(week3.tm, 210);
  assert.ok(Math.abs(week3.days[0].raw - 147) < 1e-9);
  assert.equal(week3.days[0].weight, 145);

  const blank = smolovWeek({ tm: "", weeklyBump: "", week: "" });
  assert.equal(blank.week, 1);
  assert.equal(blank.baseTm, 200);
  assert.equal(blank.bump, 5);
  assert.equal(blank.days[0].weight, 140);
  assert.equal(blank.lift, "Incline bench");

  assert.equal(smolovWeek({ tm: "nope", weeklyBump: -2, week: 0 }).days[2].weight, 160);
  assert.equal(roundToStep(157.5, 5), 160);
  assert.equal(roundToStep(142.5, 5), 145);
  assert.equal(formatNumber(160), "160");

  const cycle = [...smolovCycle({ tm: 200, weeklyBump: 5, lift: "Incline bench" }).weeks];
  assert.equal(cycle.length, 3);
  assert.equal(cycle[0].days[0].weight, 140);
  assert.equal(cycle[1].tm, 205);
  assert.equal(cycle[1].days[0].weight, 145);
  assert.equal(cycle[1].days[2].weight, 165);
  assert.equal(cycle[2].tm, 210);
  assert.equal(cycle[2].days[0].weight, 145);
});

test("a custom bump and a zero bump both apply across the three weeks", () => {
  const plusTen = smolovCycle({ tm: 185, weeklyBump: 10, lift: "Squat" });
  assert.equal(plusTen.weeks[0].tm, 185);
  assert.equal(plusTen.weeks[1].tm, 195);
  assert.equal(plusTen.weeks[2].tm, 205);
  assert.equal(plusTen.weeks[0].days[2].weight, 150);

  const flat = smolovCycle({ tm: 200, weeklyBump: 0, lift: "Bench press" });
  assert.equal(flat.weeks[2].tm, 200);
  assert.equal(flat.weeks[2].days[2].weight, 160);
  assert.equal(flat.lift, "Bench press");
});

test("copy text is that day's sets, reps, and rounded weight", () => {
  const cycle = smolovCycle({ tm: 200, weeklyBump: 5, lift: "Incline bench" });
  assert.equal(
    formatSmolovCopy(cycle.weeks[1], cycle.weeks[1].days[2]),
    "Week 2 Day 3: Incline bench 8×4 @ 165",
  );
  assert.equal(
    formatSmolovCopy(cycle.weeks[0], cycle.weeks[0].days[0]),
    "Week 1 Day 1: Incline bench 6×6 @ 140",
  );
  assert.equal(
    formatSmolovCopy(cycle.weeks[0], cycle.weeks[0].days[3]),
    "Week 1 Day 4: Incline bench 10×3 @ 170",
  );
  assert.equal(
    formatSmolovCopy(cycle.weeks[2], cycle.weeks[2].days[0]),
    "Week 3 Day 1: Incline bench 6×6 @ 145",
  );

  const named = smolovCycle({ tm: "225", weeklyBump: "5", lift: "  squat  " });
  assert.equal(named.lift, "squat");
  assert.equal(
    formatSmolovCopy(named.weeks[0], named.weeks[0].days[2]),
    "Week 1 Day 3: squat 8×4 @ 180",
  );
});

const settingsPayload = JSON.stringify({
  tm: "200",
  weeklyBump: "5",
  lift: "Incline bench",
});

test("settings reload from localStorage when the browser keeps them", () => {
  const local = memoryStorage();
  const session = memoryStorage();
  const store = createStore({ localStorage: local, sessionStorage: session });
  assert.equal(store.set("smolov.settings.v1", settingsPayload), true);
  assert.equal(store.kind(), "local");
  const reloaded = createStore({ localStorage: local, sessionStorage: session });
  assert.equal(reloaded.get("smolov.settings.v1"), settingsPayload);
  assert.equal(session.getItem("smolov.settings.v1"), null);
});

test("blocked localStorage falls back to sessionStorage with the same key", () => {
  const session = memoryStorage();
  const store = createStore({ localStorage: throwingStorage(), sessionStorage: session });
  assert.equal(store.set("smolov.settings.v1", settingsPayload), true);
  assert.equal(store.kind(), "session");
  const reloaded = createStore({ localStorage: throwingStorage(), sessionStorage: session });
  assert.equal(reloaded.get("smolov.settings.v1"), settingsPayload);
  assert.equal(reloaded.kind(), "session");
});

test("a local write that does not round-trip falls back to sessionStorage", () => {
  const session = memoryStorage();
  const store = createStore({ localStorage: droppedWriteStorage(), sessionStorage: session });
  assert.equal(store.set("smolov.settings.v1", settingsPayload), true);
  assert.equal(store.kind(), "session");
  assert.equal(session.getItem("smolov.settings.v1"), settingsPayload);
});

test("when both storages throw, the save is not verified", () => {
  const store = createStore({
    localStorage: throwingStorage(),
    sessionStorage: throwingStorage(),
  });
  assert.equal(store.set("smolov.settings.v1", settingsPayload), false);
  assert.equal(store.get("smolov.settings.v1"), null);
  assert.equal(store.kind(), "none");
});

test("retired composer keys can be removed from the store that is in use", () => {
  const local = memoryStorage({
    "workout.draft.v1": "{\"date\":\"2026-10-26\"}",
    "workout.saved.v1": "[]",
    "smolov.settings.v1": settingsPayload,
  });
  const store = createStore({ localStorage: local, sessionStorage: memoryStorage() });
  RETIRED_KEYS.forEach((key) => {
    assert.equal(store.remove(key), true);
  });
  assert.equal(local.getItem("workout.draft.v1"), null);
  assert.equal(local.getItem("workout.saved.v1"), null);
  assert.equal(store.get("smolov.settings.v1"), settingsPayload);
});
