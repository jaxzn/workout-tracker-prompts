# Workout composer

A phone-first page for logging a workout and copying it into chat or Google Sheets. There is a second page for Smolov Jr bar weights. Both are static files in `docs/`. There is no account, no server, and no build. What you type stays in this browser.

## Workout

1. Open the site. The date starts as today.
2. Add an exercise from the groups (Upper, Lower, Free weights, Banded, BW, Barbell, Machine), search the list, or type a custom name. The same exercise can show in more than one group. Stack as many as you want.
3. Each exercise is a card. Fill weight and reps. **BW** marks a bodyweight set. **+ Set** copies the last row. Remove a set or the whole card from the row.
4. The preview sits at the bottom of the page and updates as you type. It is not a floating bar, so the keyboard does not cover the set you are editing. **Copy for chat** copies the note. **Copy for Sheets** copies tab-separated rows.
5. **Save workout** keeps it on this phone. **Start from saved** copies that workout’s exercises, set counts, and weights into the one you are editing. The date stays whatever you already picked.

A refresh keeps the in-progress workout. Saving is separate from that draft, so a saved workout is still there after you start another one.

A copied note looks like this:

```text
Workout — Mon Oct 26, 2026
Incline bench: 140×6, 140×6, 140×6
Dips: BW×10, BW×8
```

Sheets gets a header and one row per set. Columns are Date, Exercise, Set, Weight, Reps:

```text
Date	Exercise	Set	Weight	Reps
2026-10-26	Incline bench	1	140	6
2026-10-26	Incline bench	2	140	6
2026-10-26	Dips	1	BW	10
```

Select the cell where the paste should start. Tabs land in separate columns. Delete the header row if the sheet already has one.

## Smolov Jr

The calculator turns a training max into the week’s bar weights, rounded to the nearest 5 lb.

- Day 1 — 6×6 @ 70%
- Day 2 — 7×5 @ 75%
- Day 3 — 8×4 @ 80%
- Day 4 — 10×3 @ 85% (optional)

The weekly bump starts at +5 lb. Leave week blank for week 1. Week 2 adds the bump once, week 3 adds it twice. The lift name defaults to incline bench. Change it if the block is for something else.

**Add to current workout** opens the composer with that day’s sets already filled in, one row per set, ready to edit. If a workout is already on the phone, the day is added to it. **Replace current workout** asks you to confirm before it clears the other exercises. The calculator still works if you never log anything.

The handoff is a query string on the workout page, with the same payload in `sessionStorage` as a backup. The composer reads it once, then takes it off the address so a refresh does not add the day again.

## What stays after a refresh

Edits are stored in this browser. Nothing is uploaded.

- The open workout, including the date and every set: `workout.draft.v1`
- Workouts you saved for **Start from saved**: `workout.saved.v1`
- Calculator training max, bump, week, and lift: `smolov.settings.v1`

Clearing the site data for this page removes all three. The old incline-log keys are unused.

## Local preview

From the repo root:

```bash
npm run dev
```

That serves `docs/` at [http://localhost:8000](http://localhost:8000). The same thing without npm:

```bash
python3 -m http.server 8000 -d docs
```

Opening the HTML files directly also runs the forms. Copy-to-clipboard is more reliable on localhost or GitHub Pages. If the clipboard is blocked, select the preview and copy it by hand.

Check the prompt, the sheet rows, and the Smolov math with:

```bash
npm test
```

## GitHub Pages

The site does not need a build, so Pages can publish the `docs/` folder on `main`. There is no GitHub Actions workflow.

1. Merge this project to `main` and push it to GitHub.
2. Open the repository **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch **main** and folder **/docs**, then save.

GitHub publishes the site at `https://<user>.github.io/<repo>/`. The workout is `index.html`. The calculator is `smolov.html`. The first deploy can take a minute. Later pushes to `main` update the same URL. Paths in the pages are relative, so the site works in a project subfolder.

Nothing in the app is uploaded. The only thing that leaves the phone is the text you paste into chat or a sheet yourself.
