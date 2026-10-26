import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const programPath = join(root, "docs/program.js");
const sandbox = { URLSearchParams };
vm.runInNewContext(readFileSync(programPath, "utf8"), sandbox, { filename: "program.js" });

const {
  CATEGORIES,
  EXERCISES,
  EXERCISE_CATALOG,
  applyPending,
  exerciseMenu,
  exercisesInGroup,
  cloneExercises,
  coercePending,
  formatChat,
  formatLong,
  formatSheets,
  newSet,
  normalizeDraft,
  pendingFromQuery,
  pendingToQuery,
  createStore,
  roundToStep,
  savedRecordContains,
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

test("the exercise list matches the composer", () => {
  assert.deepEqual([...EXERCISES], [
    "Incline bench",
    "Dips",
    "Laterals",
    "TKE",
    "Spanish squat",
    "Step-downs",
    "Lat pulldown",
    "Rows",
    "Curls",
    "OHP",
    "Fly",
  ]);
});

test("exercise groups overlap where a lift fits more than one", () => {
  assert.deepEqual([...CATEGORIES], [
    "Upper",
    "Lower",
    "Free weights",
    "Banded",
    "BW",
    "Barbell",
    "Machine",
  ]);
  const incline = [...EXERCISE_CATALOG].find((item) => item.name === "Incline bench");
  assert.deepEqual([...incline.groups], ["Upper", "Barbell", "Free weights"]);
  assert.deepEqual([...exercisesInGroup("Banded")], ["TKE", "Spanish squat"]);
  assert.deepEqual([...exercisesInGroup("BW")], ["Dips", "Step-downs"]);
  assert.equal(exercisesInGroup("Machine").includes("Lat pulldown"), true);
  assert.equal(EXERCISE_CATALOG.length, EXERCISES.length);
  const all = [...exerciseMenu("All")].map((section) => ({
    label: section.label,
    names: [...section.names],
  }));
  assert.equal(all.find((section) => section.label === "Upper").names.includes("Incline bench"), true);
  assert.equal(all.find((section) => section.label === "Barbell").names.includes("Incline bench"), true);
  assert.equal(all.find((section) => section.label === "Free weights").names.includes("Incline bench"), true);
  const banded = [...exerciseMenu("Banded")].map((section) => ({
    label: section.label,
    names: [...section.names],
  }));
  assert.deepEqual(banded, [{ label: "Banded", names: ["TKE", "Spanish squat"] }]);
  assert.equal(exerciseMenu("nope")[0].label, "Upper");
});

test("chat prompt matches the workout note", () => {
  const text = formatChat({
    date: "2026-10-26",
    exercises: [
      {
        name: "Incline bench",
        sets: [
          { weight: "140", reps: "6" },
          { weight: "140", reps: "6" },
          { weight: "140", reps: "6" },
        ],
      },
      {
        name: "Dips",
        sets: [
          { weight: "BW", reps: "10" },
          { weight: "bw", reps: "8" },
        ],
      },
    ],
  });
  assert.equal(text, [
    "Workout — Mon Oct 26, 2026",
    "Incline bench: 140×6, 140×6, 140×6",
    "Dips: BW×10, BW×8",
  ].join("\n"));
  assert.equal(formatLong(sandbox.WorkoutProgram.parseISODate("2026-10-26")), "Mon Oct 26, 2026");
});

test("bodyweight aliases and blank loads stay readable", () => {
  assert.equal(sandbox.WorkoutProgram.formatLoad("bodyweight"), "BW");
  assert.equal(sandbox.WorkoutProgram.formatLoad("Body weight"), "BW");
  const text = formatChat({
    date: "2026-10-26",
    exercises: [
      { name: "  ", sets: [] },
      { name: "Rows", sets: [{ weight: "", reps: "8" }, { weight: "95.0", reps: "10" }] },
    ],
  });
  assert.equal(text, [
    "Workout — Mon Oct 26, 2026",
    "Rows: —×8, 95×10",
  ].join("\n"));
});

test("an empty workout is just the dated heading", () => {
  assert.equal(formatChat({ date: "2026-10-26", exercises: [] }), "Workout — Mon Oct 26, 2026");
});

test("sheets copy is tab-separated with a header and set numbers", () => {
  const text = formatSheets({
    date: "2026-10-26",
    exercises: [
      {
        name: "Incline bench",
        sets: [
          { weight: "140", reps: "6" },
          { weight: "140", reps: "6" },
        ],
      },
      {
        name: "Dips",
        sets: [{ weight: "bw", reps: "10" }],
      },
    ],
  });
  const lines = text.split("\n");
  assert.deepEqual(lines[0].split("\t"), ["Date", "Exercise", "Set", "Weight", "Reps"]);
  assert.deepEqual(lines[1].split("\t"), ["2026-10-26", "Incline bench", "1", "140", "6"]);
  assert.deepEqual(lines[2].split("\t"), ["2026-10-26", "Incline bench", "2", "140", "6"]);
  assert.deepEqual(lines[3].split("\t"), ["2026-10-26", "Dips", "1", "BW", "10"]);
  assert.equal(lines.length, 4);
});

test("a new set copies the last row and a first set is blank", () => {
  const copied = newSet([{ weight: "140", reps: "6" }]);
  assert.equal(copied.weight, "140");
  assert.equal(copied.reps, "6");
  const blank = newSet([]);
  assert.equal(blank.weight, "");
  assert.equal(blank.reps, "");
});

test("starting from a saved workout copies values without sharing the rows", () => {
  const original = [{ id: "a", name: "Dips", sets: [{ id: "s", weight: "BW", reps: "10" }] }];
  const copy = cloneExercises(original);
  copy[0].sets[0].weight = "20";
  copy[0].name = "Curls";
  assert.equal(original[0].sets[0].weight, "BW");
  assert.equal(original[0].name, "Dips");
  assert.equal(copy[0].sets.length, 1);
  assert.notEqual(copy[0].id, "a");
  assert.notEqual(copy[0].sets[0].id, "s");
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

  const cycle = [...smolovCycle({ tm: 200, weeklyBump: 5, lift: "Incline bench" }).weeks];
  assert.equal(cycle.length, 3);
  assert.equal(cycle[0].days[0].weight, 140);
  assert.equal(cycle[1].tm, 205);
  assert.equal(cycle[1].days[0].weight, 145);
  assert.equal(cycle[2].tm, 210);
  assert.equal(cycle[2].days[0].weight, 145);
});

test("adding a day appends, and replace is the only path that clears", () => {
  const draft = normalizeDraft({
    date: "2026-10-25",
    savedId: "keep-me",
    exercises: [{ name: "Dips", sets: [{ weight: "BW", reps: "10" }] }],
  }, new Date("2026-10-26T12:00:00"));
  assert.equal(draft.date, "2026-10-25");
  const added = applyPending(draft, {
    mode: "append",
    name: "Incline bench",
    weight: 140,
    reps: 6,
    sets: "6",
  });
  assert.equal(draft.exercises.length, 2);
  assert.equal(draft.exercises[0].name, "Dips");
  assert.equal(draft.exercises[1], added);
  assert.equal(added.sets.length, 6);
  assert.equal(added.sets[0].weight, "140");
  assert.equal(added.sets[5].reps, "6");
  assert.equal(draft.savedId, null);

  applyPending(draft, { mode: "replace", name: "Incline bench", weight: "150", reps: "5", sets: 7 });
  assert.equal(draft.exercises.length, 1);
  assert.equal(draft.exercises[0].sets.length, 7);
  assert.equal(draft.exercises[0].sets[0].weight, "150");
});

test("a bad add does nothing, and a huge set count is capped", () => {
  const draft = normalizeDraft({ date: "2026-10-26", exercises: [{ name: "Rows", sets: [] }] });
  assert.equal(applyPending(draft, { sets: 0, name: "Incline bench", weight: "140", reps: "6" }), null);
  assert.equal(draft.exercises.length, 1);
  assert.equal(coercePending({ sets: "100", name: "", weight: "140", reps: "6" }).sets, 20);
  assert.equal(coercePending({ sets: "100", name: "", weight: "140", reps: "6" }).name, "Incline bench");
  assert.equal(coercePending({ sets: "nope" }), null);
});

test("the calculator handoff survives a query string", () => {
  const query = pendingToQuery({
    mode: "replace",
    name: "Incline bench",
    weight: "140",
    reps: "6",
    sets: 6,
  });
  const pending = pendingFromQuery("?" + query);
  assert.equal(pending.mode, "replace");
  assert.equal(pending.name, "Incline bench");
  assert.equal(pending.weight, "140");
  assert.equal(pending.reps, "6");
  assert.equal(pending.sets, 6);
  assert.equal(pendingFromQuery("?date=2026-10-26"), null);
  assert.equal(pendingFromQuery(pendingToQuery({ mode: "append", name: "OHP", weight: "95", reps: "8", sets: "3" })).mode, "append");
});

const savedPayload = JSON.stringify([
  {
    id: "id-1",
    savedAt: "2026-10-26T00:00:00.000Z",
    draft: {
      date: "2026-10-26",
      exercises: [{ name: "Incline bench", sets: [{ weight: "140", reps: "6" }] }],
    },
  },
]);
const draftPayload = JSON.stringify({
  date: "2026-10-26",
  savedId: "id-1",
  exercises: [{ name: "Incline bench", sets: [{ weight: "140", reps: "6" }] }],
});

test("a save reloads from localStorage when the browser keeps it", () => {
  const local = memoryStorage();
  const session = memoryStorage();
  const store = createStore({ localStorage: local, sessionStorage: session });
  assert.equal(store.set("workout.draft.v1", draftPayload), true);
  assert.equal(store.set("workout.saved.v1", savedPayload), true);
  assert.equal(store.kind(), "local");
  const reloaded = createStore({ localStorage: local, sessionStorage: session });
  assert.equal(reloaded.get("workout.draft.v1"), draftPayload);
  assert.equal(savedRecordContains(reloaded.get("workout.saved.v1"), "id-1"), true);
  assert.equal(session.getItem("workout.saved.v1"), null);
});

test("blocked localStorage falls back to sessionStorage with the same keys", () => {
  const session = memoryStorage();
  const store = createStore({ localStorage: throwingStorage(), sessionStorage: session });
  assert.equal(store.set("workout.draft.v1", draftPayload), true);
  assert.equal(store.set("workout.saved.v1", savedPayload), true);
  assert.equal(store.kind(), "session");
  const reloaded = createStore({ localStorage: throwingStorage(), sessionStorage: session });
  assert.equal(reloaded.get("workout.draft.v1"), draftPayload);
  assert.equal(savedRecordContains(reloaded.get("workout.saved.v1"), "id-1"), true);
  assert.equal(reloaded.kind(), "session");
});

test("a local write that does not round-trip falls back to sessionStorage", () => {
  const session = memoryStorage();
  const store = createStore({ localStorage: droppedWriteStorage(), sessionStorage: session });
  assert.equal(store.set("workout.saved.v1", savedPayload), true);
  assert.equal(store.kind(), "session");
  assert.equal(savedRecordContains(session.getItem("workout.saved.v1"), "id-1"), true);
});

test("when both storages throw, save is not verified", () => {
  const store = createStore({
    localStorage: throwingStorage(),
    sessionStorage: throwingStorage(),
  });
  assert.equal(store.set("workout.saved.v1", savedPayload), false);
  assert.equal(store.get("workout.saved.v1"), null);
  assert.equal(store.kind(), "none");
  assert.equal(savedRecordContains(store.get("workout.saved.v1"), "id-1"), false);
  assert.equal(savedRecordContains("not json", "id-1"), false);
  assert.equal(savedRecordContains("{}", "id-1"), false);
});
