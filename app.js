// === CONFIG_START === (do not remove markers — sync script uses them)
const DAYS = {
  monday: [
    { name: 'Bench Press', group: 'Chest' },
    { name: 'Bent Over Row', group: 'Back' },
    { name: 'Overhead Press', group: 'Shoulders' },
    { name: 'Barbell Curl', group: 'Biceps' },
    { name: 'Tricep Pushdown', group: 'Triceps' },
    { name: 'Back Squat', group: 'Legs' },
    { name: 'Plank', group: 'Core' },
  ],
  tuesday: [
    { name: 'Incline Dumbbell Press', group: 'Chest' },
    { name: 'Lat Pulldown', group: 'Back' },
    { name: 'Lateral Raise', group: 'Shoulders' },
    { name: 'Hammer Curl', group: 'Biceps' },
    { name: 'Skull Crushers', group: 'Triceps' },
    { name: 'Romanian Deadlift', group: 'Hamstrings' },
    { name: 'Cable Crunch', group: 'Core' },
  ],
  wednesday: [
    { name: 'Dumbbell Bench Press', group: 'Chest' },
    { name: 'Pull Up', group: 'Back' },
    { name: 'Arnold Press', group: 'Shoulders' },
    { name: 'Preacher Curl', group: 'Biceps' },
    { name: 'Overhead Tricep Extension', group: 'Triceps' },
    { name: 'Leg Press', group: 'Quads' },
    { name: 'Hanging Leg Raise', group: 'Core' },
  ],
  thursday: [
    { name: 'Cable Fly', group: 'Chest' },
    { name: 'Seated Cable Row', group: 'Back' },
    { name: 'Front Raise', group: 'Shoulders' },
    { name: 'Cable Curl', group: 'Biceps' },
    { name: 'Dips', group: 'Triceps/Chest' },
    { name: 'Leg Curl', group: 'Hamstrings' },
    { name: 'Russian Twist', group: 'Core' },
  ],
  friday: [
    { name: 'Bench Press', group: 'Chest' },
    { name: 'Bent Over Row', group: 'Back' },
    { name: 'Reverse Fly', group: 'Rear Delts' },
    { name: 'Concentration Curl', group: 'Biceps' },
    { name: 'Close-Grip Bench', group: 'Triceps' },
    { name: 'Deadlift', group: 'Posterior' },
    { name: 'Side Plank', group: 'Core' },
  ],
};

const HABITS = ['vitamins', 'creatine', 'protein', 'hydration'];
const NUM_WEEKS = 52;
const SETS_PER_EX = 3;
const STORAGE_KEY = 'lift_app_data_v1';
// === CONFIG_END ===

const WEEK_COLORS = ['#28FE14','#55FFFF','#FFFF55','#FF55FF','#FF6E6E','#6E8FFF','#EEEEEE'];

// ─── State ───
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleBackup();
}

// ─── GitHub auto-backup ───
const BACKUP_CFG_KEY = 'lift_app_backup_cfg';
const BACKUP_DEBOUNCE_MS = 30000; // 30s after last edit

function getBackupCfg() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_CFG_KEY)) || {};
  } catch {
    return {};
  }
}

function setBackupCfg(cfg) {
  localStorage.setItem(BACKUP_CFG_KEY, JSON.stringify(cfg));
}

function backupConfigured() {
  const c = getBackupCfg();
  return !!(c.owner && c.repo && c.token);
}

let backupTimer = null;
let backupInFlight = false;

function scheduleBackup(delay = BACKUP_DEBOUNCE_MS) {
  if (!backupConfigured()) return;
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    backupTimer = null;
    runBackup();
  }, delay);
  updateBackupStatus('pending');
}

async function runBackup() {
  if (backupInFlight) return;
  if (!backupConfigured()) return;
  backupInFlight = true;
  updateBackupStatus('saving');
  try {
    await backupToGithub();
    const cfg = getBackupCfg();
    cfg.last_backup = new Date().toISOString();
    cfg.last_error = null;
    setBackupCfg(cfg);
    updateBackupStatus('ok');
  } catch (e) {
    const cfg = getBackupCfg();
    cfg.last_error = String(e.message || e);
    setBackupCfg(cfg);
    updateBackupStatus('error');
  } finally {
    backupInFlight = false;
  }
}

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

async function ghContentsUrl() {
  const cfg = getBackupCfg();
  const path = cfg.path || 'data.json';
  return `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodeURIComponent(path)}`;
}

