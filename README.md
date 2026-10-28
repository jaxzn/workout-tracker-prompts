# Smolov Jr calculator

A phone-first page that turns a training max into Smolov Jr bar weights and copies one day into your notes. It is a static site in `docs/`. There is no account, no server, and no build. What you type stays in this browser.

## Calculator

1. Open the site. The lift starts as incline bench, the training max as 200 lb, and the weekly bump as +5 lb. Change any of them.
2. The three weeks are an accordion. Week 1 starts open. After that, the week you opened is the one that opens next time. A closed week is a single row. Week 1 uses the training max. Each later week adds the bump once more.
3. Each week has four days:
   - Day 1 — 6×6 @ 70%
   - Day 2 — 7×5 @ 75%
   - Day 3 — 8×4 @ 80%
   - Day 4 — 10×3 @ 85% (optional)
4. Loads round to the nearest 5 lb. When the raw percentage is not already a multiple of 5, the day shows the raw value and the rounded load.
5. **Copy** beside a day puts that slot on the clipboard. The link says **Copied** for a moment. If the clipboard is blocked, that day's line is selected so you can copy it yourself.

A 200 lb training max and a +5 lb bump copies week 2, day 3 as:

```text
Week 2 Day 3: Incline bench 8×4 @ 165
```

Week 1 at that max starts at 6×6 @ 140, 7×5 @ 150, 8×4 @ 160, and 10×3 @ 170.

## What stays after a refresh

The training max, weekly bump, lift name, and open week are stored in this browser under `smolov.settings.v1`. Nothing is uploaded. The page uses `localStorage` first. If that throws or the write does not read back (Brave Shields or “block all cookies” does this), it uses `sessionStorage` with the same key, so a refresh in that tab still works. If both are blocked, a banner says so. The numbers and Copy still work for the visit. Clearing site data for this page removes the saved settings. A saved open week of `0` means every week is closed. Missing that field opens week 1.

Opening the calculator also deletes leftover workout-composer keys (`workout.draft.v1`, `workout.saved.v1`, `workout.pending.v1`) if they are still on the phone.

## Local preview

From the repo root:

```bash
npm run dev
```

That serves `docs/` at [http://localhost:8000](http://localhost:8000). The same thing without npm:

```bash
python3 -m http.server 8000 -d docs
```

Opening the HTML file directly also runs the calculator. Copy-to-clipboard is more reliable on localhost or GitHub Pages. If Copy fails, the line under that day is selected.

Check the Smolov math and the copy line with:

```bash
npm test
```

## GitHub Pages

The site does not need a build, so Pages can publish the `docs/` folder on `main`. There is no GitHub Actions workflow.

1. Merge this project to `main` and push it to GitHub.
2. Open the repository **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch **main** and folder **/docs**, then save.

GitHub publishes the site at `https://<user>.github.io/<repo>/`. `index.html` is the calculator. `smolov.html` sends that address to `index.html`, so an old link still lands on the same page. Styles and scripts use a `?v=` query so a later push is not stuck on a cached file. Paths are relative, so the site works in a project subfolder.

Nothing in the calculator is uploaded. The only thing that leaves the phone is the text you paste into your notes.
