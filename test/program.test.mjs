import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const programPath = join(dirname(fileURLToPath(import.meta.url)), "../docs/program.js");
const sandbox = {};
vm.runInNewContext(readFileSync(programPath, "utf8"), sandbox, { filename: "program.js" });

const {
  addDays,
  effectiveTm,
  entrySummary,
  formatISODate,
  formatLong,
  formatMessage,
  formatWeekRange,
  freshDraft,
  mondayOf,
  nextPlanOnOrAfter,
  normalizeSettings,
  parseISODate,
  plannedLift,
  roundToStep,
  sessionIdForDate,
  weekNumber,
  weekPlan,
} = sandbox.InclineProgram;

const settings = {
  tm: 200,
  goal: 225,
  weeklyBump: 5,
  roundTo: 5,
  cycleStart: "2026-10-19",
  legsIntensity: false,
};

function draft(overrides) {
  return {
    session: "push",
    date: "2026-10-19",
    weight: "140",
    sets: "6",
    reps: "6",
    accessories: "",
    distance: "",
    minutes: "",
    seconds: "",
    feel: "",
    notes: "",
    done: "yes",
    ...overrides,
  };
}

test("mondayOf snaps Sunday and Wednesday back to Monday", () => {
  assert.equal(formatISODate(mondayOf(parseISODate("2026-10-25"))), "2026-10-19");
  assert.equal(formatISODate(mondayOf(parseISODate("2026-10-21"))), "2026-10-19");
  assert.equal(formatISODate(mondayOf(parseISODate("2026-10-19"))), "2026-10-19");
});

test("week numbers stay aligned across the March daylight-saving change", () => {
  const cycle = parseISODate("2026-03-02");
  assert.equal(formatLong(cycle), "Mon Mar 2, 2026");
  assert.equal(weekNumber(parseISODate("2026-03-02"), cycle), 1);
  assert.equal(weekNumber(parseISODate("2026-03-08"), cycle), 1);
  assert.equal(weekNumber(parseISODate("2026-03-09"), cycle), 2);
});

test("training max climbs 5 lb each week and does not go backwards before week 1", () => {
  const cycle = parseISODate(settings.cycleStart);
  assert.equal(weekNumber(parseISODate("2026-10-19"), cycle), 1);
  assert.equal(weekNumber(parseISODate("2026-10-25"), cycle), 1);
  assert.equal(weekNumber(parseISODate("2026-10-26"), cycle), 2);
  assert.equal(weekNumber(parseISODate("2026-10-18"), cycle), 0);
  assert.equal(effectiveTm(settings, 1), 200);
  assert.equal(effectiveTm(settings, 2), 205);
  assert.equal(effectiveTm(settings, 6), 225);
  assert.equal(effectiveTm(settings, 7), 230);
  assert.equal(effectiveTm(settings, 0), 200);
});

test("week 1 prescriptions match the 3-day Smolov wave", () => {
  assert.deepEqual(pick(plannedLift("push", settings, 1)), { weight: 140, sets: 6, reps: 6, pctLabel: "70%" });
  assert.deepEqual(pick(plannedLift("pull", settings, 1)), { weight: 150, sets: 7, reps: 5, pctLabel: "75%" });
  assert.deepEqual(pick(plannedLift("legs", settings, 1)), { weight: 160, sets: 8, reps: 4, pctLabel: "80%" });
});

test("percentages use the week's training max and round to the nearest 5 lb", () => {
  assert.equal(plannedLift("push", settings, 2).weight, 145);
  const week3 = plannedLift("push", settings, 3);
  assert.equal(week3.tm, 210);
  assert.equal(week3.raw, 147);
  assert.equal(week3.weight, 145);
  assert.equal(roundToStep(157.5, 5), 160);
  assert.equal(roundToStep(143.5, 2.5), 142.5);
});

test("optional intensity replaces Thursday 8x4 @ 80% with 10x3 @ 85%", () => {
  const intense = { ...settings, legsIntensity: true };
  assert.deepEqual(pick(plannedLift("legs", intense, 1)), { weight: 170, sets: 10, reps: 3, pctLabel: "85%" });
  assert.equal(plannedLift("legs", intense, 1).intensity, true);
  assert.deepEqual(pick(plannedLift("push", intense, 1)), { weight: 140, sets: 6, reps: 6, pctLabel: "70%" });
});

test("the planned week lists Monday, Tuesday, Thursday, and Saturday", () => {
  const plan = weekPlan(settings, parseISODate("2026-10-22"));
  const labels = Array.from(plan, (item) => formatISODate(item.date) + " " + item.id);
  assert.deepEqual(labels, [
    "2026-10-19 push",
    "2026-10-20 pull",
    "2026-10-22 legs",
    "2026-10-24 run",
  ]);
  assert.equal(plan[2].plan.weight, 160);
  assert.equal(plan[3].plan, null);
  assert.equal(formatWeekRange(parseISODate("2026-10-26")), "Oct 26–Nov 1");
});

test("off days point at the next planned session", () => {
  assert.equal(sessionIdForDate(parseISODate("2026-10-25")), null);
  assert.equal(sessionIdForDate(parseISODate("2026-10-19")), "push");
  const sunday = nextPlanOnOrAfter(parseISODate("2026-10-25"));
  assert.equal(formatISODate(sunday.date), "2026-10-26");
  assert.equal(sunday.session, "push");
  const wednesday = nextPlanOnOrAfter(parseISODate("2026-10-21"));
  assert.equal(wednesday.session, "legs");
  assert.equal(formatISODate(nextPlanOnOrAfter(parseISODate("2026-10-19")).date), "2026-10-19");
});

