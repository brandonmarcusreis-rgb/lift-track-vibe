# Lift App

A Homebrew terminal-themed Progressive Web App (PWA) for tracking workouts on
your iPhone. Black background, phosphor green text, full offline support, no
app store, no subscription, no ads.

```
user@iphone ~ % ./lift_app
> bench_press   chest        [- 135 +] [- 10 +]
> bent_over_row back         [- 95  +] [- 12 +]
> overhead_press shoulders   [- 65  +] [- 8  +]
...
>> WEEKLY_VOLUME             6,420 lbs
```

---

## Features

- **5-day weekly split** (Mon–Fri), customizable to any exercises
- **3 sets per exercise**, lbs/reps tracked separately for clean math
- **Touch-friendly steppers** for ±5 lbs / ±1 rep without opening the keyboard
- **`copy_last_week`** button per exercise — pre-fills sets from last week so
  you only edit what changed
- **Personal records** auto-computed across all weeks, sorted by total weight
- **Daily habit tracking** — sleep, steps, plus 4 customizable check-offs
- **Stats tab** with volume area chart, weekly trends, and apple_activity charts
- **GitHub auto-backup** — every edit commits to a private repo, full version
  history forever
- **Apple Watch sync** (optional) — daily HealthKit sleep/steps/stand data flows
  via an Apple Shortcut → Vercel endpoint → GitHub → app
- **Local export/import** as JSON for manual backups
- **Installable to iPhone home screen**, looks/acts native, works offline
- **Free forever** on Vercel's Hobby tier

---

## Tech stack

- **Frontend:** plain HTML/CSS/vanilla JS, no build step, no dependencies (Chart.js loaded from CDN)
- **Storage:** browser `localStorage` (no database)
- **PWA:** service worker for offline + installable manifest
- **Hosting:** Vercel (static + one serverless function)
- **Backups:** GitHub Contents API (commits = history)
- **Apple Watch:** Apple Shortcuts → POST to Vercel function → GitHub

---

## Quickstart