async function ghHeaders() {
  const cfg = getBackupCfg();
  return {
    'Authorization': `Bearer ${cfg.token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function fetchCurrentSha() {
  const url = await ghContentsUrl();
  const headers = { ...(await ghHeaders()), 'Cache-Control': 'no-cache' };
  // Cache-bust query to defeat any CDN caching
  const r = await fetch(url + '?_=' + Date.now(), { headers, cache: 'no-store' });
  if (r.ok) {
    const j = await r.json();
    return j.sha;
  }
  if (r.status === 404) return null;
  const txt = await r.text();
  throw new Error(`GET ${r.status}: ${txt.slice(0,150)}`);
}

async function putContents(sha) {
  const url = await ghContentsUrl();
  const headers = { ...(await ghHeaders()), 'Content-Type': 'application/json' };
  const payload = JSON.stringify({
    version: 1,
    saved_at: new Date().toISOString(),
    data: state,
  }, null, 2);
  const body = {
    message: `auto-backup ${new Date().toISOString()}`,
    content: utf8ToBase64(payload),
  };
  if (sha) body.sha = sha;
  return fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
}

async function backupToGithub() {
  // First attempt
  let sha = await fetchCurrentSha();
  let resp = await putContents(sha);

  // Retry once on 409 (sha conflict) or 422 (sha required) with fresh SHA
  if (resp.status === 409 || resp.status === 422) {
    await new Promise(r => setTimeout(r, 500));
    sha = await fetchCurrentSha();
    resp = await putContents(sha);
  }

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`PUT ${resp.status}: ${txt.slice(0, 200)}`);
  }
}

async function restoreFromGithub() {
  if (!backupConfigured()) {
    alert('GitHub not configured.');
    return;
  }
  const url = await ghContentsUrl();
  const headers = await ghHeaders();
  try {
    const r = await fetch(url, { headers });
    if (r.status === 404) {
      alert('No backup file found in repo.');
      return;
    }
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`${r.status}: ${txt.slice(0, 150)}`);
    }
    const j = await r.json();
    const decoded = base64ToUtf8(j.content.replace(/\n/g, ''));
    const parsed = JSON.parse(decoded);
    const incoming = parsed && parsed.data ? parsed.data : parsed;
    if (!incoming || typeof incoming !== 'object') throw new Error('invalid backup format');
    const ok = confirm(`Restore from GitHub? This will REPLACE all current data with the backup saved at ${parsed.saved_at || 'unknown time'}.`);
    if (!ok) return;
    state = incoming;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
    alert('Restored from GitHub.');
  } catch (e) {
    alert('Restore failed: ' + (e.message || e));
  }
}

async function testGithubConnection() {
  if (!backupConfigured()) {
    alert('Fill in owner, repo, and token first.');
    return;
  }
  const cfg = getBackupCfg();
  const headers = await ghHeaders();
  const lines = [];

  // Step 1: token auth (who am I?)
  try {
    const r = await fetch('https://api.github.com/user', { headers });
    if (r.ok) {
      const j = await r.json();
      lines.push(`✓ STEP 1 auth: token belongs to "${j.login}"`);
      if (j.login.toLowerCase() !== cfg.owner.toLowerCase()) {
        lines.push(`  ⚠ token user "${j.login}" != cfg owner "${cfg.owner}"`);
      }
    } else if (r.status === 401) {
      lines.push(`✗ STEP 1 auth: 401 — token is invalid or expired`);
      alert(lines.join('\n'));
      return;
    } else {
      const txt = await r.text();
      lines.push(`✗ STEP 1 auth: ${r.status} — ${txt.slice(0,100)}`);
      alert(lines.join('\n'));
      return;
    }
  } catch (e) {
    lines.push(`✗ STEP 1 network error: ${e.message || e}`);
    alert(lines.join('\n'));
    return;
  }

  // Step 2: repo access
  try {
    const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`, { headers });
    if (r.ok) {
      const j = await r.json();
      lines.push(`✓ STEP 2 repo: found ${j.full_name} (${j.private ? 'private' : 'public'})`);
      lines.push(`  default branch: ${j.default_branch}`);
    } else if (r.status === 404) {
      lines.push(`✗ STEP 2 repo: 404 — token cannot see "${cfg.owner}/${cfg.repo}"`);
      lines.push('');
      lines.push('FIX: regenerate token at github.com/settings/tokens?type=beta');
      lines.push('  • "Only select repositories" → pick this exact repo');
      lines.push('  • Repository permissions → Contents → Read and write');
      lines.push('  • Repository permissions → Metadata → Read-only');
      alert(lines.join('\n'));
      return;
    } else {
      const txt = await r.text();
      lines.push(`✗ STEP 2 repo: ${r.status} — ${txt.slice(0,100)}`);
      alert(lines.join('\n'));
      return;
    }
  } catch (e) {
    lines.push(`✗ STEP 2 network error: ${e.message || e}`);
    alert(lines.join('\n'));
    return;
  }

  // Step 3: contents read permission
  try {
    const url = await ghContentsUrl();
    const r = await fetch(url, { headers });
    if (r.ok) {
      lines.push(`✓ STEP 3 contents: file exists at ${cfg.path || 'data.json'}`);
    } else if (r.status === 404) {
      lines.push(`✓ STEP 3 contents: file ${cfg.path || 'data.json'} does not exist yet (will be created on first save)`);
    } else if (r.status === 403) {
      lines.push(`✗ STEP 3 contents: 403 — token lacks Contents permission. Add "Contents: Read and write".`);
    } else {
      const txt = await r.text();
      lines.push(`✗ STEP 3 contents: ${r.status} — ${txt.slice(0,100)}`);
    }
  } catch (e) {
    lines.push(`✗ STEP 3 network error: ${e.message || e}`);
  }

  alert(lines.join('\n'));
}

// ─── Health data (Apple Watch via Shortcut → GitHub) ───
const HEALTH_CACHE_KEY = 'lift_app_health_cache';

