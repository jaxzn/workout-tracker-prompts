# Incline log

A phone-friendly log for Jackson Irby's Smolov Jr incline sessions. Fill in the workout, copy a plain-text note, and paste it into chat with the Personal Trainer bot.

The page is static files in `docs/`. There is no account, no server, and no build. It uses a dark layout that stays readable on a phone. Sessions you save stay in that browser's local storage.

## Use it

1. Open the site.
2. Pick Push, Pull, Legs, or Easy run, or tap a day on this week's plan.
3. Check the planned incline weight. Change the weight, sets, or reps if the session differed.
4. Add accessories, how it felt, and whether it is done.
5. Copy the message and paste it into the trainer chat.
6. Save the session on this phone if you want it in the list. Copy works without saving.

Refresh the page and the form is still filled in. Saved sessions are still in the list.

A copied note looks like this:

```text
Jackson Irby - Smolov Jr incline
Session: Smolov + push
Date: Mon Oct 19, 2026 (Week 1, 6pm ET)
TM: 200 lb (goal 225 lb, +5 lb/week)

Incline: planned 140 lb, 6x6 (70%) -> actual 140 lb, 6x6
Accessories: laterals, pressdowns
Felt: Solid
Notes: Last set was honest.
Done: yes
```

## What stays after a refresh

Edits are stored in this browser's `localStorage`. A refresh reads them back. Nothing is uploaded.

- The open session is saved on each change: type, date, incline weight, sets, reps, accessories, run distance and time, how it felt, notes, and done. The key is `incline-log.draft.v1`.
- The list under **On this phone** is saved when you save, update, remove, or clear a session. The key is `incline-log.entries.v1`.
- Program settings are saved when you change them: training max, goal, weekly increase, rounding, the Monday week 1 starts, and the optional Thursday intensity. The key is `incline-log.settings.v1`.

Clearing the site data for this page removes all three.

## The program

Training max starts at 200 lb and goes up 5 lb each week, toward a 225 lb incline.

- Monday, 6pm ET — Smolov + push — 6×6 at 70%
- Tuesday, 6pm ET — Smolov + pull — 7×5 at 75%
- Thursday, 6pm ET — Smolov + legs — 8×4 at 80%
- Saturday, about 12–1pm ET — easy run, 3–5 miles

Classic Smolov Jr also has a 10×3 at 85% day. Open **Program and settings** and turn on Thursday intensity to use that prescription instead of 8×4 at 80%.

Leg accessories stay knee-friendly: terminal knee extensions, Spanish squats, and step-downs.

Working weight is that week's training max times the percentage, rounded to the nearest 5 lb. When rounding changes the bar weight, the page and the copied note both show the unrounded number. Set **Monday week 1 starts** if this block began on an earlier Monday. Today's date then lands on the right week.

## Local preview

From the repo root:

```bash
npm run dev
```

That serves `docs/` at [http://localhost:8000](http://localhost:8000). The same thing without npm:

```bash
python3 -m http.server 8000 -d docs
```

Opening `docs/index.html` directly also runs the form. Copy-to-clipboard is more reliable on localhost or GitHub Pages. If the clipboard is blocked, select the message and copy it by hand.

Check the plan math with:

```bash
npm test
```

## GitHub Pages

The site does not need a build, so Pages can publish the `docs/` folder on `main`. There is no GitHub Actions workflow.

1. Merge this project to `main` and push it to GitHub.
2. Open the repository **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch **main** and folder **/docs**, then save.

GitHub publishes the site at `https://<user>.github.io/<repo>/`. The first deploy can take a minute. Later pushes to `main` update the same URL. Paths in the page are relative, so it works as a project site in a subfolder.

Nothing in the app is uploaded. The only thing that leaves the phone is the text you paste into chat yourself.
