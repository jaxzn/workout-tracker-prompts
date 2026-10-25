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
  assert.match(index, /src="\.\/program\.js"/);
  assert.match(index, /src="\.\/app\.js"/);
  assert.match(index, /href="\.\/styles\.css"/);
  assert.equal(index.includes("Push-Pull"), false);
  assert.equal(index.includes("Smolov + push"), false);
  assert.equal(index.includes("PPL"), false);
  assert.match(css, /color-scheme:\s*dark/);
  assert.equal(existsSync(join(root, "docs/.nojekyll")), true);
});

test("the calculator links back and can add a day to the workout", () => {
  const page = read("docs/smolov.html");
  const script = read("docs/smolov.js");
  assert.match(page, /href="\.\/index\.html"/);
  assert.match(page, /src="\.\/program\.js"/);
  assert.match(page, /src="\.\/smolov\.js"/);
  assert.match(page, /id="tm"/);
  assert.match(page, /id="bump"/);
  assert.match(page, /id="week"/);
  assert.match(script, /Add to current workout/);
  assert.match(script, /Replace current workout/);
  assert.match(script, /sessionStorage/);
  assert.match(script, /pendingToQuery/);
  assert.match(script, /openComposer\(day, "append"\)/);
  assert.match(script, /openComposer\(day, "replace"\)/);
});
