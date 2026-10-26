import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("the landing page is only the Smolov Jr calculator", () => {
  const index = read("docs/index.html");
  const css = read("docs/styles.css");
  const readme = read("README.md");
  assert.match(index, /<title>Smolov Jr<\/title>/);
  assert.match(index, /<h1>Smolov Jr<\/h1>/);
  assert.match(index, /id="tm"/);
  assert.match(index, /id="bump"/);
  assert.match(index, /value="200"/);
  assert.match(index, /value="5"/);
  assert.match(index, /Incline bench/);
  assert.match(index, /6×6 @ 70%/);
  assert.match(index, /7×5 @ 75%/);
  assert.match(index, /8×4 @ 80%/);
  assert.match(index, /10×3 @ 85%/);
  assert.match(index, /Three weeks/);
  assert.match(index, /id="copy-status"/);
  assert.match(index, /Week 2 Day 3: Incline bench 8×4 @ 165/);
  assert.match(index, /src="\.\/program\.js\?v=20261026e"/);
  assert.match(index, /src="\.\/smolov\.js\?v=20261026e"/);
  assert.match(index, /href="\.\/styles\.css\?v=20261026e"/);
  assert.match(index, /viewport-fit=cover/);
  assert.match(index, /id="storage-note"/);
  assert.match(index, /allow cookies or Shields/);
  assert.equal(index.includes("Workout"), false);
  assert.equal(index.includes("Copy for chat"), false);
  assert.equal(index.includes("Copy for Sheets"), false);
  assert.equal(index.includes("Start from saved"), false);
  assert.equal(index.includes("app.js"), false);
  assert.equal(index.includes('id="week"'), false);
  assert.equal(index.includes("<nav"), false);
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /\.paste-line/);
  assert.match(css, /\.copy-btn/);
  assert.equal(css.includes("position: fixed"), false);
  assert.equal(css.includes("position: sticky"), false);
  assert.equal(existsSync(join(root, "docs/.nojekyll")), true);
  assert.equal(existsSync(join(root, "docs/app.js")), false);
  assert.match(readme, /Smolov Jr calculator/);
  assert.equal(readme.includes("Workout composer"), false);
  assert.equal(readme.includes("Copy for chat"), false);
});

test("each day can copy its own sets, reps, and weight", () => {
  const script = read("docs/smolov.js");
  const program = read("docs/program.js");
  assert.match(script, /formatSmolovCopy/);
  assert.match(script, /dataset\.action = "copy"/);
  assert.match(script, /textContent = "Copy"/);
  assert.match(script, /"Copied"/);
  assert.match(script, /clipboard/);
  assert.match(script, /execCommand\("copy"\)/);
  assert.match(script, /showBootError/);
  assert.match(script, /old script/);
  assert.match(script, /openBrowserStore/);
  assert.match(script, /smolovCycle/);
  assert.match(script, /paste-line/);
  assert.match(program, /function formatSmolovCopy/);
  assert.match(program, /6, reps: 6, pct: 0\.7/);
  assert.match(program, /7, reps: 5, pct: 0\.75/);
  assert.match(program, /8, reps: 4, pct: 0\.8/);
  assert.match(program, /10, reps: 3, pct: 0\.85, optional: true/);
  assert.match(program, /roundToStep\(raw, 5\)/);
  assert.match(program, /workout\.draft\.v1/);
  assert.match(program, /RETIRED_KEYS/);
  assert.equal(script.includes("openComposer"), false);
  assert.equal(script.includes("pendingToQuery"), false);
  assert.equal(script.includes("Add to current workout"), false);
  assert.equal(script.includes("Replace current workout"), false);
  assert.equal(program.includes("formatChat"), false);
  assert.equal(program.includes("formatSheets"), false);
  assert.match(script, /RETIRED_KEYS/);
  assert.match(script, /localStorage\.removeItem/);
  assert.match(script, /sessionStorage\.removeItem/);
});

test("the old calculator address redirects to the landing page", () => {
  const page = read("docs/smolov.html");
  assert.match(page, /url=\.\/index\.html/);
  assert.match(page, /location\.replace\("\.\/index\.html"/);
  assert.match(page, /Smolov Jr calculator/);
  assert.equal(page.includes("program.js"), false);
  assert.equal(page.includes("Add to current workout"), false);
});