test("settings snap week 1 to Monday and ignore a bad training max", () => {
  const today = parseISODate("2026-10-25");
  const normalized = normalizeSettings({
    tm: "nope",
    goal: 225,
    weeklyBump: 0,
    roundTo: "2.5",
    cycleStart: "2026-10-21",
    legsIntensity: "true",
  }, today);
  assert.equal(normalized.tm, 200);
  assert.equal(normalized.weeklyBump, 0);
  assert.equal(normalized.roundTo, 2.5);
  assert.equal(normalized.cycleStart, "2026-10-19");
  assert.equal(normalized.legsIntensity, true);
  assert.equal(normalizeSettings({}, today).cycleStart, "2026-10-19");
});

test("a fresh Monday draft fills the planned incline and does not mark it done", () => {
  const created = freshDraft(settings, parseISODate("2026-10-19"));
  assert.equal(created.session, "push");
  assert.equal(created.weight, "140");
  assert.equal(created.sets, "6");
  assert.equal(created.reps, "6");
  assert.equal(created.done, "no");
  const run = freshDraft(settings, parseISODate("2026-10-24"));
  assert.equal(run.session, "run");
  assert.equal(run.distance, "4");
});

test("push message is plain text with planned and actual incline", () => {
  const message = formatMessage(draft({
    accessories: "  laterals, pressdowns  ",
    feel: "Solid",
    notes: "Last set was honest.",
  }), settings);
  assert.equal(message, [
    "Jackson Irby - Smolov Jr incline",
    "Session: Smolov + push",
    "Date: Mon Oct 19, 2026 (Week 1, 6pm ET)",
    "TM: 200 lb (goal 225 lb, +5 lb/week)",
    "",
    "Incline: planned 140 lb, 6x6 (70%) -> actual 140 lb, 6x6",
    "Accessories: laterals, pressdowns",
    "Felt: Solid",
    "Notes: Last set was honest.",
    "Done: yes",
  ].join("\n"));
});

test("empty accessories, feel, and notes stay out of the message", () => {
  const message = formatMessage(draft({ weight: "135", reps: "5", done: "no" }), settings);
  assert.equal(message.includes("Accessories:"), false);
  assert.equal(message.includes("Felt:"), false);
  assert.equal(message.includes("Notes:"), false);
  assert.match(message, /actual 135 lb, 6x5/);
  assert.match(message, /Done: no$/);
});

test("rounding and the optional intensity day are spelled out", () => {
  const week3 = formatMessage(draft({ date: "2026-11-02", weight: "145" }), settings);
  assert.match(week3, /Week 3/);
  assert.match(week3, /TM: 210 lb/);
  assert.match(week3, /planned 145 lb, 6x6 \(70%\)/);
  assert.match(week3, /Plan math: 70% of TM 210 is 147 lb, rounded to 145/);

  const intense = formatMessage(draft({
    session: "legs",
    date: "2026-10-22",
    weight: "170",
    sets: "10",
    reps: "3",
  }), { ...settings, legsIntensity: true });
  assert.match(intense, /planned 170 lb, 10x3 \(85%\)/);
  assert.match(intense, /optional 10x3 @ 85% instead of 8x4 @ 80%/);
  assert.equal(intense.includes("Plan math:"), false);
});

test("easy run message records distance and time and skips the incline", () => {
  const message = formatMessage(draft({
    session: "run",
    date: "2026-10-24",
    distance: "4",
    minutes: "38",
    seconds: "2",
    feel: "Easy",
  }), settings);
  assert.equal(message, [
    "Jackson Irby - Smolov Jr incline",
    "Session: Easy run",
    "Date: Sat Oct 24, 2026 (Week 1, about 12-1pm ET)",
    "TM: 200 lb (goal 225 lb, +5 lb/week)",
    "",
    "Run: 4 mi in 38:02 (easy, about 3-5 mi)",
    "Felt: Easy",
    "Done: yes",
  ].join("\n"));
  assert.equal(message.includes("Incline:"), false);
  const bare = formatMessage(draft({ session: "run", date: "2026-10-24", distance: "", done: "no" }), settings);
  assert.match(bare, /Run: not logged \(easy, about 3-5 mi\)/);
});

test("saved-session summary uses the actual work", () => {
  const summary = entrySummary(draft());
  assert.equal(summary.title, "Mon Oct 19, 2026 · Push");
  assert.equal(summary.detail, "140 lb · 6×6 · Done");
  const run = entrySummary(draft({
    session: "run",
    date: "2026-10-24",
    distance: "3.5",
    minutes: "34",
    seconds: "",
    done: "no",
  }));
  assert.equal(run.detail, "3.5 mi · 34 min · Not yet");
});

test("addDays does not mutate the original date", () => {
  const start = parseISODate("2026-10-19");
  assert.equal(formatISODate(addDays(start, 14)), "2026-11-02");
  assert.equal(formatISODate(start), "2026-10-19");
});

function pick(plan) {
  return { weight: plan.weight, sets: plan.sets, reps: plan.reps, pctLabel: plan.pctLabel };
}