async function fetchHealthData() {
  if (!backupConfigured()) return getCachedHealth();
  const cfg = getBackupCfg();
  const headers = await ghHeaders();
  const dirUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/health`;

  try {
    const r = await fetch(dirUrl + '?_=' + Date.now(), { headers, cache: 'no-store' });
    if (r.status === 404) return {};
    if (!r.ok) throw new Error(`list ${r.status}`);
    const files = await r.json();
    if (!Array.isArray(files)) return {};

    const result = {};
    await Promise.all(
      files
        .filter(f => f.name && f.name.endsWith('.json'))
        .map(async f => {
          try {
            // Use raw download_url so we don't burn rate limits on contents API
            const fr = await fetch(f.download_url, { cache: 'no-store' });
            if (!fr.ok) return;
            const data = await fr.json();
            const date = f.name.replace('.json', '');
            result[date] = data;
          } catch {}
        })
    );

    localStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify({
      fetched_at: new Date().toISOString(),
      data: result,
    }));
    return result;
  } catch (e) {
    console.error('fetch health failed', e);
    return getCachedHealth();
  }
}

function getCachedHealth() {
  try {
    const cached = JSON.parse(localStorage.getItem(HEALTH_CACHE_KEY));
    return cached?.data || {};
  } catch {
    return {};
  }
}

function lastNDates(n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function renderHealthBlock(health) {
  const body = document.getElementById('healthBody');
  if (!body) return;
  const dates = lastNDates(30);
  const hasAny = dates.some(d => health[d]);

  if (!hasAny) {
    body.innerHTML = `
      <div class="settings-help" style="margin-top:0">
        > no data yet. set up the apple shortcut to write daily files to <span style="color:var(--cyan)">/health/YYYY-MM-DD.json</span> in your repo. instructions: see chat.
      </div>
    `;
    return;
  }

  const steps = dates.map(d => health[d]?.steps ?? null);
  const sleep = dates.map(d => health[d]?.sleep_hrs ?? null);
  const stand = dates.map(d => health[d]?.stand_hrs ?? null);
  const labels = dates.map(d => d.slice(5)); // MM-DD

  // Build summary cards (latest day with data)
  let latest = null;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (health[dates[i]]) { latest = { date: dates[i], ...health[dates[i]] }; break; }
  }

  body.innerHTML = `
    <div class="summary-grid" style="margin-bottom:14px">
      <div class="summary-card cyan">
        <div class="label">>> latest_sleep_hrs</div>
        <div class="value">${latest?.sleep_hrs != null ? Number(latest.sleep_hrs).toFixed(1) : '—'}</div>
      </div>
      <div class="summary-card yellow">
        <div class="label">>> latest_steps</div>
        <div class="value">${latest?.steps != null ? Number(latest.steps).toLocaleString() : '—'}</div>
      </div>
      <div class="summary-card">
        <div class="label">>> latest_stand_hrs</div>
        <div class="value">${latest?.stand_hrs != null ? Number(latest.stand_hrs).toFixed(0) : '—'}</div>
      </div>
      <div class="summary-card">
        <div class="label">>> latest_date</div>
        <div class="value" style="font-size:14px">${latest?.date || '—'}</div>
      </div>
    </div>
    <div class="chart-wrapper" style="height:200px"><canvas id="stepsChart"></canvas></div>
    <div class="chart-wrapper" style="height:200px;margin-top:12px"><canvas id="sleepHealthChart"></canvas></div>
    <div class="chart-wrapper" style="height:200px;margin-top:12px"><canvas id="standChart"></canvas></div>
  `;

  const baseOpts = (color) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color, font: { family: 'Menlo, monospace', size: 10 }, boxWidth: 12 },
      },
    },
    scales: {
      x: {
        ticks: { color, font: { family: 'Menlo, monospace', size: 8 }, maxRotation: 60, minRotation: 60 },
        grid: { color: '#1B7E24' },
      },
      y: {
        ticks: { color, font: { family: 'Menlo, monospace', size: 9 } },
        grid: { color: '#1B7E24' },
      },
    },
  });

  const mkLine = (color, label, data) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: color + '33',
    borderWidth: 2,
    fill: true,
    spanGaps: true,
    tension: 0.3,
    pointRadius: 2,
    pointBackgroundColor: color,
  });

  chartInstances.push(new Chart(document.getElementById('stepsChart'), {
    type: 'line',
    data: { labels, datasets: [mkLine('#FFFF55', 'steps', steps)] },
    options: baseOpts('#FFFF55'),
  }));
  chartInstances.push(new Chart(document.getElementById('sleepHealthChart'), {
    type: 'line',
    data: { labels, datasets: [mkLine('#55FFFF', 'sleep_hrs', sleep)] },
    options: baseOpts('#55FFFF'),
  }));
  chartInstances.push(new Chart(document.getElementById('standChart'), {
    type: 'line',
    data: { labels, datasets: [mkLine('#28FE14', 'stand_hrs', stand)] },
    options: baseOpts('#28FE14'),
  }));
}

function updateBackupStatus(state) {
  const el = document.getElementById('backupStatus');
  if (!el) return;
  const cfg = getBackupCfg();
  const last = cfg.last_backup ? new Date(cfg.last_backup) : null;
  const lastStr = last ? last.toLocaleString() : 'never';
  const errStr = cfg.last_error ? ` // err: ${cfg.last_error.slice(0, 60)}` : '';
  let line;
  switch (state) {
    case 'pending': line = `> backup pending in ${BACKUP_DEBOUNCE_MS/1000}s...`; break;
    case 'saving':  line = `> saving to github...`; break;
    case 'ok':      line = `> last_backup: ${lastStr}`; break;
    case 'error':   line = `> error // last_ok: ${lastStr}${errStr}`; break;
    default:        line = cfg.last_backup ? `> last_backup: ${lastStr}` : '> not yet backed up';
  }
  el.textContent = line;
  el.className = 'backup-status ' + (state || '');
}

