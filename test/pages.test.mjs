import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("the workout page is static, phone-first, and not the old split form", () => {
  const index = read("docs/index.html");
  const css = read("docs/styles.css");
  assert.match(index, /Copy for chat/);
  assert.match(index, /Copy for Sheets/);
  assert.match(index, /Start from saved/);
  assert.match(index, /id="date"/);
  assert.match(index, /href="\.\/smolov\.html"/);
  assert.match(index, /src="\.\/program\.js\?v=/);
  assert.match(index, /src="\.\/app\.js\?v=/);
  assert.match(index, /href="\.\/styles\.css\?v=/);
  assert.equal(index.includes("Push-Pull"), false);
  assert.equal(index.includes("Smolov + push"), false);
  assert.equal(index.includes("PPL"), false);
  assert.match(css, /color-scheme:\s*dark/);
  assert.equal(css.includes("position: fixed"), false);
  assert.equal(css.includes("position: sticky"), false);
  assert.match(index, /class="preview"/);
  assert.match(index, /id="exercise-group"/);
  assert.match(index, /id="exercise-pick"/);
  assert.match(index, /Choose exercise/);
  assert.match(index, /id="custom-name"/);
  assert.match(index, /id="storage-note"/);
  assert.match(index, /allow cookies or Shields/);
  assert.match(read("docs/smolov.html"), /id="storage-note"/);
  assert.equal(index.includes("category-chips"), false);
  assert.equal(index.includes("exercise-search"), false);
  assert.equal(existsSync(join(root, "docs/.nojekyll")), true);
});

test("the calculator links back and can add a day to the workout", () => {
  const page = read("docs/smolov.html");
  const script = read("docs/smolov.js");
  assert.match(page, /href="\.\/index\.html"/);
  assert.match(page, /src="\.\/program\.js\?v=/);
  assert.match(page, /src="\.\/smolov\.js\?v=/);
  assert.match(page, /href="\.\/styles\.css\?v=/);
  assert.match(script, /showBootError/);
  assert.match(script, /old script/);
  assert.match(page, /id="tm"/);
  assert.match(page, /id="bump"/);
  assert.match(page, /Three weeks/);
  assert.equal(page.includes('id="week"'), false);
  assert.match(script, /Add to current workout/);
  assert.match(script, /Replace current workout/);
  assert.match(script, /sessionStorage/);
  assert.match(script, /pendingToQuery/);
  assert.match(script, /openComposer\(slot\.week, slot\.day, "append"\)/);
  assert.match(script, /openComposer\(slot\.week, slot\.day, "replace"\)/);
  assert.match(script, /openBrowserStore/);
  assert.match(script, /smolovCycle/);
});

test("adding an exercise scrolls the weight field above the keyboard", () => {
  const app = read("docs/app.js");
  const index = read("docs/index.html");
  assert.match(index, /interactive-widget=resizes-content/);
  assert.match(app, /visualViewport/);
  assert.match(app, /scrollBy/);
  assert.match(app, /keyboardScrollDelta/);
  assert.match(app, /focusWeightField/);
  assert.match(read("docs/program.js"), /function keyboardScrollDelta/);
  assert.equal(read("docs/styles.css").includes("position: fixed"), false);
  assert.equal(read("docs/styles.css").includes("position: sticky"), false);
});

test("save syncs the form and only claims success after the saved list reads back", () => {
  const app = read("docs/app.js");
  const persistStart = app.indexOf("function persistDraft");
  const persist = app.slice(persistStart, app.indexOf("function persistSaved"));
  assert.match(persist, /syncFromDom\(\)/);
  const saveStart = app.indexOf("function saveWorkout");
  const save = app.slice(saveStart, app.indexOf("function clearWorkout"));
  assert.match(save, /syncFromDom\(\)/);
  const verifiedAt = save.indexOf("savedRecordContains");
  const successAt = save.indexOf("Saved on this phone.");
  assert.ok(verifiedAt !== -1 && successAt !== -1 && verifiedAt < successAt);
  assert.match(save, /storageBlockedMessage\(\)/);
  assert.match(app, /Couldn't save/);
});