You'll need:
- A free [Vercel](https://vercel.com) account (no credit card)
- A [GitHub](https://github.com) account
- Node.js installed locally (`brew install node` on macOS)
- An iPhone running iOS 16+ (for the PWA to install with offline support)

### 1. Get the code

Download/copy this folder to your machine. Open Terminal and `cd` into it:

```bash
cd ~/Desktop/lift-app
```

### 2. Customize your routine *(optional but recommended)*

Open `app.js` in any text editor. The first ~60 lines are the **CONFIG**
section. Edit:

- **`DAYS`** — your 5-day weekly split. Each day is an array of exercises.
  Just change the names and groups to match your routine.
- **`HABITS`** — daily check-off items. Replace with whatever you want to track
  (e.g. `['vitamins', 'creatine', 'protein', 'hydration']` is the default).
- **`NUM_WEEKS`** — how many weeks of history (default 52).
- **`SETS_PER_EX`** — sets per exercise per session (default 3).

You can also do this later — the defaults will work and you can edit + redeploy
any time.

### 3. Deploy to Vercel

```bash
npx vercel
```

Follow the prompts:
- Log in (email link or GitHub)
- "Set up and deploy?" → **Y**
- Pick scope → your personal account
- Link to existing project? → **N**
- Project name → `lift-app` (or anything)
- Directory → just hit Enter
- Override settings? → **N**

After ~30 seconds you'll get a URL like `https://lift-app-abc123.vercel.app`.
Open it in Safari to verify it loads.

### 4. Install to iPhone home screen

1. Open Safari on your iPhone (must be Safari, not Chrome)
2. Navigate to your Vercel URL
3. Tap the **Share** button (square with arrow)
4. Scroll down → tap **Add to Home Screen**
5. Name it "Lift App" → tap **Add**

The icon appears on your home screen. Tap it — opens fullscreen, no Safari UI,
acts like a native app.

---

## Optional: GitHub auto-backup

By default, all your data lives in your iPhone's `localStorage`. iOS may evict
it if you don't open the app for ~7 weeks, and a wipe / new phone loses
everything. The fix: auto-commit every edit to a private GitHub repo.

### Setup (one-time, ~5 min)

**Create a private repo:**
1. Go to [github.com/new](https://github.com/new)
2. Name: `lift-app-data` (or anything)
3. Visibility: **Private**
4. Check **Add a README file**
5. Click **Create repository**

**Create a Personal Access Token:**
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
   (Tokens → **Classic**, NOT fine-grained — classic is simpler and just works)
2. **Generate new token (classic)**
3. Note: `lift-app-backup`
4. Expiration: **No expiration** (or 1 year if you prefer)
5. Scopes: check **`repo`** (full control of private repositories)
6. Generate, copy the token (starts with `ghp_...`)

**Configure in the app:**
1. Open Lift App on iPhone → tap **`sett`** tab
2. Find the `## github_backup // auto` section
3. Fill in:
   - `github_username` → your GitHub username
   - `repo_name` → `lift-app-data`
   - `personal_access_token` → paste the token
   - leave `data.json` as the path
4. Tap **`$ save_config`**
5. Tap **`$ test_connection`** — should pop up `✓ STEP 1 ... ✓ STEP 2 ... ✓ STEP 3 ...`
6. Tap **`$ backup_now`** — uploads current data immediately

From now on, every edit triggers an auto-backup 30 seconds after you stop
typing. Each save = a commit in the repo. Browse history at
`github.com/{you}/lift-app-data/commits/main`.

### Restoring from backup

If you ever need to recover (new phone, accidental wipe), install the app on
the new device, fill in the same GitHub config in `sett`, and tap
**`$ restore_from_github`**. Pulls the latest commit's `data.json` into the app.

---

## Optional: Apple Watch health sync

This is the fanciest part. With this set up, your Apple Watch's daily sleep,
steps, and stand hours flow automatically into the app every morning at 8 AM.
No manual entry.

### Architecture

```
Apple Watch → HealthKit → iOS Shortcut (8AM daily)
                              ↓
                          POST /api/health
                              ↓
                       Vercel serverless function
                              ↓
                       GitHub repo /health/YYYY-MM-DD.json
                              ↓
                          Lift App reads files
```

### Setup

**1. Set Vercel environment variables**

Go to [vercel.com/dashboard](https://vercel.com/dashboard) → your project →
**Settings** → **Environment Variables**. Add these four:

| Name             | Value                                               | Environment |
|------------------|-----------------------------------------------------|-------------|
| `GITHUB_OWNER`   | your GitHub username                                | Production  |
| `GITHUB_REPO`    | `lift-app-data`                                     | Production  |
| `GITHUB_TOKEN`   | classic PAT with `repo` scope (same as Step 4)      | Production  |
| `SHARED_SECRET`  | a random string you make up — long, unguessable     | Production  |

For the `SHARED_SECRET`, generate something random — e.g. run
`openssl rand -hex 32` in your terminal and use that. Anything long and
unguessable. You'll need this exact value in the Apple Shortcut later.

**Redeploy** to pick up the env vars:

```bash
npx vercel --prod
```

**2. Test the endpoint from your Mac terminal:**

```bash
curl -i -X POST https://YOUR-APP.vercel.app/api/health -H "Content-Type: application/json" -d '{"date":"2026-04-11","sleep_hrs":7.5,"steps":8423,"stand_hrs":11,"secret":"YOUR_SHARED_SECRET"}'
```

You should see `HTTP 200` and `{"ok":true,...}`. If you get `unauthorized`, the
secret doesn't match. If `404`, you didn't deploy. If `500`, env vars aren't set.

**3. Install the Apple Shortcut**

A pre-built Shortcut is available here:

**[Install Shortcut](https://www.icloud.com/shortcuts/30ec2613098645299149881bdb4b49bb)**

Tap that link on your iPhone, follow the prompts to install it. After
installation, **you must edit two things in the Shortcut**:

1. Tap and hold the Shortcut → **Edit**
2. Find the **Get Contents of URL** action (near the bottom)
3. Change the **URL** from the example to your own: `https://YOUR-APP.vercel.app/api/health`
4. Find the **Request Body → secret** field
5. Replace its value with your `SHARED_SECRET` from the Vercel env var

Tap **Done** to save.

**4. Test the Shortcut**

Tap the ▶ play button at the top of the Shortcut editor. iOS will ask for
HealthKit access — grant Sleep, Steps, and Stand Time. The final result should
display `{"ok":true,"date":"...","path":"health/...","updated":true}`.

If you see "this action is trying to share N health items, which is not
allowed":
- Open **Settings → Shortcuts → Advanced → Allow Sharing Large Amounts of Data → ON**

**5. Schedule the Shortcut to run daily**

1. Open the **Shortcuts** app
2. Bottom tab: **Automation**
3. Tap **+** (top right)
4. Pick **Time of Day**
5. Set time: **8:00 AM**, Repeat: **Daily**
6. Tap **Next**
7. Pick the Shortcut you just installed
8. **Toggle Run Immediately ON** (otherwise iOS sends a notification every morning)
9. Done

**6. Verify in the app**

Open Lift App → `sett` tab → scroll to `## apple_watch_health`. After the
Shortcut has run at least once, you'll see your latest day's stats and 30-day
trend charts.

---

## File structure

```
lift-app/
├── api/
│   └── health.js          # Vercel serverless function for Apple Watch sync
├── app.js                 # Main app — state, rendering, charts (CONFIG at top)
├── styles.css             # Homebrew terminal theme
├── index.html             # PWA shell
├── manifest.json          # PWA install manifest
├── sw.js                  # Service worker (offline support, network-first)
├── vercel.json            # Vercel routing config
├── icon-192.png           # PWA icon (small)
├── icon-512.png           # PWA icon (large)
└── README.md              # This file
```

---

## Customizing further

**Change the color theme:** edit the `:root` block at the top of `styles.css`.
The Homebrew palette is just CSS variables — swap them for any colors.

**Add a 6th day (e.g. Saturday):**
1. Add `saturday: [...]` to `DAYS` in `app.js`
2. Add `<button data-day="saturday">sat</button>` to the nav in `index.html`
3. Add `'saturday'` to the `dayNames` arrays in the analytics functions
4. The auto-jump-to-today logic already handles all 7 days — just make sure
   `DAYS[todayKey]` exists for the new day

**Change weight increments** on the steppers: in `app.js`, search for
`data-delta="-5"` and `data-delta="5"`. Change `5` to `2.5` for half-plates.

**Use kg instead of lbs:** rename "lbs" labels in `app.js` and `index.html`.
The math doesn't care about units — it just multiplies the two cells.

---

## Troubleshooting

**The PWA doesn't update after I deploy.**
The service worker caches files. Try in this order:
1. Pull-to-refresh in Safari at the Vercel URL
2. Kill the PWA from the app switcher and reopen
3. If still stuck, long-press the home screen icon → Remove App → reinstall via
   Safari → Add to Home Screen. The new service worker will pick up. Future
   updates auto-reload via the built-in update detection.

**GitHub backup says 404 / unauthorized.**
- Verify you're using a Classic token with full `repo` scope
- Check that the repo exists and the username/repo name match exactly (case-sensitive)
- Use `$ test_connection` — it gives you a step-by-step diagnostic

**Apple Shortcut says "invalid date — got DateStr".**
The date variable in the Shortcut's POST body is plain text instead of a magic
variable chip. Edit the Shortcut, find the Get Contents of URL action, the
`date` field — delete the letters, tap the variable picker bar above the
keyboard, and pick `DateStr` so it inserts as a colored chip.

**Vercel function returns 500.**
Check that all 4 environment variables are set in the Vercel dashboard, then
**redeploy** with `npx vercel --prod`. Env vars are baked in at deploy time.

---

## What this app deliberately does NOT do

- **No multi-device sync without setup** — that's what the GitHub backup is for
- **No social features** — this is for personal tracking
- **No exercise videos / form tutorials** — use YouTube
- **No rest timer** — could be added; not in v1
- **No body weight or measurement tracking** — could be added; not in v1
- **No 1RM estimator** — could be added; not in v1
- **No premium tier** — it's all free, all the code is yours

---

## License

Use it, fork it, modify it, share it. No attribution required, but no warranty
either. If you build something cool on top of it, I'd love to hear about it.

---

## Credits

Built as a personal project, then templated for sharing. Inspired by the
realization that most workout apps are bloated, paywall the good features, and
treat your data as a marketing asset. This one is just files on your phone and
in a repo you own.