let state = loadState();
let currentWeek = parseInt(localStorage.getItem('lift_app_week') || '1', 10);

// Auto-jump to today's weekday on first open of the day
function pickInitialDay() {
  const todayDate = new Date().toISOString().slice(0, 10);
  const lastVisit = localStorage.getItem('lift_app_last_visit');
  const savedDay = localStorage.getItem('lift_app_day');
  if (lastVisit !== todayDate) {
    const todayKey = todayWeekdayKey();
    if (DAYS[todayKey]) return todayKey;
  }
  if (savedDay && (DAYS[savedDay] || savedDay === 'analytics' || savedDay === 'settings')) {
    return savedDay;
  }
  return 'monday';
}
let currentDay = 'monday'; // overridden after DAYS + helpers defined

function exKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function ensure(week, day, exName) {
  state[week] ??= {};
  state[week][day] ??= { exercises: {}, sleep: '', habits: {} };
  state[week][day].exercises ??= {};
  state[week][day].sleep ??= '';
  state[week][day].habits ??= {};
  if (exName) {
    state[week][day].exercises[exName] ??= { sets: Array.from({length: SETS_PER_EX}, () => ({lbs: '', reps: ''})) };
  }
}

function getSet(week, day, exName, idx) {
  ensure(week, day, exName);
  return state[week][day].exercises[exName].sets[idx];
}

function setSetField(week, day, exName, idx, field, value) {
  ensure(week, day, exName);
  state[week][day].exercises[exName].sets[idx][field] = value;
  saveState();
}

function getSleep(week, day) {
  ensure(week, day);
  return state[week][day].sleep || '';
}

function setSleep(week, day, value) {
  ensure(week, day);
  state[week][day].sleep = value;
  saveState();
}

function getSteps(week, day) {
  ensure(week, day);
  return state[week][day].steps || '';
}

function setSteps(week, day, value) {
  ensure(week, day);
  state[week][day].steps = value;
  saveState();
}

function getHabit(week, day, habit) {
  ensure(week, day);
  return !!state[week][day].habits[habit];
}

function toggleHabit(week, day, habit) {
  ensure(week, day);
  state[week][day].habits[habit] = !state[week][day].habits[habit];
  saveState();
  return state[week][day].habits[habit];
}

function calcDayVolume(week, day) {
  const exercises = DAYS[day] || [];
  let total = 0;
  for (const ex of exercises) {
    const exData = state?.[week]?.[day]?.exercises?.[ex.name];
    if (!exData) continue;
    for (const s of exData.sets) {
      const lbs = parseFloat(s.lbs) || 0;
      const reps = parseFloat(s.reps) || 0;
      total += lbs * reps;
    }
  }
  return total;
}

function calcWeekTotalVolume(week) {
  return Object.keys(DAYS).reduce((sum, d) => sum + calcDayVolume(week, d), 0);
}

function calcWeekAvgSleep(week) {
  const days = Object.keys(DAYS);
  const vals = days.map(d => parseFloat(getSleep(week, d))).filter(v => !isNaN(v) && v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((a,b) => a+b, 0) / vals.length;
}

function calcWeekTotalSteps(week) {
  const days = Object.keys(DAYS);
  const vals = days.map(d => parseFloat(getSteps(week, d))).filter(v => !isNaN(v) && v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((a,b) => a+b, 0);
}

function calcWeekAvgSteps(week) {
  const days = Object.keys(DAYS);
  const vals = days.map(d => parseFloat(getSteps(week, d))).filter(v => !isNaN(v) && v > 0);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a,b) => a+b, 0) / vals.length);
}

// ─── Helpers: today + PRs + copy-from-prev ───
function todayWeekdayKey() {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return days[new Date().getDay()];
}

function copyPrevWeekSets(day, exName) {
  if (currentWeek <= 1) {
    alert('no previous week to copy from');
    return;
  }
  const prev = currentWeek - 1;
  const prevSets = state?.[prev]?.[day]?.exercises?.[exName]?.sets;
  if (!prevSets || prevSets.every(s => !s.lbs && !s.reps)) {
    alert(`no data in week ${prev} for ${exName}`);
    return;
  }
  ensure(currentWeek, day, exName);
  state[currentWeek][day].exercises[exName].sets = prevSets.map(s => ({
    lbs: s.lbs || '',
    reps: s.reps || '',
  }));
  saveState();
  renderDay(day);
}

function computePRs() {
  const prs = {};
  Object.keys(DAYS).forEach(day => {
    DAYS[day].forEach(ex => {
      for (let w = 1; w <= NUM_WEEKS; w++) {
        const sets = state?.[w]?.[day]?.exercises?.[ex.name]?.sets;
        if (!sets) continue;
        for (const s of sets) {
          const lbs = parseFloat(s.lbs) || 0;
          const reps = parseFloat(s.reps) || 0;
          if (lbs <= 0 || reps <= 0) continue;
          const cur = prs[ex.name];
          // Best = highest lbs, tiebreak by reps
          if (!cur || lbs > cur.lbs || (lbs === cur.lbs && reps > cur.reps)) {
            prs[ex.name] = { lbs, reps, week: w, day };
          }
        }
      }
    });
  });
  return prs;
}

// ─── Render ───
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

function fmtNum(n) {
  return n.toLocaleString();
}

function renderDay(day) {
  const exercises = DAYS[day] || [];
  const main = document.getElementById('content');
  main.innerHTML = '';
  const prevWeek = currentWeek - 1;

  exercises.forEach(ex => {
    const card = el(`
      <div class="exercise">
        <div class="exercise-header">
          <div class="exercise-header-row">
            <div>
              <div class="exercise-name">> ${exKey(ex.name)}</div>
              <div class="exercise-group">${ex.group.toLowerCase()}</div>
            </div>
            <button class="btn-copy-prev" ${prevWeek < 1 ? 'disabled' : ''}>$ copy_w${String(Math.max(prevWeek,1)).padStart(2,'0')}</button>
          </div>
        </div>
        <div class="sets"></div>
      </div>
    `);
    const copyBtn = card.querySelector('.btn-copy-prev');
    if (copyBtn && !copyBtn.disabled) {
      copyBtn.addEventListener('click', () => copyPrevWeekSets(day, ex.name));
    }
    const setsDiv = card.querySelector('.sets');
    for (let s = 0; s < SETS_PER_EX; s++) {
      const set = getSet(currentWeek, day, ex.name, s);
      const setEl = el(`
        <div class="set">
          <div class="set-label">~set_${s+1}</div>
          <div class="input-group">
            <button class="stepper" data-delta="-5" data-target="lbs">−</button>
            <input type="number" inputmode="decimal" placeholder="lbs" value="${set.lbs ?? ''}" data-field="lbs">
            <button class="stepper" data-delta="5" data-target="lbs">+</button>
          </div>
          <div class="input-group">
            <button class="stepper" data-delta="-1" data-target="reps">−</button>
            <input type="number" inputmode="decimal" placeholder="reps" value="${set.reps ?? ''}" data-field="reps">
            <button class="stepper" data-delta="1" data-target="reps">+</button>
          </div>
        </div>
      `);
      const lbsIn = setEl.querySelector('input[data-field="lbs"]');
      const repsIn = setEl.querySelector('input[data-field="reps"]');
      lbsIn.addEventListener('input', e => {
        setSetField(currentWeek, day, ex.name, s, 'lbs', e.target.value);
        updateVolumeRow(day);
      });
      repsIn.addEventListener('input', e => {
        setSetField(currentWeek, day, ex.name, s, 'reps', e.target.value);
        updateVolumeRow(day);
      });
      setEl.querySelectorAll('.stepper').forEach(btn => {
        btn.addEventListener('click', () => {
          const delta = parseFloat(btn.dataset.delta);
          const target = btn.dataset.target;
          const input = setEl.querySelector(`input[data-field="${target}"]`);
          const cur = parseFloat(input.value) || 0;
          const next = Math.max(0, cur + delta);
          input.value = next;
          setSetField(currentWeek, day, ex.name, s, target, String(next));
          updateVolumeRow(day);
        });
      });
      setsDiv.appendChild(setEl);
    }
    main.appendChild(card);
  });

  // Habits + sleep + steps block
  const habitsBlock = el(`
    <div class="habits">
      <h2>## daily_tracking</h2>
      <div class="habit-row">
        <label>$ sleep_hrs</label>
        <input type="number" step="0.5" inputmode="decimal" placeholder="0.0" value="${getSleep(currentWeek, day)}" data-field="sleep">
      </div>
      <div class="habit-row">
        <label>$ steps</label>
        <input type="number" inputmode="numeric" placeholder="0" value="${getSteps(currentWeek, day)}" data-field="steps">
      </div>
    </div>
  `);
  habitsBlock.querySelector('input[data-field="sleep"]').addEventListener('input', e => {
    setSleep(currentWeek, day, e.target.value);
  });
  habitsBlock.querySelector('input[data-field="steps"]').addEventListener('input', e => {
    setSteps(currentWeek, day, e.target.value);
  });

  HABITS.forEach(h => {
    const checked = getHabit(currentWeek, day, h);
    const row = el(`
      <div class="habit-row">
        <label># ${h}</label>
        <button class="habit-toggle ${checked ? 'checked' : ''}">${checked ? '✓' : ''}</button>
      </div>
    `);
    row.querySelector('button').addEventListener('click', e => {
      const nowChecked = toggleHabit(currentWeek, day, h);
      e.target.classList.toggle('checked', nowChecked);
      e.target.textContent = nowChecked ? '✓' : '';
    });
    habitsBlock.appendChild(row);
  });
  main.appendChild(habitsBlock);

  // Volume row
  const volRow = el(`
    <div class="volume-row" id="volRow">
      <span class="label">>> WEEKLY_VOLUME</span>
      <span class="value">${fmtNum(calcDayVolume(currentWeek, day))} lbs</span>
    </div>
  `);
  main.appendChild(volRow);
}

function updateVolumeRow(day) {
  const v = calcDayVolume(currentWeek, day);
  const el = document.querySelector('#volRow .value');
  if (el) el.textContent = `${fmtNum(v)} lbs`;
}

let chartInstances = [];
function destroyCharts() {
  chartInstances.forEach(c => c.destroy());
  chartInstances = [];
}

function renderAnalytics() {
  const main = document.getElementById('content');
  main.innerHTML = '';
  destroyCharts();

  const dayNames = Object.keys(DAYS);

  // Summary cards: this week's totals
  const thisWeekVol = calcWeekTotalVolume(currentWeek);
  const thisWeekSleep = calcWeekAvgSleep(currentWeek);
  const thisWeekSteps = calcWeekTotalSteps(currentWeek);
  const summary = el(`
    <div class="summary-grid">
      <div class="summary-card yellow">
        <div class="label">>> WK${String(currentWeek).padStart(2,'0')}_VOLUME</div>
        <div class="value">${fmtNum(thisWeekVol)}</div>
      </div>
      <div class="summary-card cyan">
        <div class="label">>> WK${String(currentWeek).padStart(2,'0')}_SLEEP_AVG</div>
        <div class="value">${thisWeekSleep != null ? thisWeekSleep.toFixed(1) : '—'}</div>
      </div>
      <div class="summary-card">
        <div class="label">>> WK${String(currentWeek).padStart(2,'0')}_STEPS_TOTAL</div>
        <div class="value">${thisWeekSteps != null ? fmtNum(thisWeekSteps) : '—'}</div>
      </div>
    </div>
  `);
  main.appendChild(summary);

  // Volume area chart: x = days, series = weeks (most recent 12)
  const startWeek = Math.max(1, currentWeek - 11);
  const weekRange = Array.from({length: Math.min(12, currentWeek)}, (_, i) => startWeek + i);

  const volContainer = el(`
    <div class="chart-container">
      <div class="section-title">## volume_by_day [last_12_weeks]</div>
      <div class="chart-wrapper"><canvas id="volChart"></canvas></div>
    </div>
  `);
  main.appendChild(volContainer);

  const volDatasets = weekRange.map((w, i) => {
    const color = WEEK_COLORS[i % WEEK_COLORS.length];
    return {
      label: `w${String(w).padStart(2,'0')}`,
      data: dayNames.map(d => calcDayVolume(w, d)),
      backgroundColor: color + '33',
      borderColor: color,
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: color,
    };
  });

  chartInstances.push(new Chart(document.getElementById('volChart'), {
    type: 'line',
    data: {
      labels: dayNames.map(d => d.slice(0,3)),
      datasets: volDatasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#28FE14',
            font: { family: 'Menlo, monospace', size: 10 },
            boxWidth: 12,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#28FE14', font: { family: 'Menlo, monospace', size: 11 } },
          grid: { color: '#1B7E24' },
        },
        y: {
          ticks: { color: '#28FE14', font: { family: 'Menlo, monospace', size: 10 } },
          grid: { color: '#1B7E24' },
        },
      },
    },
  }));

  // ── Apple activity: sleep + steps trend ──
  const allWeeks = Array.from({length: NUM_WEEKS}, (_, i) => i + 1);
  const sleepData = allWeeks.map(w => calcWeekAvgSleep(w));
  const stepsData = allWeeks.map(w => calcWeekTotalSteps(w));
  const sleepLabels = allWeeks.map(w => `w${String(w).padStart(2,'0')}`);

  const activityContainer = el(`
    <div class="chart-container">
      <div class="section-title cyan">## apple_activity [manual_entries]</div>
      <div class="chart-wrapper" style="height:200px"><canvas id="sleepChart"></canvas></div>
      <div class="chart-wrapper" style="height:200px;margin-top:12px"><canvas id="stepsTrendChart"></canvas></div>
    </div>
  `);
  main.appendChild(activityContainer);

  const activityOpts = (color, ySuggestedMax) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color, font: { family: 'Menlo, monospace', size: 10 }, boxWidth: 12 },
      },
    },
    scales: {
      x: {
        ticks: { color, font: { family: 'Menlo, monospace', size: 9 }, maxRotation: 60, minRotation: 60 },
        grid: { color: '#1B7E24' },
      },
      y: {
        ticks: { color, font: { family: 'Menlo, monospace', size: 10 } },
        grid: { color: '#1B7E24' },
        suggestedMin: 0,
        ...(ySuggestedMax ? { suggestedMax: ySuggestedMax } : {}),
      },
    },
  });

  chartInstances.push(new Chart(document.getElementById('sleepChart'), {
    type: 'line',
    data: {
      labels: sleepLabels,
      datasets: [{
        label: 'sleep_avg [hrs]',
        data: sleepData,
        borderColor: '#55FFFF',
        backgroundColor: '#55FFFF33',
        borderWidth: 2,
        fill: true,
        spanGaps: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#55FFFF',
      }],
    },
    options: activityOpts('#55FFFF', 10),
  }));

  chartInstances.push(new Chart(document.getElementById('stepsTrendChart'), {
    type: 'line',
    data: {
      labels: sleepLabels,
      datasets: [{
        label: 'steps_total [per_week]',
        data: stepsData,
        borderColor: '#FFFF55',
        backgroundColor: '#FFFF5533',
        borderWidth: 2,
        fill: true,
        spanGaps: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#FFFF55',
      }],
    },
    options: activityOpts('#FFFF55'),
  }));

  // Volume trend chart: total weekly volume across all weeks
  const volTrendData = allWeeks.map(w => calcWeekTotalVolume(w));
  const volTrendContainer = el(`
    <div class="chart-container">
      <div class="section-title">## weekly_volume_trend</div>
      <div class="chart-wrapper"><canvas id="volTrendChart"></canvas></div>
    </div>
  `);
  main.appendChild(volTrendContainer);

  chartInstances.push(new Chart(document.getElementById('volTrendChart'), {
    type: 'line',
    data: {
      labels: sleepLabels,
      datasets: [{
        label: 'total_lbs',
        data: volTrendData,
        borderColor: '#FFFF55',
        backgroundColor: '#FFFF5533',
        borderWidth: 2,
        fill: true,
        spanGaps: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#FFFF55',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#FFFF55',
            font: { family: 'Menlo, monospace', size: 10 },
            boxWidth: 12,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#FFFF55', font: { family: 'Menlo, monospace', size: 9 }, maxRotation: 60, minRotation: 60 },
          grid: { color: '#1B7E24' },
        },
        y: {
          ticks: { color: '#FFFF55', font: { family: 'Menlo, monospace', size: 10 } },
          grid: { color: '#1B7E24' },
        },
      },
    },
  }));

  // ── Personal records ──
  const prs = computePRs();
  const prEntries = Object.entries(prs).sort((a, b) => (b[1].lbs * b[1].reps) - (a[1].lbs * a[1].reps));
  const prRowsHtml = prEntries.length === 0
    ? `<tr><td colspan="3" class="pr-empty">> no PRs yet — log some sets to start tracking</td></tr>`
    : prEntries.map(([name, pr]) => `
        <tr>
          <td class="pr-name">${exKey(name)}</td>
          <td class="pr-value">${pr.lbs} × ${pr.reps}</td>
          <td class="pr-meta">w${String(pr.week).padStart(2,'0')} ${pr.day.slice(0,3)}</td>
        </tr>
      `).join('');

  const prContainer = el(`
    <div class="chart-container">
      <div class="section-title">## personal_records</div>
      <table class="pr-table">
        <thead><tr><th>exercise</th><th>best_set</th><th>when</th></tr></thead>
        <tbody>${prRowsHtml}</tbody>
      </table>
    </div>
  `);
  main.appendChild(prContainer);
}

function renderSettings() {
  const main = document.getElementById('content');
  main.innerHTML = '';
  destroyCharts();

  // ── Apple Watch health (display + connector status) ──
  const healthBlock = el(`
    <div class="chart-container">
      <div class="section-title cyan">## apple_watch_health [last_30d]</div>
      <div class="settings-help" style="margin-bottom:12px">
        fed by an apple shortcut that writes daily files to /health/ in your github repo. set up the shortcut on your iphone (see chat for recipe).
      </div>
      <div id="healthBody">> loading from github...</div>
    </div>
  `);
  main.appendChild(healthBlock);

  fetchHealthData().then(health => {
    renderHealthBlock(health);
  });

  // ── GitHub auto-backup ──
  const cfg = getBackupCfg();
  const ghBlock = el(`
    <div class="settings">
      <div class="section-title">## github_backup // auto</div>
      <div class="settings-help" style="margin-bottom:12px">
        commits to a private repo on every change (debounced 30s). every save = one commit, full history forever.
      </div>
      <div class="settings-form">
        <input type="text" id="ghOwner" placeholder="github_username" value="${cfg.owner || ''}" autocapitalize="off" autocorrect="off" spellcheck="false">
        <input type="text" id="ghRepo" placeholder="repo_name" value="${cfg.repo || ''}" autocapitalize="off" autocorrect="off" spellcheck="false">
        <input type="password" id="ghToken" placeholder="personal_access_token (ghp_...)" value="${cfg.token || ''}" autocapitalize="off" autocorrect="off" spellcheck="false">
        <input type="text" id="ghPath" placeholder="data.json (path in repo)" value="${cfg.path || 'data.json'}" autocapitalize="off" autocorrect="off" spellcheck="false">
      </div>
      <div class="settings-buttons" style="margin-top:12px">
        <button class="btn btn-save-cfg">$ save_config</button>
        <button class="btn btn-test">$ test_connection</button>
        <button class="btn btn-backup-now">$ backup_now</button>
        <button class="btn btn-restore">$ restore_from_github</button>
      </div>
      <div class="backup-status" id="backupStatus"></div>
    </div>
  `);

  ghBlock.querySelector('.btn-save-cfg').addEventListener('click', () => {
    const newCfg = {
      ...getBackupCfg(),
      owner: document.getElementById('ghOwner').value.trim(),
      repo: document.getElementById('ghRepo').value.trim(),
      token: document.getElementById('ghToken').value.trim(),
      path: document.getElementById('ghPath').value.trim() || 'data.json',
    };
    setBackupCfg(newCfg);
    alert('Config saved. Auto-backup is ' + (backupConfigured() ? 'ENABLED' : 'disabled (missing fields)') + '.');
    updateBackupStatus();
  });
  ghBlock.querySelector('.btn-test').addEventListener('click', testGithubConnection);
  ghBlock.querySelector('.btn-backup-now').addEventListener('click', async () => {
    if (!backupConfigured()) { alert('Fill in config and save first.'); return; }
    if (backupTimer) { clearTimeout(backupTimer); backupTimer = null; }
    await runBackup();
    const cfg = getBackupCfg();
    if (cfg.last_error) alert('Backup failed: ' + cfg.last_error);
    else alert('Backed up.');
  });
  ghBlock.querySelector('.btn-restore').addEventListener('click', restoreFromGithub);
  main.appendChild(ghBlock);
  setTimeout(updateBackupStatus, 0);

  // ── Local backup / restore / wipe ──
  const localBlock = el(`
    <div class="settings">
      <div class="section-title">## local_backup // manual</div>
      <div class="settings-buttons">
        <button class="btn btn-export">$ export_json</button>
        <button class="btn btn-import">$ import_json</button>
        <button class="btn btn-danger">$ wipe_all</button>
      </div>
      <div class="settings-help">
        export creates a json file. share via airdrop, files, email — anywhere.<br>
        import restores from a previous backup file.
      </div>
    </div>
  `);
  localBlock.querySelector('.btn-export').addEventListener('click', exportData);
  localBlock.querySelector('.btn-import').addEventListener('click', importData);
  localBlock.querySelector('.btn-danger').addEventListener('click', clearAllData);
  main.appendChild(localBlock);
}

// ─── Export / Import ───
async function exportData() {
  const payload = {
    version: 1,
    exported_at: new Date().toISOString(),
    data: state,
  };
  const json = JSON.stringify(payload, null, 2);
  const filename = `lift_app_backup_${new Date().toISOString().slice(0,10)}.json`;

  // Try Web Share API first (iOS native share sheet)
  try {
    if (navigator.canShare && navigator.share) {
      const file = new File([json], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Lift App Backup' });
        return;
      }
    }
  } catch (e) {
    // user cancelled or share failed → fall through
    if (e.name === 'AbortError') return;
  }

  // Fallback: download link
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) {
      document.body.removeChild(input);
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const incoming = parsed && typeof parsed === 'object' && parsed.data ? parsed.data : parsed;
        if (!incoming || typeof incoming !== 'object') throw new Error('invalid file format');
        const ok = confirm('Replace ALL current data with the imported file? This cannot be undone.');
        if (!ok) {
          document.body.removeChild(input);
          return;
        }
        state = incoming;
        saveState();
        render();
        alert('Import successful.');
      } catch (err) {
        alert('Import failed: ' + err.message);
      } finally {
        if (document.body.contains(input)) document.body.removeChild(input);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

function clearAllData() {
  const confirm1 = confirm('Wipe ALL workout data? This cannot be undone.');
  if (!confirm1) return;
  const confirm2 = confirm('Are you absolutely sure? Last chance.');
  if (!confirm2) return;
  state = {};
  saveState();
  render();
  alert('All data cleared.');
}

function render() {
  document.getElementById('weekLabel').textContent = `week_${String(currentWeek).padStart(2, '0')}`;
  localStorage.setItem('lift_app_week', String(currentWeek));
  if (currentDay === 'analytics') {
    renderAnalytics();
  } else if (currentDay === 'settings') {
    renderSettings();
  } else {
    destroyCharts();
    renderDay(currentDay);
  }
}

// ─── Wire up nav ───
function highlightTodayTab() {
  const todayKey = todayWeekdayKey();
  document.querySelectorAll('#dayTabs button').forEach(btn => {
    btn.classList.toggle('today', btn.dataset.day === todayKey);
  });
}

function setActiveTab(day) {
  document.querySelectorAll('#dayTabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.day === day);
  });
}

document.querySelectorAll('#dayTabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    currentDay = btn.dataset.day;
    localStorage.setItem('lift_app_day', currentDay);
    setActiveTab(currentDay);
    render();
  });
});

document.getElementById('weekPrev').addEventListener('click', () => {
  if (currentWeek > 1) {
    currentWeek--;
    render();
  }
});

document.getElementById('weekNext').addEventListener('click', () => {
  if (currentWeek < NUM_WEEKS) {
    currentWeek++;
    render();
  }
});

// Initial render: pick today / saved day, highlight today, mark visit
currentDay = pickInitialDay();
localStorage.setItem('lift_app_last_visit', new Date().toISOString().slice(0, 10));
localStorage.setItem('lift_app_day', currentDay);
highlightTodayTab();
setActiveTab(currentDay);
render();

// ─── Service worker for offline / PWA + auto-update ───
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // Check for updates whenever the page loads
      reg.update();
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version installed — reload to use it
            window.location.reload();
          }
        });
      });
    }).catch(() => {});
  });
}
