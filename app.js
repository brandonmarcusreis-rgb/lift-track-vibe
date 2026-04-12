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
  saturday: [],
  sunday: [],
};

const HABITS = ['vitamins', 'creatine', 'hydration'];
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

function getUnit() {
  return localStorage.getItem('lift_app_unit') === 'kg' ? 'kg' : 'lb';
}

function setUnit(u) {
  localStorage.setItem('lift_app_unit', u === 'kg' ? 'kg' : 'lb');
}

function unitLabel() {
  return getUnit() === 'kg' ? 'kg' : 'lbs';
}

const KG_PER_LB = 0.45359237;
const LB_PER_KG = 1 / KG_PER_LB;

function lbsToDisplay(lbs) {
  if (lbs === '' || lbs == null) return '';
  const n = parseFloat(lbs);
  if (isNaN(n)) return '';
  const displayN = getUnit() === 'kg' ? n * KG_PER_LB : n;
  return String(Math.round(displayN * 10) / 10);
}

function displayToLbs(display) {
  if (display === '' || display == null) return '';
  const n = parseFloat(display);
  if (isNaN(n)) return '';
  const lbs = getUnit() === 'kg' ? n * LB_PER_KG : n;
  return String(Math.round(lbs * 100) / 100);
}

function displayVolume(lbs) {
  const n = parseFloat(lbs) || 0;
  const displayN = getUnit() === 'kg' ? n * KG_PER_LB : n;
  return fmtNum(Math.round(displayN));
}

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
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
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
  try {
    let url, headers;
    try { url = await ghContentsUrl(); }
    catch (e) { throw new Error('url build: ' + (e.message || e)); }
    try { headers = { ...(await ghHeaders()), 'Cache-Control': 'no-cache' }; }
    catch (e) { throw new Error('headers build: ' + (e.message || e)); }
    const fullUrl = url + '?_=' + Date.now();
    let r;
    try {
      r = await fetch(fullUrl, { headers, cache: 'no-store' });
    } catch (e) {
      throw new Error('fetch("' + fullUrl.slice(0, 80) + '"): ' + (e.message || e));
    }
    if (r.ok) {
      try {
        const j = await r.json();
        return j.sha;
      } catch (e) { throw new Error('json parse: ' + (e.message || e)); }
    }
    if (r.status === 404) return null;
    const txt = await r.text();
    throw new Error(`status ${r.status}: ${txt.slice(0,150)}`);
  } catch (e) {
    // Re-throw with version tag so we can verify the user is on the new build
    throw new Error('[v115] ' + (e.message || e));
  }
}

async function putContents(sha) {
  let url, headers, payload, encoded;
  try { url = await ghContentsUrl(); }
  catch (e) { throw new Error('url build: ' + (e.message || e)); }
  try { headers = { ...(await ghHeaders()), 'Content-Type': 'application/json' }; }
  catch (e) { throw new Error('headers: ' + (e.message || e)); }
  try {
    payload = JSON.stringify({
      version: 1,
      saved_at: new Date().toISOString(),
      data: state,
    }, null, 2);
  } catch (e) { throw new Error('json stringify: ' + (e.message || e)); }
  try { encoded = utf8ToBase64(payload); }
  catch (e) { throw new Error('base64 encode (payload ' + payload.length + ' chars): ' + (e.message || e)); }
  const body = {
    message: `auto-backup ${new Date().toISOString()}`,
    content: encoded,
  };
  if (sha) body.sha = sha;
  try {
    return await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  } catch (e) { throw new Error('fetch PUT ' + url.slice(0,60) + ': ' + (e.message || e)); }
}

async function backupToGithub() {
  // First attempt
  let sha;
  try { sha = await fetchCurrentSha(); }
  catch (e) { throw new Error('GET sha failed: ' + (e.message || e)); }
  let resp;
  try { resp = await putContents(sha); }
  catch (e) { throw new Error('PUT failed: ' + (e.message || e)); }

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
    showError('Restore failed', e.message || e);
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
    showError('Connection test failed', lines.join('\n'));
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
    showError('Connection test failed', lines.join('\n'));
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

  const summary = lines.join('\n');
  if (summary.includes('✗')) showError('Connection test issue', summary);
  else alert(summary);
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
        grid: { color: 'rgba(40,254,20,0.08)' },
      },
      y: {
        ticks: { color, font: { family: 'Menlo, monospace', size: 9 } },
        grid: { color: 'rgba(40,254,20,0.08)' },
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

(function migrateBodyMinutesToKcal() {
  let changed = false;
  for (const wk of Object.keys(state)) {
    if (isNaN(parseInt(wk, 10))) continue;
    for (const d of Object.keys(state[wk] || {})) {
      const body = state[wk][d]?.body;
      if (!body) continue;
      for (const name of Object.keys(body)) {
        const entry = body[name];
        if (entry && 'minutes' in entry && !('kcal' in entry)) {
          entry.kcal = entry.minutes;
          delete entry.minutes;
          changed = true;
        } else if (entry && 'minutes' in entry && 'kcal' in entry) {
          delete entry.minutes;
          changed = true;
        }
      }
    }
  }
  if (changed) saveState();
})();

(function migrateExercisesToBody() {
  const MOVES = [
    { day: 'monday',    oldName: 'Pull Up',         newName: 'Pull Up', group: 'Calisthenics' },
    { day: 'wednesday', oldName: 'Ab Calisthenics', newName: 'Abs',     group: 'Calisthenics' },
    { day: 'thursday',  oldName: 'Dips',            newName: 'Dips',    group: 'Calisthenics' },
  ];
  let changed = false;
  state.bodyActivities ??= {};
  for (const { day, oldName, newName, group } of MOVES) {
    // Drop from any customized exercise list for this day
    if (Array.isArray(state.exercises?.[day])) {
      const before = state.exercises[day].length;
      state.exercises[day] = state.exercises[day].filter(ex => ex.name !== oldName);
      if (state.exercises[day].length !== before) changed = true;
    }
    // Seed the body list (idempotent)
    state.bodyActivities[day] ??= [];
    if (!state.bodyActivities[day].some(b => b.name === newName)) {
      state.bodyActivities[day].push({ name: newName, group });
      changed = true;
    }
  }
  if (changed) saveState();
})();

(function migrateExerciseGroups() {
  if (!state.exercises) return;
  let changed = false;
  for (const d of Object.keys(state.exercises)) {
    const list = state.exercises[d];
    if (!Array.isArray(list)) continue;
    list.forEach(ex => {
      if (!ex) return;
      const normalized = normalizeGroup(ex.group);
      if (normalized && normalized !== ex.group) {
        ex.group = normalized;
        changed = true;
      }
    });
  }
  if (changed) saveState();
})();

(function migrateExerciseNames() {
  const RENAMES = {
    'Standing Bent Barbell Row': 'Barbell Row',
    'Overhead Shoulder': 'Shoulder Row',
    'OH Cable Tricep Pulldown': 'Overhead Tricep Pulldown',
    'AWAY Cable Bicep Curl': 'Bayesian Bicep Curl',
    'Skull Crushers (Bar)': 'EZ Skull Crushers',
  };
  let changed = false;

  // Rename tracked set history across every week/day
  for (const wk of Object.keys(state)) {
    if (isNaN(parseInt(wk, 10))) continue;
    for (const d of Object.keys(state[wk] || {})) {
      const exs = state[wk][d]?.exercises;
      if (!exs) continue;
      for (const [oldName, newName] of Object.entries(RENAMES)) {
        if (oldName in exs) {
          // If new name already has data, skip to avoid clobbering
          if (!(newName in exs)) {
            exs[newName] = exs[oldName];
          }
          delete exs[oldName];
          changed = true;
        }
      }
    }
  }

  // Rename in any customized per-day exercise lists the user has saved
  if (state.exercises) {
    for (const d of Object.keys(state.exercises)) {
      const list = state.exercises[d];
      if (!Array.isArray(list)) continue;
      list.forEach(ex => {
        if (ex && RENAMES[ex.name]) {
          ex.name = RENAMES[ex.name];
          changed = true;
        }
      });
    }
  }

  if (changed) saveState();
})();

(function migrateHabitNames() {
  let changed = false;
  if (Array.isArray(state.habitsList)) {
    const idx = state.habitsList.indexOf('creatine_5g');
    if (idx !== -1) { state.habitsList[idx] = 'creatine'; changed = true; }
  }
  for (const wk of Object.keys(state)) {
    if (isNaN(parseInt(wk, 10))) continue;
    for (const d of Object.keys(state[wk] || {})) {
      const h = state[wk][d]?.habits;
      if (h && 'creatine_5g' in h) {
        h['creatine'] = h['creatine_5g'];
        delete h['creatine_5g'];
        changed = true;
      }
    }
  }
  if (changed) saveState();
})();

// Migrate "Back" → "Upper Back" and "Legs" → "Thighs" in custom exercise lists
(function migrateBackToUpperBack() {
  let changed = false;
  if (state.exercises) {
    for (const day of Object.keys(state.exercises)) {
      const list = state.exercises[day];
      if (!Array.isArray(list)) continue;
      for (const ex of list) {
        if (ex.group === 'Back') { ex.group = 'Upper Back'; changed = true; }
        if (ex.group === 'Legs') { ex.group = 'Thighs'; changed = true; }
      }
    }
  }
  if (state.bodyActivities) {
    for (const day of Object.keys(state.bodyActivities)) {
      const list = state.bodyActivities[day];
      if (!Array.isArray(list)) continue;
      for (const act of list) {
        if (act.group === 'Back') { act.group = 'Upper Back'; changed = true; }
        if (act.group === 'Legs') { act.group = 'Thighs'; changed = true; }
      }
    }
  }
  // Also migrate the group_last_worked map
  try {
    const map = JSON.parse(localStorage.getItem('lift_app_group_last_worked') || '{}');
    if (map['Back'] && !map['Upper Back']) { map['Upper Back'] = map['Back']; delete map['Back']; }
    if (map['Legs'] && !map['Thighs']) { map['Thighs'] = map['Legs']; delete map['Legs']; }
    localStorage.setItem('lift_app_group_last_worked', JSON.stringify(map));
  } catch {}
  if (changed) saveState();
})();

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

function currentCalendarWeek() {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const dayNum = Math.ceil((now - oneJan + 1) / 86400000);
  return Math.min(52, Math.ceil(dayNum / 7));
}

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

function getProtein(week, day) {
  ensure(week, day);
  return state[week][day].protein || '';
}

function setProtein(week, day, value) {
  ensure(week, day);
  state[week][day].protein = value;
  saveState();
}

function getMacro(week, day, field) {
  ensure(week, day);
  return state[week][day][field] || '';
}

function setMacro(week, day, field, value) {
  ensure(week, day);
  state[week][day][field] = value;
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

function getHabitsList() {
  if (Array.isArray(state.habitsList)) return state.habitsList;
  return [...HABITS];
}

function setHabitsList(list) {
  state.habitsList = list;
  saveState();
}

function addHabitToList(name) {
  const clean = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (!clean) return false;
  const list = getHabitsList();
  if (list.includes(clean)) return false;
  list.push(clean);
  setHabitsList(list);
  return true;
}

function removeHabitFromList(name) {
  const list = getHabitsList().filter(h => h !== name);
  setHabitsList(list);
  for (const wk of Object.keys(state)) {
    if (isNaN(parseInt(wk, 10))) continue;
    for (const d of Object.keys(state[wk] || {})) {
      if (state[wk][d]?.habits && name in state[wk][d].habits) {
        delete state[wk][d].habits[name];
      }
    }
  }
  saveState();
}

function renameHabitInList(oldName, newName) {
  const clean = newName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (!clean || clean === oldName) return false;
  const list = getHabitsList();
  const idx = list.indexOf(oldName);
  if (idx === -1) return false;
  if (list.includes(clean)) return false;
  list[idx] = clean;
  setHabitsList(list);
  for (const wk of Object.keys(state)) {
    if (isNaN(parseInt(wk, 10))) continue;
    for (const d of Object.keys(state[wk] || {})) {
      if (state[wk][d]?.habits && oldName in state[wk][d].habits) {
        state[wk][d].habits[clean] = state[wk][d].habits[oldName];
        delete state[wk][d].habits[oldName];
      }
    }
  }
  saveState();
  return true;
}

function getExercisesForDay(day) {
  if (state.exercises?.[day]) return state.exercises[day];
  return DAYS[day] || [];
}

function setExercisesForDay(day, list) {
  state.exercises ??= {};
  state.exercises[day] = list;
  saveState();
}

function ensureCustomDayExercises(day) {
  if (!state.exercises?.[day]) {
    state.exercises ??= {};
    state.exercises[day] = (DAYS[day] || []).map(ex => ({ ...ex }));
  }
}

function normalizeGroup(group) {
  if (!group) return null;
  if (EXERCISE_GROUPS.includes(group)) return group;
  // Legacy migrations
  if (group === 'Back') return 'Upper Back';
  if (group === 'Legs') return 'Thighs';
  const HYBRID_MAP = {
    'Legs/Posterior': 'Thighs',
    'Legs/Core':      'Core',
    'Triceps/Chest':  'Triceps',
    'Back/Rear Delt': 'Shoulders',
    'Hamstrings':     'Thighs',
    'Quads':          'Thighs',
    'Posterior':      'Thighs',
    'Rear Delts':     'Shoulders',
  };
  if (HYBRID_MAP[group]) return HYBRID_MAP[group];
  const first = group.split('/')[0].trim();
  if (EXERCISE_GROUPS.includes(first)) return first;
  return 'Core';
}

function addExerciseToDay(day, name, group) {
  const clean = name.trim();
  if (!clean) return false;
  if (!group || !EXERCISE_GROUPS.includes(group)) return false;
  ensureCustomDayExercises(day);
  if (state.exercises[day].some(ex => ex.name === clean)) return false;
  state.exercises[day].push({ name: clean, group });
  unexcludeLibraryItem('weight', clean);
  saveState();
  return true;
}

function removeExerciseFromDay(day, name) {
  ensureCustomDayExercises(day);
  state.exercises[day] = state.exercises[day].filter(ex => ex.name !== name);
  saveState();
}

function getBodyActivitiesForDay(day) {
  return state.bodyActivities?.[day] || [];
}

function setBodyActivitiesForDay(day, list) {
  state.bodyActivities ??= {};
  state.bodyActivities[day] = list;
  saveState();
}

function addBodyActivityToDay(day, name, group) {
  const clean = name.trim();
  if (!clean) return false;
  if (!group || !BODY_GROUPS.includes(group)) return false;
  state.bodyActivities ??= {};
  state.bodyActivities[day] ??= [];
  if (state.bodyActivities[day].some(b => b.name === clean)) return false;
  state.bodyActivities[day].push({ name: clean, group });
  unexcludeLibraryItem('body', clean);
  saveState();
  return true;
}

function removeBodyActivityFromDay(day, name) {
  if (!state.bodyActivities?.[day]) return;
  state.bodyActivities[day] = state.bodyActivities[day].filter(b => b.name !== name);
  saveState();
}

function getLibraryMeta(kind) {
  state.library ??= { weight: { excluded: [], pinned: [] }, body: { excluded: [], pinned: [] } };
  state.library[kind] ??= { excluded: [], pinned: [] };
  state.library[kind].excluded ??= [];
  state.library[kind].pinned ??= [];
  return state.library[kind];
}

function excludeLibraryItem(kind, name) {
  const meta = getLibraryMeta(kind);
  if (!meta.excluded.includes(name)) meta.excluded.push(name);
  meta.pinned = meta.pinned.filter(n => n !== name);
  saveState();
}

function unexcludeLibraryItem(kind, name) {
  const meta = getLibraryMeta(kind);
  const before = meta.excluded.length;
  meta.excluded = meta.excluded.filter(n => n !== name);
  if (meta.excluded.length !== before) saveState();
}

function togglePinLibraryItem(kind, name) {
  const meta = getLibraryMeta(kind);
  if (meta.pinned.includes(name)) {
    meta.pinned = meta.pinned.filter(n => n !== name);
  } else {
    meta.pinned.push(name);
    meta.excluded = meta.excluded.filter(n => n !== name);
  }
  saveState();
}

function getAllExercisesLibrary() {
  const seen = new Map();
  for (const d of Object.keys(DAYS)) {
    for (const ex of DAYS[d] || []) {
      if (!seen.has(ex.name)) seen.set(ex.name, { name: ex.name, group: ex.group });
    }
  }
  if (state.exercises) {
    for (const d of Object.keys(state.exercises)) {
      for (const ex of state.exercises[d] || []) {
        if (!seen.has(ex.name)) seen.set(ex.name, { name: ex.name, group: ex.group });
      }
    }
  }
  for (const wk of Object.keys(state)) {
    if (isNaN(parseInt(wk, 10))) continue;
    for (const d of Object.keys(state[wk] || {})) {
      const exs = state[wk][d]?.exercises;
      if (!exs) continue;
      for (const name of Object.keys(exs)) {
        if (!seen.has(name)) seen.set(name, { name, group: 'Core' });
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getAllBodyActivitiesLibrary() {
  const seen = new Map();
  if (state.bodyActivities) {
    for (const d of Object.keys(state.bodyActivities)) {
      for (const a of state.bodyActivities[d] || []) {
        if (!seen.has(a.name)) seen.set(a.name, { name: a.name, group: a.group });
      }
    }
  }
  for (const wk of Object.keys(state)) {
    if (isNaN(parseInt(wk, 10))) continue;
    for (const d of Object.keys(state[wk] || {})) {
      const bd = state[wk][d]?.body;
      if (!bd) continue;
      for (const name of Object.keys(bd)) {
        if (!seen.has(name)) seen.set(name, { name, group: 'Calisthenics' });
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function enableSwipeActions(itemEl, onSwipeLeft, onSwipeRight) {
  let startX = 0, startY = 0, dx = 0;
  let active = false;

  const clearIndicators = () => itemEl.classList.remove('swiping-left', 'swiping-right');

  itemEl.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    dx = 0;
    active = true;
    itemEl.style.transition = 'none';
  }, { passive: true });

  itemEl.addEventListener('touchmove', (e) => {
    if (!active) return;
    const t = e.touches[0];
    const mdx = t.clientX - startX;
    const mdy = t.clientY - startY;
    if (Math.abs(mdy) > Math.abs(mdx) && Math.abs(mdy) > 10) {
      active = false;
      itemEl.style.transform = '';
      clearIndicators();
      return;
    }
    dx = mdx;
    itemEl.style.transform = `translateX(${dx}px)`;
    if (dx < -20) {
      itemEl.classList.add('swiping-left');
      itemEl.classList.remove('swiping-right');
    } else if (dx > 20) {
      itemEl.classList.add('swiping-right');
      itemEl.classList.remove('swiping-left');
    } else {
      clearIndicators();
    }
  }, { passive: true });

  const onEnd = () => {
    if (!active) return;
    active = false;
    itemEl.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
    const threshold = 80;
    if (dx < -threshold) {
      itemEl.style.transform = `translateX(-110%)`;
      itemEl.style.opacity = '0';
      setTimeout(() => { onSwipeLeft(); }, 200);
    } else if (dx > threshold) {
      itemEl.style.transform = '';
      clearIndicators();
      onSwipeRight();
    } else {
      itemEl.style.transform = '';
      clearIndicators();
    }
  };
  itemEl.addEventListener('touchend', onEnd);
  itemEl.addEventListener('touchcancel', onEnd);

  return {
    shouldSuppressClick: () => Math.abs(dx) > 10,
    reset: () => { dx = 0; },
  };
}

function openAddModal(kind, day) {
  const isWeight = kind === 'weight';
  const groups = isWeight ? EXERCISE_GROUPS : BODY_GROUPS;
  const title = isWeight ? '+ add exercise' : '+ add activity';
  const namePlaceholder = isWeight ? 'exercise name' : 'activity name';
  const groupOptions = groups.map(g => `<option value="${g}">${g.toLowerCase()}</option>`).join('');

  const modal = el(`
    <div class="modal-overlay" role="dialog" aria-modal="true">
      <div class="modal">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" aria-label="close">✕</button>
        </div>
        <div class="modal-tabs">
          <button class="modal-tab active" data-tab="new">$ new</button>
          <button class="modal-tab" data-tab="history">$ from history</button>
        </div>
        <div class="modal-body">
          <div class="modal-panel" data-panel="new">
            <div class="modal-new-form">
              <input type="text" class="modal-new-name" placeholder="${namePlaceholder}" autocapitalize="words" autocorrect="off" spellcheck="false">
              <select class="modal-new-group" required>
                <option value="" disabled selected>group...</option>
                ${groupOptions}
              </select>
              <button class="btn modal-new-add">$ add</button>
            </div>
          </div>
          <div class="modal-panel" data-panel="history" hidden>
            <div class="modal-history-hint">&gt; swipe left to remove · swipe right to pin</div>
            <div class="modal-history-container"></div>
          </div>
        </div>
      </div>
    </div>
  `);

  const historyContainer = modal.querySelector('.modal-history-container');

  function computeAvailableLibrary() {
    const library = isWeight ? getAllExercisesLibrary() : getAllBodyActivitiesLibrary();
    const meta = getLibraryMeta(kind);
    const excluded = new Set(meta.excluded);
    const pinned = new Set(meta.pinned);
    const currentNames = new Set(
      isWeight
        ? getExercisesForDay(day).map(e => e.name)
        : getBodyActivitiesForDay(day).map(b => b.name)
    );
    const available = library.filter(item => !excluded.has(item.name) && !currentNames.has(item.name));
    const pinnedItems = available
      .filter(item => pinned.has(item.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    const otherItems = available
      .filter(item => !pinned.has(item.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...pinnedItems, ...otherItems];
  }

  function renderHistoryList() {
    historyContainer.innerHTML = '';
    const items = computeAvailableLibrary();
    if (items.length === 0) {
      historyContainer.innerHTML = '<div class="modal-empty">> no past entries yet — try the new tab</div>';
      return;
    }
    const pinnedNames = new Set(getLibraryMeta(kind).pinned);
    const list = el(`<div class="modal-history-list"></div>`);
    items.forEach(item => {
      const isPinned = pinnedNames.has(item.name);
      const row = el(`
        <div class="modal-history-item${isPinned ? ' pinned' : ''}" data-name="${item.name.replace(/"/g, '&quot;')}" data-group="${item.group.replace(/"/g, '&quot;')}">
          <span class="modal-history-name">${isPinned ? '★ ' : ''}${exKey(item.name)}</span>
          <span class="modal-history-group">${item.group.toLowerCase()}</span>
        </div>
      `);
      const swipe = enableSwipeActions(
        row,
        () => { excludeLibraryItem(kind, item.name); renderHistoryList(); },
        () => { togglePinLibraryItem(kind, item.name); renderHistoryList(); }
      );
      row.addEventListener('click', () => {
        if (swipe.shouldSuppressClick()) { swipe.reset(); return; }
        const targetGroups = isWeight ? EXERCISE_GROUPS : BODY_GROUPS;
        const safeGroup = targetGroups.includes(item.group) ? item.group : (isWeight ? 'Core' : 'Calisthenics');
        const ok = isWeight
          ? addExerciseToDay(day, item.name, safeGroup)
          : addBodyActivityToDay(day, item.name, safeGroup);
        if (ok) {
          close();
          renderDay(day);
        }
      });
      list.appendChild(row);
    });
    historyContainer.appendChild(list);
  }

  const close = () => modal.remove();

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  modal.querySelector('.modal-close').addEventListener('click', close);

  modal.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      modal.querySelectorAll('.modal-panel').forEach(p => {
        p.hidden = p.dataset.panel !== target;
      });
    });
  });

  const nameInput = modal.querySelector('.modal-new-name');
  const groupSelect = modal.querySelector('.modal-new-group');
  const flashInvalid = (el) => {
    el.classList.add('invalid');
    setTimeout(() => el.classList.remove('invalid'), 600);
  };
  const doAdd = () => {
    const name = nameInput.value.trim();
    const group = groupSelect.value;
    if (!name) { flashInvalid(nameInput); return; }
    if (!group) { flashInvalid(groupSelect); return; }
    const ok = isWeight
      ? addExerciseToDay(day, name, group)
      : addBodyActivityToDay(day, name, group);
    if (!ok) { flashInvalid(nameInput); return; }
    close();
    renderDay(day);
  };
  modal.querySelector('.modal-new-add').addEventListener('click', doAdd);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });

  renderHistoryList();

  document.body.appendChild(modal);
  setTimeout(() => nameInput.focus(), 50);
}

function renameBodyActivityOnDay(day, oldName, newName) {
  const clean = newName.trim();
  if (!clean || clean === oldName) return false;
  const list = state.bodyActivities?.[day];
  if (!Array.isArray(list)) return false;
  const idx = list.findIndex(b => b.name === oldName);
  if (idx === -1) return false;
  if (list.some(b => b.name === clean)) return false;
  list[idx] = { ...list[idx], name: clean };
  for (const wk of Object.keys(state)) {
    if (isNaN(parseInt(wk, 10))) continue;
    const body = state[wk]?.[day]?.body;
    if (body && oldName in body) {
      body[clean] = body[oldName];
      delete body[oldName];
    }
  }
  saveState();
  return true;
}

function getBodyKcal(week, day, name) {
  return state?.[week]?.[day]?.body?.[name]?.kcal ?? '';
}

function setBodyKcal(week, day, name, kcal) {
  ensure(week, day);
  state[week][day].body ??= {};
  state[week][day].body[name] ??= {};
  state[week][day].body[name].kcal = kcal === '' ? '' : Number(kcal);
  saveState();
}

function getBodyMass(week, day, name) {
  return state?.[week]?.[day]?.body?.[name]?.mass ?? '';
}

function setBodyMass(week, day, name, mass) {
  ensure(week, day);
  state[week][day].body ??= {};
  state[week][day].body[name] ??= {};
  state[week][day].body[name].mass = mass === '' ? '' : Number(mass);
  saveState();
}

function getBodyReps(week, day, name) {
  return state?.[week]?.[day]?.body?.[name]?.reps ?? '';
}

function setBodyReps(week, day, name, reps) {
  ensure(week, day);
  state[week][day].body ??= {};
  state[week][day].body[name] ??= {};
  state[week][day].body[name].reps = reps === '' ? '' : Number(reps);
  saveState();
}

const DEFAULT_SECTION_ORDER = ['weight', 'body'];
const SECTION_LABELS = { weight: '[weight]', body: '[body]' };

function getSectionOrder() {
  const saved = state.sections?.order;
  if (Array.isArray(saved) && saved.length) return saved;
  return [...DEFAULT_SECTION_ORDER];
}

function setSectionOrder(order) {
  state.sections ??= {};
  state.sections.order = order;
  saveState();
}

function isSectionCollapsed(key) {
  return !!state.sections?.collapsed?.[key];
}

function toggleSectionCollapsed(key) {
  state.sections ??= {};
  state.sections.collapsed ??= {};
  state.sections.collapsed[key] = !state.sections.collapsed[key];
  saveState();
}

function isAnalyticsCollapsed(key) {
  return !!state.analyticsCollapsed?.[key];
}

function toggleAnalyticsCollapsed(key) {
  state.analyticsCollapsed ??= {};
  state.analyticsCollapsed[key] = !state.analyticsCollapsed[key];
  saveState();
}

function buildAnalyticsCollapsible(key, title) {
  const collapsed = isAnalyticsCollapsed(key);
  const section = el(`
    <div class="collapsible-section analytics-section${collapsed ? ' collapsed' : ''}" data-analytics-key="${key}">
      <div class="section-header">
        <span class="section-title">${title}</span>
      </div>
      <div class="section-body"></div>
    </div>
  `);
  section.querySelector('.section-header').addEventListener('click', () => {
    toggleAnalyticsCollapsed(key);
    renderAnalytics();
  });
  return section;
}

function renameExerciseOnDay(day, oldName, newName) {
  const clean = newName.trim();
  if (!clean || clean === oldName) return false;
  ensureCustomDayExercises(day);
  const idx = state.exercises[day].findIndex(ex => ex.name === oldName);
  if (idx === -1) return false;
  if (state.exercises[day].some(ex => ex.name === clean)) return false;
  state.exercises[day][idx] = { ...state.exercises[day][idx], name: clean };
  // Migrate tracked sets across all weeks
  for (const wk of Object.keys(state)) {
    if (isNaN(parseInt(wk, 10))) continue;
    const exs = state[wk]?.[day]?.exercises;
    if (exs && oldName in exs) {
      exs[clean] = exs[oldName];
      delete exs[oldName];
    }
  }
  saveState();
  return true;
}

function calcDayVolume(week, day) {
  const exercises = getExercisesForDay(day);
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

function calcWeekAvgProtein(week) {
  const days = Object.keys(DAYS);
  const vals = days.map(d => parseFloat(getProtein(week, d))).filter(v => !isNaN(v) && v > 0);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a,b) => a+b, 0) / vals.length);
}

function scoreSleep(hours) {
  if (hours == null || isNaN(hours) || hours <= 0) return null;
  if (hours < 7) return 'below';
  if (hours < 9) return 'target';
  return 'surpassed';
}

function scoreSteps(count) {
  if (count == null || isNaN(count) || count <= 0) return null;
  if (count < 5000) return 'low';
  if (count < 8000) return 'medium';
  if (count < 11000) return 'target';
  return 'surpassed';
}

function yesterdayDateStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Returns the calendar date for a given day-tab name in the current week.
// e.g. if today is Wednesday 2026-04-15, dateForDayTab('monday') → '2026-04-13'
function dateForDayTab(dayName) {
  const dayIndex = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
  const idx = dayIndex[dayName];
  if (idx == null) return yesterdayDateStr(); // fallback
  const now = new Date();
  const todayIdx = now.getDay(); // 0=Sun
  // Offset from today to the requested day within the same Mon–Sun week
  const todayMondayBased = todayIdx === 0 ? 6 : todayIdx - 1; // 0=Mon
  const targetMondayBased = idx === 0 ? 6 : idx - 1;          // 0=Mon
  const diff = targetMondayBased - todayMondayBased;
  const d = new Date(now);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Returns the date whose health data should appear in the baseline box
// for a given day tab. The Apple Shortcut runs each morning and writes
// the previous day's metrics into a file dated with the current date,
// so the tab's own calendar date already maps to the prior day's data.
function baselineDateForDay(dayName) {
  return dateForDayTab(dayName);
}

function linearRegression(ys) {
  // Returns array of fitted y-values, ignoring null/NaN entries for the fit
  const xs = [];
  const yvals = [];
  ys.forEach((y, i) => {
    if (y != null && !isNaN(y)) { xs.push(i); yvals.push(y); }
  });
  if (xs.length < 2) return ys.map(() => null);
  const n = xs.length;
  const sumX = xs.reduce((a,b) => a+b, 0);
  const sumY = yvals.reduce((a,b) => a+b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x*yvals[i], 0);
  const sumX2 = xs.reduce((acc, x) => acc + x*x, 0);
  const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
  const intercept = (sumY - slope*sumX) / n;
  return ys.map((_, i) => slope*i + intercept);
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
    getExercisesForDay(day).forEach(ex => {
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

function getTopSet(week, day, exName) {
  const sets = state?.[week]?.[day]?.exercises?.[exName]?.sets;
  if (!Array.isArray(sets)) return null;
  let best = null;
  for (const s of sets) {
    const lbs = parseFloat(s.lbs);
    const reps = parseFloat(s.reps);
    if (isNaN(lbs) || isNaN(reps) || lbs <= 0 || reps <= 0) continue;
    if (!best || lbs > best.lbs || (lbs === best.lbs && reps > best.reps)) {
      best = { lbs, reps };
    }
  }
  return best;
}

function computePREvolution() {
  const result = [];
  if (currentWeek < 2) return result;
  const prevWeek = currentWeek - 1;
  for (const day of Object.keys(DAYS)) {
    const entries = [];
    for (const ex of getExercisesForDay(day)) {
      const prev = getTopSet(prevWeek, day, ex.name);
      const curr = getTopSet(currentWeek, day, ex.name);
      if (!prev || !curr) continue;
      if (prev.lbs === curr.lbs && prev.reps === curr.reps) continue;
      const direction = (curr.lbs > prev.lbs || (curr.lbs === prev.lbs && curr.reps > prev.reps))
        ? 'up'
        : 'down';
      entries.push({ name: ex.name, prev, curr, direction });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    if (entries.length > 0) result.push({ day, entries });
  }
  return result;
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

let supplementsEditMode = false;
let exercisesEditMode = false;
let bodyEditMode = false;
let sectionClickSuppressedUntil = 0;

function renderSupplementsRows(container, day) {
  container.querySelectorAll('[data-habit], .habit-add-row').forEach(r => r.remove());
  const list = getHabitsList();

  list.forEach(h => {
    if (supplementsEditMode) {
      const row = el(`
        <div class="habit-row" data-habit="${h}">
          <input type="text" class="habit-edit-input" value="${h}">
          <button class="habit-remove-btn">✕</button>
        </div>
      `);
      const input = row.querySelector('input');
      input.addEventListener('change', e => {
        const ok = renameHabitInList(h, e.target.value);
        if (!ok) e.target.value = h;
        renderSupplementsRows(container, day);
      });
      row.querySelector('.habit-remove-btn').addEventListener('click', () => {
        removeHabitFromList(h);
        renderSupplementsRows(container, day);
      });
      container.appendChild(row);
    } else {
      const checked = getHabit(currentWeek, day, h);
      const row = el(`
        <div class="habit-row" data-habit="${h}">
          <label># ${h}</label>
          <button class="habit-toggle ${checked ? 'checked' : ''}">${checked ? '✓' : ''}</button>
        </div>
      `);
      row.querySelector('button').addEventListener('click', e => {
        const nowChecked = toggleHabit(currentWeek, day, h);
        e.target.classList.toggle('checked', nowChecked);
        e.target.textContent = nowChecked ? '✓' : '';
      });
      container.appendChild(row);
    }
  });

  if (supplementsEditMode) {
    const addRow = el(`
      <div class="habit-add-row">
        <input type="text" class="habit-new-input" placeholder="+ new_supplement" autocapitalize="off" autocorrect="off" spellcheck="false">
        <button class="habit-add-btn">+</button>
      </div>
    `);
    const input = addRow.querySelector('input');
    const btn = addRow.querySelector('button');
    const doAdd = () => {
      if (addHabitToList(input.value)) {
        input.value = '';
        renderSupplementsRows(container, day);
      }
    };
    btn.addEventListener('click', doAdd);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
    container.appendChild(addRow);
  }
}

function toggleExerciseCompleted(card, day, exName) {
  ensure(currentWeek, day, exName);
  const exState = state[currentWeek][day].exercises[exName];
  if (exState.completed) {
    // Uncollapse instantly
    exState.completed = false;
    saveState();
    card.classList.remove('completed');
    updateSectionCompletion(card, day);
    // Recalculate heatmap for this group since we just un-completed
    const exercises = getExercisesForDay(day);
    const cfg = exercises.find(e => e.name === exName);
    if (cfg) unstampGroupIfNeeded(cfg.group, day);
    return;
  }
  // Look up the group for this exercise so we can stamp the heatmap
  const exercises = getExercisesForDay(day);
  const exCfg = exercises.find(e => e.name === exName);

  // Flash rainbow, then collapse
  card.classList.add('flashing');
  const onEnd = (e) => {
    if (e.animationName !== 'rainbow-flash') return;
    card.removeEventListener('animationend', onEnd);
    card.classList.remove('flashing');
    card.classList.add('completed');
    exState.completed = true;
    saveState();
    updateSectionCompletion(card, day);
    // Stamp the muscle group as worked for the heatmap
    if (exCfg) stampGroupFromExercise(exCfg.group, day);
  };
  card.addEventListener('animationend', onEnd);
  if (navigator.vibrate) navigator.vibrate(20);
}

function updateSectionCompletion(card, day) {
  const section = card.closest('.collapsible-section[data-section="weight"]');
  if (!section) return;
  const exercises = getExercisesForDay(day);
  if (exercises.length === 0) return;
  const allDone = exercises.every(ex => {
    return !!state?.[currentWeek]?.[day]?.exercises?.[ex.name]?.completed;
  });
  section.classList.toggle('all-completed', allDone);
}

function enableTouchReorder(listEl, onReorder) {
  let draggingEl = null;
  let longPressTimer = null;
  let touchOffsetY = 0;
  let placeholder = null;

  const startDrag = (row, touch) => {
    draggingEl = row;
    const rect = row.getBoundingClientRect();
    placeholder = document.createElement('div');
    placeholder.className = 'exercise-drag-placeholder';
    placeholder.style.height = `${row.offsetHeight}px`;
    row.after(placeholder);
    row.classList.add('dragging');
    row.style.position = 'fixed';
    row.style.left = `${rect.left}px`;
    row.style.width = `${rect.width}px`;
    row.style.top = `${touch.clientY - touchOffsetY}px`;
    row.style.zIndex = '1000';
    row.style.pointerEvents = 'none';
    if (navigator.vibrate) navigator.vibrate(15);
  };

  const moveDrag = (touch) => {
    draggingEl.style.top = `${touch.clientY - touchOffsetY}px`;
    const siblings = listEl.querySelectorAll('.exercise-edit-row:not(.dragging)');
    for (const r of siblings) {
      const rect = r.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        if (touch.clientY < rect.top + rect.height / 2) {
          r.before(placeholder);
        } else {
          r.after(placeholder);
        }
        return;
      }
    }
  };

  const endDrag = () => {
    draggingEl.classList.remove('dragging');
    draggingEl.removeAttribute('style');
    placeholder.replaceWith(draggingEl);
    placeholder = null;
    draggingEl = null;
    const newOrder = Array.from(listEl.querySelectorAll('.exercise-edit-row'))
      .map(r => r.dataset.exName);
    onReorder(newOrder);
  };

  listEl.addEventListener('touchstart', (e) => {
    if (e.target.closest('input, button')) return;
    const row = e.target.closest('.exercise-edit-row');
    if (!row) return;
    const touch = e.touches[0];
    touchOffsetY = touch.clientY - row.getBoundingClientRect().top;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      startDrag(row, touch);
    }, 280);
  }, { passive: true });

  listEl.addEventListener('touchmove', (e) => {
    if (longPressTimer) {
      const touch = e.touches[0];
      const row = e.target.closest('.exercise-edit-row');
      if (row) {
        const rect = row.getBoundingClientRect();
        if (Math.abs(touch.clientY - (rect.top + touchOffsetY)) > 8) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
      return;
    }
    if (!draggingEl) return;
    e.preventDefault();
    moveDrag(e.touches[0]);
  }, { passive: false });

  const finishTouch = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      return;
    }
    if (draggingEl) endDrag();
  };
  listEl.addEventListener('touchend', finishTouch);
  listEl.addEventListener('touchcancel', finishTouch);
}

// ─── Water intake (14 cups / 7 drops × 2 cups each) ───
const WATER_DROPS = 7;

function getWater(week, day) {
  ensure(week, day);
  // Array of 7 values: 0 (empty), 1 (half), 2 (full)
  if (!Array.isArray(state[week][day].water) || state[week][day].water.length !== WATER_DROPS) {
    state[week][day].water = Array(WATER_DROPS).fill(0);
  }
  return state[week][day].water;
}

function setWaterAt(week, day, idx, value) {
  const arr = getWater(week, day);
  arr[idx] = value;
  saveState();
}

function waterDropSvg(level) {
  // level: 0 = empty (outline only), 1 = half (blue), 2 = full (deep purple)
  const drop = 'M16 2 Q16 2, 26 18 Q30 28, 16 36 Q2 28, 6 18 Q16 2, 16 2 Z';
  if (level === 2) {
    return `
      <svg viewBox="0 0 32 38" class="water-drop-svg">
        <path d="${drop}" fill="#7C3AED" stroke="#7C3AED" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    `;
  }
  if (level === 1) {
    const clipId = 'wc' + Math.random().toString(36).slice(2,8);
    return `
      <svg viewBox="0 0 32 38" class="water-drop-svg">
        <defs>
          <clipPath id="${clipId}"><path d="${drop}"/></clipPath>
        </defs>
        <path d="${drop}" fill="none" stroke="#3B82F6" stroke-width="1.8" stroke-linejoin="round"/>
        <rect x="0" y="19" width="32" height="19" fill="#3B82F6" clip-path="url(#${clipId})"/>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 32 38" class="water-drop-svg">
      <path d="${drop}" fill="none" stroke="#94A3B8" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>
  `;
}

function renderWaterTracker(day) {
  const block = el(`
    <div class="water-tracker" data-block="water">
      <div class="water-header">
        <span class="water-title">## water</span>
        <span class="water-counter" data-role="water-counter">0 / 14</span>
      </div>
      <div class="water-drops"></div>
    </div>
  `);
  const dropsContainer = block.querySelector('.water-drops');
  const counter = block.querySelector('[data-role="water-counter"]');

  const refreshCounter = () => {
    const arr = getWater(currentWeek, day);
    const cups = arr.reduce((a,b) => a+b, 0);
    counter.textContent = `${cups} / 14`;
    if (cups >= 14) counter.classList.add('complete');
    else counter.classList.remove('complete');
  };

  for (let i = 0; i < WATER_DROPS; i++) {
    const drop = el(`<button class="water-drop" data-idx="${i}" aria-label="water drop ${i+1}"></button>`);
    const renderDrop = () => {
      const arr = getWater(currentWeek, day);
      drop.innerHTML = waterDropSvg(arr[i]);
      drop.classList.toggle('filled', arr[i] === 2);
      drop.classList.toggle('half', arr[i] === 1);
    };
    renderDrop();
    drop.addEventListener('click', () => {
      const arr = getWater(currentWeek, day);
      const current = arr[i];
      const next = (current + 1) % 3; // 0 → 1 → 2 → 0
      setWaterAt(currentWeek, day, i, next);
      renderDrop();
      refreshCounter();
      if (next === 2) {
        // Trigger the filled-circle animation
        const burst = document.createElement('span');
        burst.className = 'water-complete-burst';
        drop.appendChild(burst);
        if (navigator.vibrate) navigator.vibrate(15);
        burst.addEventListener('animationend', () => burst.remove());
      }
    });
    dropsContainer.appendChild(drop);
  }
  refreshCounter();
  return block;
}

function renderDay(day) {
  const exercises = getExercisesForDay(day);
  const main = document.getElementById('content');
  main.innerHTML = '';
  // Scroll to top whenever we render a day so the water/macros/baseline
  // snapshot is always in view regardless of screen size.
  window.scrollTo({ top: 0, behavior: 'instant' });
  main.scrollTop = 0;
  const prevWeek = currentWeek - 1;

  // ─── Top split: daily_tracking (yellow) + macros (orange) ───
  const habitsBlock = el(`
    <div class="habits" data-block="daily-tracking">
      <h2>## daily_tracking</h2>
      <div class="supplements-list"></div>
      <button class="subbox-edit-btn full-width" data-role="edit-supplements">add/remove</button>
    </div>
  `);

  const supplementsList = habitsBlock.querySelector('.supplements-list');
  renderSupplementsRows(supplementsList, day);

  const editBtn = habitsBlock.querySelector('[data-role="edit-supplements"]');
  editBtn.addEventListener('click', () => {
    supplementsEditMode = !supplementsEditMode;
    editBtn.classList.toggle('active', supplementsEditMode);
    editBtn.textContent = supplementsEditMode ? 'done' : 'add/remove';
    renderSupplementsRows(supplementsList, day);
  });

  // ─── Water tracker (white) — sits above daily_tracking + macros ───
  main.appendChild(renderWaterTracker(day));

  const topSplit = el(`<div class="top-split"></div>`);
  topSplit.appendChild(habitsBlock);
  topSplit.appendChild(renderMacros(day));
  main.appendChild(topSplit);

  // ─── Baseline (cyan) — previous day's health data below ───
  main.appendChild(renderBaseline(day));

  // ─── Collapsible sections (weight, body) in user-defined order ───
  const sectionsContainer = el(`<div class="sections-container"></div>`);
  const sectionOrder = getSectionOrder();
  for (const key of sectionOrder) {
    if (key === 'weight') {
      sectionsContainer.appendChild(buildWeightSection(day, exercises, prevWeek));
    } else if (key === 'body') {
      sectionsContainer.appendChild(buildBodySection(day));
    }
  }
  main.appendChild(sectionsContainer);
  enableSectionDragReorder(sectionsContainer, day);

  // ─── Daily totals (outside both sections) ───
  const totalsBlock = el(`
    <div class="daily-totals">
      <div class="volume-row" id="volRow">
        <span class="label">&gt;&gt; dailyWeight_Volume</span>
        <span class="value">
          <span class="vol-arrow"></span><span class="vol-number">${displayVolume(calcDayVolume(currentWeek, day))} ${unitLabel()}</span>
        </span>
      </div>
      <div class="volume-row" id="bodyKcalRow">
        <span class="label">&gt;&gt; dailyBody_Kcal</span>
        <span class="value">
          <span class="vol-arrow"></span><span class="vol-number">${calcDayBodyKcal(currentWeek, day)} kcal</span>
        </span>
      </div>
      <div class="volume-row" id="bodyMassRow">
        <span class="label">&gt;&gt; dailyBody_Mass</span>
        <span class="value">
          <span class="vol-arrow"></span><span class="vol-number">${displayVolume(calcDayBodyMass(currentWeek, day))} ${unitLabel()}</span>
        </span>
      </div>
    </div>
  `);
  main.appendChild(totalsBlock);
  setTimeout(() => {
    updateVolumeRow(day);
    updateBodyKcalRow(day);
    updateBodyMassRow(day);
  }, 0);
}

function buildSectionShell(key, isEmpty) {
  const collapsed = isSectionCollapsed(key);
  const section = el(`
    <div class="collapsible-section${collapsed ? ' collapsed' : ''}${isEmpty ? ' empty-section' : ''}" data-section="${key}">
      <div class="section-header">
        <span class="section-title">${SECTION_LABELS[key]}</span>
      </div>
      <div class="section-body"></div>
    </div>
  `);
  return section;
}

function wireSectionHandlers(section, key) {
  const header = section.querySelector('.section-header');
  header.addEventListener('click', () => {
    if (Date.now() < sectionClickSuppressedUntil) return;
    toggleSectionCollapsed(key);
    const day = currentDay;
    if (day && DAYS[day]) renderDay(day);
  });
}

function enableSectionDragReorder(container, day) {
  let draggingEl = null;
  let longPressTimer = null;
  let placeholder = null;
  let touchOffsetY = 0;
  let startX = 0;
  let startY = 0;

  const startDrag = (section, touch) => {
    draggingEl = section;
    const rect = section.getBoundingClientRect();
    placeholder = document.createElement('div');
    placeholder.className = 'section-drag-placeholder';
    placeholder.style.height = `${section.offsetHeight}px`;
    section.after(placeholder);
    section.classList.add('dragging');
    section.style.position = 'fixed';
    section.style.left = `${rect.left}px`;
    section.style.width = `${rect.width}px`;
    section.style.top = `${touch.clientY - touchOffsetY}px`;
    section.style.zIndex = '1000';
    section.style.pointerEvents = 'none';
    if (navigator.vibrate) navigator.vibrate(15);
  };

  const moveDrag = (touch) => {
    draggingEl.style.top = `${touch.clientY - touchOffsetY}px`;
    const siblings = container.querySelectorAll('.collapsible-section:not(.dragging)');
    for (const r of siblings) {
      const rect = r.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        if (touch.clientY < rect.top + rect.height / 2) {
          r.before(placeholder);
        } else {
          r.after(placeholder);
        }
        return;
      }
    }
  };

  const endDrag = () => {
    draggingEl.classList.remove('dragging');
    draggingEl.removeAttribute('style');
    placeholder.replaceWith(draggingEl);
    placeholder = null;
    draggingEl = null;
    const newOrder = Array.from(container.querySelectorAll('.collapsible-section'))
      .map(s => s.dataset.section)
      .filter(Boolean);
    setSectionOrder(newOrder);
    sectionClickSuppressedUntil = Date.now() + 500;
  };

  container.addEventListener('touchstart', (e) => {
    if (e.target.closest('input, button, select, textarea')) return;
    const header = e.target.closest('.section-header');
    if (!header) return;
    const section = header.closest('.collapsible-section');
    if (!section || !container.contains(section)) return;
    const key = section.dataset.section;
    if (!isSectionCollapsed(key)) return;
    const touch = e.touches[0];
    touchOffsetY = touch.clientY - section.getBoundingClientRect().top;
    startX = touch.clientX;
    startY = touch.clientY;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      startDrag(section, touch);
    }, 300);
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (longPressTimer) {
      const touch = e.touches[0];
      if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      return;
    }
    if (!draggingEl) return;
    e.preventDefault();
    moveDrag(e.touches[0]);
  }, { passive: false });

  const finishTouch = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      return;
    }
    if (draggingEl) endDrag();
  };
  container.addEventListener('touchend', finishTouch);
  container.addEventListener('touchcancel', finishTouch);
}

function buildWeightSection(day, exercises, prevWeek) {
  const section = buildSectionShell('weight', exercises.length === 0);
  const body = section.querySelector('.section-body');

  const exercisesEditRow = el(`
    <div class="exercises-edit-row">
      <div class="exercises-divider"></div>
      <div class="exercises-buttons">
        <button class="btn-exercises-add" data-role="add-exercise">$ add</button>
        <button class="btn-exercises-remove${exercisesEditMode ? ' active' : ''}" data-role="toggle-remove">${exercisesEditMode ? 'done' : '$ remove'}</button>
      </div>
    </div>
  `);
  exercisesEditRow.querySelector('[data-role="add-exercise"]').addEventListener('click', () => {
    openAddModal('weight', day);
  });
  exercisesEditRow.querySelector('[data-role="toggle-remove"]').addEventListener('click', () => {
    exercisesEditMode = !exercisesEditMode;
    renderDay(day);
  });
  body.appendChild(exercisesEditRow);

  if (exercisesEditMode) {
    const editList = el(`<div class="exercises-edit-list"></div>`);

    exercises.forEach(ex => {
      const row = el(`
        <div class="exercise-edit-row" data-ex-name="${ex.name.replace(/"/g, '&quot;')}">
          <span class="drag-grip" aria-hidden="true">⋮⋮</span>
          <input type="text" class="exercise-edit-input" value="${ex.name.replace(/"/g, '&quot;')}">
          <button class="exercise-remove-btn">✕</button>
        </div>
      `);
      const input = row.querySelector('input');
      input.addEventListener('change', e => {
        const ok = renameExerciseOnDay(day, ex.name, e.target.value);
        if (!ok) e.target.value = ex.name;
        renderDay(day);
      });
      row.querySelector('.exercise-remove-btn').addEventListener('click', () => {
        removeExerciseFromDay(day, ex.name);
        renderDay(day);
      });
      editList.appendChild(row);
    });

    enableTouchReorder(editList, (newOrder) => {
      const currentList = getExercisesForDay(day);
      const newList = newOrder
        .map(name => currentList.find(ex => ex.name === name))
        .filter(Boolean);
      setExercisesForDay(day, newList);
    });

    body.appendChild(editList);
    wireSectionHandlers(section, 'weight');
    return section;
  }

  exercises.forEach(ex => {
    const exState = state?.[currentWeek]?.[day]?.exercises?.[ex.name];
    const isCompleted = !!exState?.completed;
    const card = el(`
      <div class="exercise${isCompleted ? ' completed' : ''}">
        <div class="exercise-header">
          <div class="exercise-header-row">
            <div>
              <div class="exercise-name">> ${exKey(ex.name)}</div>
              <div class="exercise-group">${ex.group.toLowerCase()}</div>
            </div>
            <button class="btn-copy-prev" ${prevWeek < 1 ? 'disabled' : ''}>$ prv wk</button>
          </div>
        </div>
        <div class="sets"></div>
      </div>
    `);
    const copyBtn = card.querySelector('.btn-copy-prev');
    if (copyBtn && !copyBtn.disabled) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyPrevWeekSets(day, ex.name);
      });
    }

    const headerRow = card.querySelector('.exercise-header-row');
    let lastTap = 0;
    headerRow.addEventListener('click', (e) => {
      if (e.target.closest('.btn-copy-prev')) return;
      const now = Date.now();
      if (now - lastTap < 350) {
        lastTap = 0;
        toggleExerciseCompleted(card, day, ex.name);
      } else {
        lastTap = now;
      }
    });
    const setsDiv = card.querySelector('.sets');
    for (let s = 0; s < SETS_PER_EX; s++) {
      const set = getSet(currentWeek, day, ex.name, s);
      const setEl = el(`
        <div class="set">
          <div class="set-label">~set_${s+1}</div>
          <div class="input-group">
            <input type="number" inputmode="decimal" placeholder="${unitLabel()}" value="${lbsToDisplay(set.lbs)}" data-field="lbs">
            <div class="stepper-row">
              <button class="stepper minus" data-delta="-1" data-target="lbs">−</button>
              <button class="stepper plus" data-delta="1" data-target="lbs">+</button>
            </div>
          </div>
          <div class="input-group">
            <input type="number" inputmode="decimal" placeholder="reps" value="${set.reps ?? ''}" data-field="reps">
            <div class="stepper-row">
              <button class="stepper minus" data-delta="-1" data-target="reps">−</button>
              <button class="stepper plus" data-delta="1" data-target="reps">+</button>
            </div>
          </div>
        </div>
      `);
      const lbsIn = setEl.querySelector('input[data-field="lbs"]');
      const repsIn = setEl.querySelector('input[data-field="reps"]');
      lbsIn.addEventListener('input', e => {
        setSetField(currentWeek, day, ex.name, s, 'lbs', displayToLbs(e.target.value));
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
          const toStore = target === 'lbs' ? displayToLbs(next) : String(next);
          setSetField(currentWeek, day, ex.name, s, target, toStore);
          updateVolumeRow(day);
        });
      });
      setsDiv.appendChild(setEl);
    }
    body.appendChild(card);
  });

  wireSectionHandlers(section, 'weight');

  // Check if all exercises are already completed on load
  if (exercises.length > 0) {
    const allDone = exercises.every(ex => !!state?.[currentWeek]?.[day]?.exercises?.[ex.name]?.completed);
    if (allDone) section.classList.add('all-completed');
  }

  return section;
}

function buildBodySection(day) {
  const activities = getBodyActivitiesForDay(day);
  const section = buildSectionShell('body', activities.length === 0);
  const bodyEl = section.querySelector('.section-body');

  const editRow = el(`
    <div class="exercises-edit-row">
      <div class="exercises-divider"></div>
      <div class="exercises-buttons">
        <button class="btn-exercises-add" data-role="add-body">$ add</button>
        <button class="btn-exercises-remove${bodyEditMode ? ' active' : ''}" data-role="toggle-remove-body">${bodyEditMode ? 'done' : '$ remove'}</button>
      </div>
    </div>
  `);
  editRow.querySelector('[data-role="add-body"]').addEventListener('click', () => {
    openAddModal('body', day);
  });
  editRow.querySelector('[data-role="toggle-remove-body"]').addEventListener('click', () => {
    bodyEditMode = !bodyEditMode;
    renderDay(day);
  });
  bodyEl.appendChild(editRow);

  if (bodyEditMode) {
    const editList = el(`<div class="exercises-edit-list"></div>`);

    activities.forEach(act => {
      const row = el(`
        <div class="exercise-edit-row" data-ex-name="${act.name.replace(/"/g, '&quot;')}">
          <span class="drag-grip" aria-hidden="true">⋮⋮</span>
          <input type="text" class="exercise-edit-input" value="${act.name.replace(/"/g, '&quot;')}">
          <button class="exercise-remove-btn">✕</button>
        </div>
      `);
      const input = row.querySelector('input');
      input.addEventListener('change', e => {
        const ok = renameBodyActivityOnDay(day, act.name, e.target.value);
        if (!ok) e.target.value = act.name;
        renderDay(day);
      });
      row.querySelector('.exercise-remove-btn').addEventListener('click', () => {
        removeBodyActivityFromDay(day, act.name);
        renderDay(day);
      });
      editList.appendChild(row);
    });

    enableTouchReorder(editList, (newOrder) => {
      const currentList = getBodyActivitiesForDay(day);
      const newList = newOrder
        .map(name => currentList.find(a => a.name === name))
        .filter(Boolean);
      setBodyActivitiesForDay(day, newList);
    });

    bodyEl.appendChild(editList);
    wireSectionHandlers(section, 'body');
    return section;
  }

  if (activities.length === 0) {
    bodyEl.appendChild(el(`<div class="section-placeholder">> no body activities yet. tap <strong>add</strong> to log yoga, swimming, pilates, cardio, hiit, etc.</div>`));
  } else {
    activities.forEach(act => {
      const isKcal = isKcalBodyGroup(act.group);
      let card;
      if (isKcal) {
        card = el(`
          <div class="body-card">
            <div class="body-card-header">
              <div class="body-card-name">&gt; ${exKey(act.name)}</div>
              <div class="body-card-group">${act.group.toLowerCase()}</div>
            </div>
            <div class="body-card-input body-card-kcal">
              <input type="number" inputmode="numeric" placeholder="0" value="${getBodyKcal(currentWeek, day, act.name)}" data-body-field="kcal">
              <span class="body-card-unit">kcal</span>
            </div>
          </div>
        `);
        card.querySelector('input[data-body-field="kcal"]').addEventListener('input', (e) => {
          setBodyKcal(currentWeek, day, act.name, e.target.value);
          updateBodyKcalRow(day);
        });
      } else {
        const massVal = getBodyMass(currentWeek, day, act.name);
        const repsVal = getBodyReps(currentWeek, day, act.name);
        card = el(`
          <div class="body-card">
            <div class="body-card-header">
              <div class="body-card-name">&gt; ${exKey(act.name)}</div>
              <div class="body-card-group">${act.group.toLowerCase()}</div>
            </div>
            <div class="body-card-input body-card-mass">
              <input type="number" inputmode="decimal" placeholder="mass" value="${massVal !== '' ? lbsToDisplay(massVal) : ''}" data-body-field="mass">
              <input type="number" inputmode="numeric" placeholder="reps" value="${repsVal}" data-body-field="reps">
            </div>
          </div>
        `);
        card.querySelector('input[data-body-field="mass"]').addEventListener('input', (e) => {
          setBodyMass(currentWeek, day, act.name, displayToLbs(e.target.value));
          updateBodyMassRow(day);
        });
        card.querySelector('input[data-body-field="reps"]').addEventListener('input', (e) => {
          setBodyReps(currentWeek, day, act.name, e.target.value);
          updateBodyMassRow(day);
        });
      }
      bodyEl.appendChild(card);
    });
  }

  wireSectionHandlers(section, 'body');
  return section;
}

function volumeTrendDirection(day) {
  if (currentWeek < 2) return null;
  const curr = calcDayVolume(currentWeek, day);
  const prev = calcDayVolume(currentWeek - 1, day);
  if (!prev || !curr) return null;
  if (curr > prev) return 'up';
  if (curr < prev) return 'down';
  return null;
}

function updateVolumeRow(day) {
  const v = calcDayVolume(currentWeek, day);
  const numEl = document.querySelector('#volRow .vol-number');
  if (numEl) numEl.textContent = `${displayVolume(v)} ${unitLabel()}`;
  const arrowEl = document.querySelector('#volRow .vol-arrow');
  if (arrowEl) {
    const dir = volumeTrendDirection(day);
    arrowEl.className = `vol-arrow ${dir || ''}`;
    arrowEl.textContent = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '';
  }
}

function bodyActivityGroup(day, name) {
  const list = state.bodyActivities?.[day] || [];
  const match = list.find(a => a.name === name);
  return match?.group || null;
}

function calcDayBodyKcal(week, day) {
  const bodyData = state?.[week]?.[day]?.body;
  if (!bodyData) return 0;
  let total = 0;
  for (const [name, entry] of Object.entries(bodyData)) {
    const group = bodyActivityGroup(day, name);
    if (group && !isKcalBodyGroup(group)) continue;
    const kcal = parseFloat(entry?.kcal) || 0;
    total += kcal;
  }
  return total;
}

function calcDayBodyMass(week, day) {
  const bodyData = state?.[week]?.[day]?.body;
  if (!bodyData) return 0;
  let total = 0;
  for (const [name, entry] of Object.entries(bodyData)) {
    const group = bodyActivityGroup(day, name);
    if (!group || isKcalBodyGroup(group)) continue;
    const mass = parseFloat(entry?.mass) || 0;
    const reps = parseFloat(entry?.reps) || 0;
    total += mass * reps;
  }
  return total;
}

function bodyKcalTrendDirection(day) {
  if (currentWeek < 2) return null;
  const curr = calcDayBodyKcal(currentWeek, day);
  const prev = calcDayBodyKcal(currentWeek - 1, day);
  if (!prev || !curr) return null;
  if (curr > prev) return 'up';
  if (curr < prev) return 'down';
  return null;
}

function bodyMassTrendDirection(day) {
  if (currentWeek < 2) return null;
  const curr = calcDayBodyMass(currentWeek, day);
  const prev = calcDayBodyMass(currentWeek - 1, day);
  if (!prev || !curr) return null;
  if (curr > prev) return 'up';
  if (curr < prev) return 'down';
  return null;
}

function updateBodyKcalRow(day) {
  const v = calcDayBodyKcal(currentWeek, day);
  const numEl = document.querySelector('#bodyKcalRow .vol-number');
  if (numEl) numEl.textContent = `${v} kcal`;
  const arrowEl = document.querySelector('#bodyKcalRow .vol-arrow');
  if (arrowEl) {
    const dir = bodyKcalTrendDirection(day);
    arrowEl.className = `vol-arrow ${dir || ''}`;
    arrowEl.textContent = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '';
  }
}

function updateBodyMassRow(day) {
  const v = calcDayBodyMass(currentWeek, day);
  const numEl = document.querySelector('#bodyMassRow .vol-number');
  if (numEl) numEl.textContent = `${displayVolume(v)} ${unitLabel()}`;
  const arrowEl = document.querySelector('#bodyMassRow .vol-arrow');
  if (arrowEl) {
    const dir = bodyMassTrendDirection(day);
    arrowEl.className = `vol-arrow ${dir || ''}`;
    arrowEl.textContent = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '';
  }
}

const BASELINE_MANUAL_KEY = 'lift_app_baseline_manual';

function getManualBaseline() {
  try {
    return JSON.parse(localStorage.getItem(BASELINE_MANUAL_KEY)) || {};
  } catch {
    return {};
  }
}

function setManualBaselineField(date, field, value) {
  const all = getManualBaseline();
  all[date] ??= {};
  if (value === '' || value == null) {
    delete all[date][field];
    if (Object.keys(all[date]).length === 0) delete all[date];
  } else {
    all[date][field] = Number(value);
  }
  localStorage.setItem(BASELINE_MANUAL_KEY, JSON.stringify(all));
  scheduleBackup();
}

function resolveBaselineValue(date, field) {
  const manual = getManualBaseline()[date]?.[field];
  if (manual != null) return Number(manual);
  const health = getCachedHealth()[date]?.[field];
  return health != null ? Number(health) : null;
}

function updateBaseline(dayName) {
  const date = dayName ? baselineDateForDay(dayName) : yesterdayDateStr();
  const sleep = resolveBaselineValue(date, 'sleep_hrs');
  const steps = resolveBaselineValue(date, 'steps');
  const stand = resolveBaselineValue(date, 'stand_hrs');

  const setValue = (sel, val) => {
    const input = document.querySelector(sel);
    if (!input) return;
    if (input.matches(':focus')) return; // don't clobber while user is typing
    input.value = val ?? '';
  };
  setValue('[data-baseline="sleep_hrs"]', sleep != null ? sleep.toFixed(1) : '');
  setValue('[data-baseline="steps"]', steps != null ? Math.round(steps) : '');
  setValue('[data-baseline="stand_hrs"]', stand != null ? Math.round(stand) : '');

  const setScore = (sel, val) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  };
  setScore('[data-baseline="sleep_score"] .value', scoreSleep(sleep) || '—');
  setScore('[data-baseline="steps_score"] .value', scoreSteps(steps) || '—');
}

function renderBaseline(dayName) {
  const block = el(`
    <div class="habits" data-block="baseline">
      <div class="habits-header">
        <h2>## baseline</h2>
        <button class="info-btn" data-role="baseline-info" aria-label="info">i</button>
      </div>
      <div class="baseline-info" hidden>
        <p>the day you're viewing shows <em>yesterday's</em> sleep, stand, and steps — the apple shortcut pushes each morning so "today" reflects how well you recovered and moved the day before. edit any row to override if shortcuts didn't run.</p>
        <ul>
          <li><strong>sleep</strong> — hours slept last night</li>
          <li><strong>stand</strong> — hours you hit your stand goal (apple watch)</li>
          <li><strong>steps</strong> — total steps logged yesterday</li>
        </ul>
      </div>
      <div class="habit-row">
        <label>$ sleep</label>
        <input type="number" step="0.1" inputmode="decimal" placeholder="—" data-baseline="sleep_hrs">
      </div>
      <div class="habit-row">
        <label>$ stand</label>
        <input type="number" inputmode="numeric" placeholder="—" data-baseline="stand_hrs">
      </div>
      <div class="habit-row">
        <label>$ steps</label>
        <input type="number" inputmode="numeric" placeholder="—" data-baseline="steps">
      </div>
      <div class="vitals-score" data-baseline="sleep_score">
        <span class="label">&gt;&gt; sleep_score</span>
        <span class="value">—</span>
      </div>
      <div class="vitals-score" data-baseline="steps_score">
        <span class="label">&gt;&gt; steps_score</span>
        <span class="value">—</span>
      </div>
    </div>
  `);

  const infoBtn = block.querySelector('[data-role="baseline-info"]');
  const infoPanel = block.querySelector('.baseline-info');
  infoBtn.addEventListener('click', () => {
    infoPanel.hidden = !infoPanel.hidden;
    infoBtn.classList.toggle('active', !infoPanel.hidden);
  });

  const date = dayName ? baselineDateForDay(dayName) : yesterdayDateStr();
  block.querySelectorAll('input[data-baseline]').forEach(input => {
    const field = input.dataset.baseline;
    input.addEventListener('input', e => {
      setManualBaselineField(date, field, e.target.value);
      const sleep = resolveBaselineValue(date, 'sleep_hrs');
      const steps = resolveBaselineValue(date, 'steps');
      const sleepScoreEl = block.querySelector('[data-baseline="sleep_score"] .value');
      const stepsScoreEl = block.querySelector('[data-baseline="steps_score"] .value');
      if (sleepScoreEl) sleepScoreEl.textContent = scoreSleep(sleep) || '—';
      if (stepsScoreEl) stepsScoreEl.textContent = scoreSteps(steps) || '—';
    });
  });

  setTimeout(() => {
    updateBaseline(dayName);
    fetchHealthData().then(() => updateBaseline(dayName)).catch(() => {});
  }, 0);
  return block;
}

function renderMacros(day) {
  const fields = ['protein', 'fiber', 'carb', 'fat'];
  const rows = fields.map(f => `
    <div class="habit-row">
      <label>$ ${f}</label>
      <input type="number" inputmode="numeric" placeholder="g" value="${getMacro(currentWeek, day, f)}" data-macro="${f}">
    </div>
  `).join('');
  const block = el(`
    <div class="habits" data-block="macros">
      <h2>## macros</h2>
      ${rows}
    </div>
  `);
  block.querySelectorAll('input[data-macro]').forEach(input => {
    const field = input.dataset.macro;
    input.addEventListener('input', e => setMacro(currentWeek, day, field, e.target.value));
  });
  return block;
}

// ─── Error display with copy button ───
function showError(title, message) {
  // Remove any existing error modal first
  document.querySelectorAll('.error-modal-backdrop').forEach(n => n.remove());

  const safeMessage = String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const modal = el(`
    <div class="error-modal-backdrop">
      <div class="error-modal">
        <div class="error-modal-header">
          <span class="error-modal-title">✗ ${title}</span>
          <button class="error-modal-close" aria-label="close">✕</button>
        </div>
        <pre class="error-modal-body">${safeMessage}</pre>
        <div class="error-modal-actions">
          <button class="btn error-modal-copy">$ copy_error</button>
          <button class="btn error-modal-ok">$ ok</button>
        </div>
        <div class="error-modal-hint">
          send the copied text to brandon to triage
        </div>
      </div>
    </div>
  `);

  const close = () => modal.remove();
  modal.querySelector('.error-modal-close').addEventListener('click', close);
  modal.querySelector('.error-modal-ok').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  const copyBtn = modal.querySelector('.error-modal-copy');
  copyBtn.addEventListener('click', async () => {
    const fullText = `[${title}]\n${message}\n\n— lift_app @ ${new Date().toISOString()}`;
    try {
      await navigator.clipboard.writeText(fullText);
      copyBtn.textContent = '✓ copied';
      setTimeout(() => { copyBtn.textContent = '$ copy_error'; }, 1800);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = fullText;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); copyBtn.textContent = '✓ copied'; }
      catch { copyBtn.textContent = '✗ copy failed'; }
      ta.remove();
      setTimeout(() => { copyBtn.textContent = '$ copy_error'; }, 1800);
    }
  });

  document.body.appendChild(modal);
}

// ─── Chart.js global polish ───
if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
Chart.defaults.font.family = 'Menlo, monospace';
Chart.defaults.color = '#AAA';
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0,0,0,0.85)';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(40,254,20,0.3)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 4;
Chart.defaults.plugins.tooltip.titleFont = { family: 'Menlo, monospace', size: 11, weight: '600' };
Chart.defaults.plugins.tooltip.bodyFont = { family: 'Menlo, monospace', size: 10 };
Chart.defaults.plugins.tooltip.padding = 8;
// Disable datalabels globally — enable per-chart
Chart.defaults.plugins.datalabels = { display: false };
Chart.defaults.elements.bar.borderRadius = 3;
Chart.defaults.elements.bar.borderSkipped = false;
Chart.defaults.elements.line.borderWidth = 2;
Chart.defaults.elements.point.hoverRadius = 5;

let chartInstances = [];
function destroyCharts() {
  chartInstances.forEach(c => c.destroy());
  chartInstances = [];
}

function enablePinchZoom(wrapper) {
  let scale = 1;
  let originX = 0;
  let originY = 0;
  let panX = 0;
  let panY = 0;
  let startDist = 0;
  let startScale = 1;
  let startPanX = 0;
  let startPanY = 0;
  let startMidX = 0;
  let startMidY = 0;
  let isPinching = false;

  const getDist = (t) => Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
  const getMid = (t) => ({
    x: (t[0].clientX + t[1].clientX) / 2,
    y: (t[0].clientY + t[1].clientY) / 2,
  });

  const applyTransform = () => {
    const canvas = wrapper.querySelector('canvas');
    if (canvas) canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  };

  wrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      isPinching = true;
      startDist = getDist(e.touches);
      startScale = scale;
      const mid = getMid(e.touches);
      startMidX = mid.x;
      startMidY = mid.y;
      startPanX = panX;
      startPanY = panY;
      e.preventDefault();
    }
  }, { passive: false });

  wrapper.addEventListener('touchmove', (e) => {
    if (!isPinching || e.touches.length < 2) return;
    e.preventDefault();
    const dist = getDist(e.touches);
    const mid = getMid(e.touches);
    scale = Math.max(1, Math.min(5, startScale * (dist / startDist)));
    panX = startPanX + (mid.x - startMidX);
    panY = startPanY + (mid.y - startMidY);
    applyTransform();
  }, { passive: false });

  wrapper.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) isPinching = false;
    if (scale <= 1.05) {
      scale = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    }
  });

  return {
    reset: () => {
      scale = 1;
      panX = 0;
      panY = 0;
      const canvas = wrapper.querySelector('canvas');
      if (canvas) canvas.style.transform = '';
    },
  };
}

let activeZoom = null;

function toggleChartFullscreen(container) {
  if (container.classList.contains('fullscreen')) {
    container.classList.remove('fullscreen');
    const overlay = document.getElementById('chartOverlay');
    if (overlay) overlay.remove();
    const closeBtn = container.querySelector('.chart-close-btn');
    if (closeBtn) closeBtn.remove();
    if (activeZoom) { activeZoom.reset(); activeZoom = null; }
    setTimeout(() => {
      const chart = chartInstances.find(c => container.contains(c.canvas));
      if (chart) chart.resize();
    }, 50);
    return;
  }
  const overlay = el(`<div class="chart-fullscreen-overlay" id="chartOverlay"></div>`);
  overlay.addEventListener('click', () => toggleChartFullscreen(container));
  document.body.appendChild(overlay);
  container.classList.add('fullscreen');
  const closeBtn = el(`<button class="chart-close-btn" aria-label="close">✕</button>`);
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleChartFullscreen(container);
  });
  container.insertBefore(closeBtn, container.firstChild);

  const wrapper = container.querySelector('.chart-wrapper');
  if (wrapper) activeZoom = enablePinchZoom(wrapper);

  setTimeout(() => {
    const chart = chartInstances.find(c => container.contains(c.canvas));
    if (chart) chart.resize();
  }, 100);
}

function renderAnalytics() {
  const main = document.getElementById('content');
  main.innerHTML = '';
  destroyCharts();

  const dayNames = Object.keys(DAYS);

  // ── PR Evolution (top of analytics) ──
  const evolutionByDay = computePREvolution();
  const evolutionHtml = evolutionByDay.length === 0
    ? `<div class="pr-empty">> no week-over-week progressions yet — log at least two weeks to start tracking</div>`
    : evolutionByDay.map(({ day, entries }) => `
        <div class="pr-day-group">
          <div class="pr-day-label">## ${day}</div>
          <table class="pr-table">
            <tbody>
              ${entries.map(e => `
                <tr>
                  <td class="pr-name">${exKey(e.name)}</td>
                  <td class="pr-value"><span class="pr-arrow ${e.direction}">${e.direction === 'up' ? '▲' : '▼'}</span>${lbsToDisplay(e.prev.lbs)}×${e.prev.reps} → ${lbsToDisplay(e.curr.lbs)}×${e.curr.reps}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('');

  const prContainer = el(`
    <div class="chart-container" data-chart="pr-evolution">
      <div class="section-title">## pr_evolution</div>
      ${evolutionHtml}
    </div>
  `);
  main.appendChild(prContainer);

  // ── Macros row: averages (left) + stacked chart (right) ──
  const macroOrder = ['protein', 'fiber', 'carb', 'fat'];
  const macroBarColors = {
    protein: '#1E3A8A',
    fiber:   '#2563EB',
    carb:    '#60A5FA',
    fat:     '#93C5FD',
  };
  const trendYellow = '#FFFF55';
  const trendStyles = {
    protein: { borderDash: [],     pointStyle: 'circle',  pointRadius: 0 },
    fiber:   { borderDash: [6, 4], pointStyle: 'circle',  pointRadius: 0 },
    carb:    { borderDash: [2, 3], pointStyle: 'circle',  pointRadius: 0 },
    fat:     { borderDash: [],     pointStyle: 'rectRot', pointRadius: 6 },
  };

  const macroDayLabels = [];
  const macroData = { protein: [], fiber: [], carb: [], fat: [] };
  for (let w = 1; w <= currentWeek; w++) {
    for (const d of dayNames) {
      const vals = {
        protein: parseFloat(getMacro(w, d, 'protein')) || 0,
        fiber:   parseFloat(getMacro(w, d, 'fiber')) || 0,
        carb:    parseFloat(getMacro(w, d, 'carb')) || 0,
        fat:     parseFloat(getMacro(w, d, 'fat')) || 0,
      };
      if (vals.protein + vals.fiber + vals.carb + vals.fat > 0) {
        macroDayLabels.push(`w${String(w).padStart(2,'0')} ${d.slice(0,3)}`);
        macroOrder.forEach(f => macroData[f].push(vals[f]));
      }
    }
  }

  const macroAvgs = {};
  macroOrder.forEach(f => {
    const arr = macroData[f].filter(v => v > 0);
    macroAvgs[f] = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  });

  const macroAvgRowsHtml = macroOrder.map(f =>
    `<div class="macro-avg-chip"><div class="macro-avg-label">${f}</div><div class="macro-avg-value">${macroAvgs[f] != null ? macroAvgs[f] + 'g' : '—'}</div></div>`
  ).join('');

  // ── Water intake average (cups/day) across all logged days ──
  const waterValues = [];
  for (let w = 1; w <= currentWeek; w++) {
    for (const d of Object.keys(DAYS)) {
      const arr = state?.[w]?.[d]?.water;
      if (Array.isArray(arr)) {
        const cups = arr.reduce((a,b) => a + (b || 0), 0);
        if (cups > 0) waterValues.push(cups);
      }
    }
  }
  const avgWater = waterValues.length ? Math.round((waterValues.reduce((a,b) => a+b, 0) / waterValues.length) * 10) / 10 : null;
  const waterPct = avgWater != null ? Math.min(100, Math.round((avgWater / 14) * 100)) : 0;

  const avgRow = el(`
    <div class="avg-row">
      <div class="chart-container avg-macros-box" data-chart="macros-avg">
        <div class="avg-box-title orange">## macros_avg</div>
        <div class="macro-avg-grid">${macroAvgRowsHtml}</div>
      </div>
      <div class="chart-container avg-water-box" data-chart="water-avg">
        <div class="avg-box-title" style="color:#A78BFA">## water_avg</div>
        <div class="water-avg-visual">
          <svg viewBox="0 0 80 96" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <clipPath id="water-avg-clip">
                <path d="M40 6 Q40 6, 66 44 Q74 72, 40 92 Q6 72, 14 44 Q40 6, 40 6 Z"/>
              </clipPath>
              <linearGradient id="water-avg-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#60A5FA"/>
                <stop offset="100%" stop-color="#7C3AED"/>
              </linearGradient>
            </defs>
            <path d="M40 6 Q40 6, 66 44 Q74 72, 40 92 Q6 72, 14 44 Q40 6, 40 6 Z"
              fill="none" stroke="rgba(167,139,250,0.4)" stroke-width="2" stroke-linejoin="round"/>
            <rect x="0" y="${96 - (waterPct * 0.96)}" width="80" height="${waterPct * 0.96}" fill="url(#water-avg-grad)" clip-path="url(#water-avg-clip)" opacity="0.9"/>
            <text x="40" y="56" text-anchor="middle" fill="#FFF" font-family="Menlo, monospace" font-size="20" font-weight="700" style="text-shadow:0 1px 2px rgba(0,0,0,0.7)">${avgWater != null ? avgWater : '—'}</text>
            <text x="40" y="70" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-family="Menlo, monospace" font-size="8" letter-spacing="1">cups/day</text>
          </svg>
        </div>
        <div class="water-avg-caption">target: 14 · ${avgWater != null ? waterPct + '%' : '—'}</div>
      </div>
    </div>
  `);
  main.appendChild(avgRow);

  const macrosContainer = el(`
    <div class="chart-container" data-chart="macros">
      <div class="section-title orange">## macros [grams/day]</div>
      <div class="chart-wrapper" style="height:260px"><canvas id="macrosChart"></canvas></div>
    </div>
  `);
  main.appendChild(macrosContainer);

  // ── Baseline stacked chart: sleep / steps / stand from health feed ──
  // Values are normalized to % of target so they can stack on one axis.
  const SLEEP_TARGET = 8;
  const STEPS_TARGET = 10000;
  const STAND_TARGET = 12;
  const health = getCachedHealth();
  const baselineOrder = ['sleep', 'steps', 'stand'];
  const baselineBarColors = {
    sleep: '#818CF8',
    steps: '#34D399',
    stand: '#FB923C',
  };
  const baselineTrendStyles = {
    sleep: { borderDash: [] },
    steps: { borderDash: [6, 4] },
    stand: { borderDash: [2, 3] },
  };
  const baselineDates = lastNDates(30);
  const baselineLabels = [];
  const baselineData = { sleep: [], steps: [], stand: [] };
  for (const d of baselineDates) {
    const entry = health[d] || {};
    const sleepPct = entry.sleep_hrs != null
      ? Math.round((Number(entry.sleep_hrs) / SLEEP_TARGET) * 100) : 0;
    const stepsPct = entry.steps != null
      ? Math.round((Number(entry.steps) / STEPS_TARGET) * 100) : 0;
    const standPct = entry.stand_hrs != null
      ? Math.round((Number(entry.stand_hrs) / STAND_TARGET) * 100) : 0;
    if (sleepPct + stepsPct + standPct === 0) continue;
    baselineLabels.push(d.slice(5));
    baselineData.sleep.push(sleepPct);
    baselineData.steps.push(stepsPct);
    baselineData.stand.push(standPct);
  }

  const baselineContainer = el(`
    <div class="chart-container" data-chart="baseline">
      <div class="section-title pink">## baseline [% of target]</div>
      <div class="chart-wrapper" style="height:260px"><canvas id="baselineChart"></canvas></div>
    </div>
  `);
  main.appendChild(baselineContainer);

  // Volume area chart: x = days, series = weeks (most recent 12)
  const startWeek = Math.max(1, currentWeek - 11);
  const weekRange = Array.from({length: Math.min(12, currentWeek)}, (_, i) => startWeek + i);

  // Purple shades (pale → bright). Most recent week gets the brightest,
  // matching the #A855F7 used by the weekly_volume_trend chart.
  const PURPLE_SHADES = [
    '#F3E8FF', '#EDE3FC', '#E7DAFB', '#E1D0F9',
    '#D8B4FE', '#CCA5FC', '#C084FC', '#B878FB',
    '#B370F9', '#AE67F8', '#AB5EF8', '#A855F7',
  ];

  // Pre-compute weekly totals for the trend chart (sits in same row)
  const allWeeks = Array.from({length: NUM_WEEKS}, (_, i) => i + 1);
  const sleepLabels = allWeeks.map(w => `w${String(w).padStart(2,'0')}`);
  const volTrendData = allWeeks.map(w => calcWeekTotalVolume(w));

  const weightAnalyticsSection = buildAnalyticsCollapsible('weight', '## [weight]');
  const chartRow = el(`<div class="chart-stack"></div>`);
  weightAnalyticsSection.querySelector('.section-body').appendChild(chartRow);
  main.appendChild(weightAnalyticsSection);

  const volContainer = el(`
    <div class="chart-container" data-chart="volume-by-day">
      <div class="section-title yellow">## volume_by_day [last_12_weeks]</div>
      <div class="chart-wrapper"><canvas id="volChart"></canvas></div>
    </div>
  `);
  chartRow.appendChild(volContainer);

  const volTrendContainer = el(`
    <div class="chart-container" data-chart="weekly-volume">
      <div class="section-title yellow">## weekly_volume_trend</div>
      <div class="chart-wrapper"><canvas id="volTrendChart"></canvas></div>
    </div>
  `);
  chartRow.appendChild(volTrendContainer);

  const volDatasets = weekRange.map((w, i) => {
    const colorIdx = Math.max(0, PURPLE_SHADES.length - weekRange.length + i);
    const color = PURPLE_SHADES[colorIdx];
    return {
      label: `w${String(w).padStart(2,'0')}`,
      data: dayNames.map(d => calcDayVolume(w, d)),
      backgroundColor: color + '55',
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
            color: '#FFFF55',
            font: { family: 'Menlo, monospace', size: 10 },
            boxWidth: 12,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#FFFF55', font: { family: 'Menlo, monospace', size: 11 } },
          grid: { color: 'rgba(255,255,85,0.08)' },
          border: { color: 'rgba(255,255,85,0.3)' },
        },
        y: {
          ticks: { color: '#FFFF55', font: { family: 'Menlo, monospace', size: 10 } },
          grid: { color: 'rgba(255,255,85,0.08)' },
          border: { color: 'rgba(255,255,85,0.3)' },
        },
      },
    },
  }));

  chartInstances.push(new Chart(document.getElementById('volTrendChart'), {
    type: 'line',
    data: {
      labels: sleepLabels,
      datasets: [{
        label: 'total_lbs',
        data: volTrendData,
        borderColor: '#A855F7',
        backgroundColor: 'rgba(168, 85, 247, 0.35)',
        borderWidth: 2,
        fill: true,
        spanGaps: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#A855F7',
        pointBorderColor: '#A855F7',
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
          grid: { color: 'rgba(255,255,85,0.08)' },
          border: { color: 'rgba(255,255,85,0.3)' },
        },
        y: {
          ticks: { color: '#FFFF55', font: { family: 'Menlo, monospace', size: 10 } },
          grid: { color: 'rgba(255,255,85,0.08)' },
          border: { color: 'rgba(255,255,85,0.3)' },
        },
      },
    },
  }));

  // ── [body] analytics section: kcal by day + total weekly mass ──
  const bodyAnalyticsSection = buildAnalyticsCollapsible('body', '## [body]');
  const bodyChartRow = el(`<div class="chart-stack"></div>`);
  bodyAnalyticsSection.querySelector('.section-body').appendChild(bodyChartRow);
  main.appendChild(bodyAnalyticsSection);

  const bodyKcalContainer = el(`
    <div class="chart-container" data-chart="volume-by-day">
      <div class="section-title yellow">## body_kcal_by_day [last_12_weeks]</div>
      <div class="chart-wrapper"><canvas id="bodyKcalChart"></canvas></div>
    </div>
  `);
  bodyChartRow.appendChild(bodyKcalContainer);

  const bodyMassContainer = el(`
    <div class="chart-container" data-chart="weekly-volume">
      <div class="section-title yellow">## body_mass_trend</div>
      <div class="chart-wrapper"><canvas id="bodyMassChart"></canvas></div>
    </div>
  `);
  bodyChartRow.appendChild(bodyMassContainer);

  const bodyKcalDatasets = weekRange.map((w, i) => {
    const colorIdx = Math.max(0, PURPLE_SHADES.length - weekRange.length + i);
    const color = PURPLE_SHADES[colorIdx];
    return {
      label: `w${String(w).padStart(2,'0')}`,
      data: dayNames.map(d => calcDayBodyKcal(w, d)),
      backgroundColor: color + '55',
      borderColor: color,
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: color,
    };
  });

  chartInstances.push(new Chart(document.getElementById('bodyKcalChart'), {
    type: 'line',
    data: { labels: dayNames.map(d => d.slice(0,3)), datasets: bodyKcalDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#FFFF55', font: { family: 'Menlo, monospace', size: 10 }, boxWidth: 12 },
        },
      },
      scales: {
        x: {
          ticks: { color: '#FFFF55', font: { family: 'Menlo, monospace', size: 11 } },
          grid: { color: 'rgba(255,255,85,0.08)' },
          border: { color: 'rgba(255,255,85,0.3)' },
        },
        y: {
          ticks: { color: '#FFFF55', font: { family: 'Menlo, monospace', size: 10 } },
          grid: { color: 'rgba(255,255,85,0.08)' },
          border: { color: 'rgba(255,255,85,0.3)' },
        },
      },
    },
  }));

  const bodyMassTrendData = allWeeks.map(w =>
    dayNames.reduce((sum, d) => sum + calcDayBodyMass(w, d), 0)
  );

  chartInstances.push(new Chart(document.getElementById('bodyMassChart'), {
    type: 'line',
    data: {
      labels: sleepLabels,
      datasets: [{
        label: `total_${unitLabel()}`,
        data: bodyMassTrendData,
        borderColor: '#A855F7',
        backgroundColor: 'rgba(168, 85, 247, 0.35)',
        borderWidth: 2,
        fill: true,
        spanGaps: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#A855F7',
        pointBorderColor: '#A855F7',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#FFFF55', font: { family: 'Menlo, monospace', size: 10 }, boxWidth: 12 },
        },
      },
      scales: {
        x: {
          ticks: { color: '#FFFF55', font: { family: 'Menlo, monospace', size: 9 }, maxRotation: 60, minRotation: 60 },
          grid: { color: 'rgba(255,255,85,0.08)' },
          border: { color: 'rgba(255,255,85,0.3)' },
        },
        y: {
          ticks: { color: '#FFFF55', font: { family: 'Menlo, monospace', size: 10 } },
          grid: { color: 'rgba(255,255,85,0.08)' },
          border: { color: 'rgba(255,255,85,0.3)' },
        },
      },
    },
  }));

  const baselineDatasets = [];
  baselineOrder.forEach(f => {
    baselineDatasets.push({
      type: 'bar',
      label: f,
      data: baselineData[f],
      backgroundColor: baselineBarColors[f],
      borderColor: baselineBarColors[f],
      borderWidth: 1,
    });
  });
  baselineOrder.forEach(f => {
    const s = baselineTrendStyles[f];
    baselineDatasets.push({
      type: 'line',
      label: `${f}_trend`,
      data: linearRegression(baselineData[f]),
      borderColor: '#FFFF55',
      backgroundColor: '#FFFF55',
      borderWidth: 2,
      borderDash: s.borderDash,
      fill: false,
      pointRadius: 0,
      tension: 0,
      yAxisID: 'yTrend',
    });
  });

  chartInstances.push(new Chart(document.getElementById('baselineChart'), {
    type: 'bar',
    data: {
      labels: baselineLabels,
      datasets: baselineDatasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#FFAFCC',
            font: { family: 'Menlo, monospace', size: 10 },
            boxWidth: 12,
            filter: (item) => !item.text.endsWith('_trend'),
          },
        },
        datalabels: {
          display: (ctx) => ctx.dataset.type !== 'line' && ctx.dataset.data[ctx.dataIndex] > 0,
          anchor: 'end',
          align: 'end',
          color: '#FFAFCC',
          font: { family: 'Menlo, monospace', size: 8, weight: '600' },
          formatter: (v) => v > 0 ? v + '%' : '',
          offset: -2,
        },
      },
      scales: {
        x: {
          ticks: { color: '#FFAFCC', font: { family: 'Menlo, monospace', size: 8 }, maxRotation: 60, minRotation: 60 },
          grid: { color: 'rgba(255,175,204,0.08)', lineWidth: 1 },
          border: { color: 'rgba(255,175,204,0.3)' },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#FFAFCC', font: { family: 'Menlo, monospace', size: 9 }, callback: (v) => v + '%' },
          grid: { color: 'rgba(255,175,204,0.1)', lineWidth: 1 },
          border: { color: 'rgba(255,175,204,0.3)' },
        },
        yTrend: {
          position: 'right',
          display: false,
          beginAtZero: true,
        },
      },
    },
  }));

  // Background refresh: after the cached render, pull fresh health data
  // and rebuild the baseline chart once it lands.
  fetchHealthData().then(freshHealth => {
    const freshLabels = [];
    const freshData = { sleep: [], steps: [], stand: [] };
    for (const d of baselineDates) {
      const entry = freshHealth[d] || {};
      const sleepPct = entry.sleep_hrs != null
        ? Math.round((Number(entry.sleep_hrs) / SLEEP_TARGET) * 100) : 0;
      const stepsPct = entry.steps != null
        ? Math.round((Number(entry.steps) / STEPS_TARGET) * 100) : 0;
      const standPct = entry.stand_hrs != null
        ? Math.round((Number(entry.stand_hrs) / STAND_TARGET) * 100) : 0;
      if (sleepPct + stepsPct + standPct === 0) continue;
      freshLabels.push(d.slice(5));
      freshData.sleep.push(sleepPct);
      freshData.steps.push(stepsPct);
      freshData.stand.push(standPct);
    }
    const chart = chartInstances.find(c => c.canvas?.id === 'baselineChart');
    if (!chart) return;
    chart.data.labels = freshLabels;
    chart.data.datasets[0].data = freshData.sleep;
    chart.data.datasets[1].data = freshData.steps;
    chart.data.datasets[2].data = freshData.stand;
    chart.data.datasets[3].data = linearRegression(freshData.sleep);
    chart.data.datasets[4].data = linearRegression(freshData.steps);
    chart.data.datasets[5].data = linearRegression(freshData.stand);
    chart.update();
  }).catch(() => {});

  const macroDatasets = [];
  macroOrder.forEach(f => {
    macroDatasets.push({
      type: 'bar',
      label: f,
      data: macroData[f],
      backgroundColor: macroBarColors[f],
      borderColor: macroBarColors[f],
      borderWidth: 1,
      stack: 'macros',
    });
  });
  macroOrder.forEach(f => {
    const s = trendStyles[f];
    macroDatasets.push({
      type: 'line',
      label: `${f}_trend`,
      data: linearRegression(macroData[f]),
      borderColor: trendYellow,
      backgroundColor: trendYellow,
      borderWidth: 2,
      borderDash: s.borderDash,
      fill: false,
      pointStyle: s.pointStyle,
      pointRadius: s.pointRadius,
      pointBackgroundColor: trendYellow,
      pointBorderColor: trendYellow,
      tension: 0,
      yAxisID: 'yTrend',
    });
  });

  chartInstances.push(new Chart(document.getElementById('macrosChart'), {
    type: 'bar',
    data: {
      labels: macroDayLabels,
      datasets: macroDatasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#FF9933',
            font: { family: 'Menlo, monospace', size: 10 },
            boxWidth: 12,
            filter: (item) => !item.text.endsWith('_trend'),
          },
        },
        datalabels: {
          display: (ctx) => {
            if (ctx.dataset.type === 'line') return false;
            // Only show total on top segment of stacked bar
            const meta = ctx.chart.getDatasetMeta(ctx.datasetIndex);
            if (!meta.stack) return false;
            const stackDatasets = ctx.chart.data.datasets.filter((d,i) => {
              const m = ctx.chart.getDatasetMeta(i);
              return m.stack === meta.stack && !d.type;
            });
            const lastVisible = stackDatasets[stackDatasets.length - 1];
            if (ctx.dataset !== lastVisible) return false;
            // Sum the stacked value
            const total = stackDatasets.reduce((sum, d) => sum + (d.data[ctx.dataIndex] || 0), 0);
            return total > 0;
          },
          anchor: 'end',
          align: 'end',
          color: '#FF9933',
          font: { family: 'Menlo, monospace', size: 8, weight: '600' },
          formatter: (v, ctx) => {
            const stackDatasets = ctx.chart.data.datasets.filter((d,i) => {
              const m = ctx.chart.getDatasetMeta(i);
              return m.stack && !d.type;
            });
            return stackDatasets.reduce((sum, d) => sum + (d.data[ctx.dataIndex] || 0), 0) + 'g';
          },
          offset: -2,
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: '#FF9933', font: { family: 'Menlo, monospace', size: 8 }, maxRotation: 60, minRotation: 60 },
          grid: { color: 'rgba(255,153,51,0.08)', lineWidth: 1 },
          border: { color: 'rgba(255,153,51,0.3)' },
        },
        y: {
          stacked: true,
          position: 'left',
          beginAtZero: true,
          ticks: { color: '#FF9933', font: { family: 'Menlo, monospace', size: 9 }, callback: (v) => v + 'g' },
          grid: { color: 'rgba(255,153,51,0.1)', lineWidth: 1 },
          border: { color: 'rgba(255,153,51,0.3)' },
        },
        yTrend: {
          position: 'right',
          display: false,
          beginAtZero: true,
        },
      },
    },
  }));

  // Wire tap-to-fullscreen on chart titles only (so the chart canvas stays interactive)
  main.querySelectorAll('.chart-container').forEach(container => {
    if (!container.querySelector('canvas')) return;
    const title = container.querySelector('.section-title');
    if (!title) return;
    title.style.cursor = 'pointer';
    title.addEventListener('click', (e) => {
      e.stopPropagation();
      if (container.classList.contains('fullscreen')) return;
      toggleChartFullscreen(container);
    });
  });
}

function renderSettings() {
  const main = document.getElementById('content');
  main.innerHTML = '';
  destroyCharts();

  // ── Weight unit toggle (yellow) ──
  const unitBlock = el(`
    <div class="settings" data-box="units">
      <div class="section-title">## unit // weight_display</div>
      <div class="settings-help" style="margin-bottom:12px">
        switch between pounds and kilograms. all historical data is stored in lbs canonically and converted on display, so toggling is reversible with no data loss.
      </div>
      <div class="unit-toggle">
        <button class="btn unit-btn${getUnit() === 'lb' ? ' active' : ''}" data-unit="lb">$ lb</button>
        <button class="btn unit-btn${getUnit() === 'kg' ? ' active' : ''}" data-unit="kg">$ kg</button>
      </div>
    </div>
  `);
  unitBlock.querySelectorAll('.unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setUnit(btn.dataset.unit);
      renderSettings();
    });
  });

  // ── GitHub auto-backup (green) ──
  const cfg = getBackupCfg();
  const ghBlock = el(`
    <div class="settings" data-box="github">
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
    if (cfg.last_error) showError('Backup failed', cfg.last_error);
    else alert('Backed up at ' + new Date().toLocaleTimeString());
  });
  ghBlock.querySelector('.btn-restore').addEventListener('click', restoreFromGithub);

  // ── Danger zone (red) ──
  const dangerBlock = el(`
    <div class="settings" data-box="danger">
      <div class="section-title">## danger_zone</div>
      <div class="settings-help" style="margin-bottom:12px">
        wipe local state entirely. this cannot be undone. the github backup (if enabled) remains intact.
      </div>
      <div class="settings-buttons">
        <button class="btn btn-danger">$ wipe_all</button>
      </div>
    </div>
  `);
  dangerBlock.querySelector('.btn-danger').addEventListener('click', clearAllData);

  // Make each box collapsible, defaulting to collapsed on every render.
  makeCollapsibleSettingsBox(ghBlock);
  makeCollapsibleSettingsBox(unitBlock);
  makeCollapsibleSettingsBox(dangerBlock);

  // Traffic-light order: green → yellow → red
  main.appendChild(ghBlock);
  main.appendChild(unitBlock);
  main.appendChild(dangerBlock);
  setTimeout(updateBackupStatus, 0);
}

function makeCollapsibleSettingsBox(box) {
  const title = box.querySelector('.section-title');
  if (!title) return;
  const body = document.createElement('div');
  body.className = 'settings-body';
  let next = title.nextElementSibling;
  while (next) {
    const toMove = next;
    next = next.nextElementSibling;
    body.appendChild(toMove);
  }
  box.appendChild(body);
  box.classList.add('collapsible-settings');
  title.addEventListener('click', () => {
    box.classList.toggle('expanded');
  });
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
        showError('Import failed', err.message || err);
      } finally {
        if (document.body.contains(input)) document.body.removeChild(input);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ─── CSV template + parser + importer ───
function generateCSVTemplate() {
  return [
    '# lift-track-vibe — csv import template',
    '#',
    '# each row represents one day of training. the `section` column tells',
    '# the importer whether the row is strength training (weight) or body',
    '# activity (yoga, swimming, cardio, etc.). rows are processed in order.',
    '#',
    '# -------- WEIGHT row format --------',
    '#   section,week,day,exercise,group,weight,set,reps,set,reps,set,reps[,exercise,group,weight,set,reps,...]',
    '#   - one `weight` per exercise (all sets use the same load)',
    '#   - repeat [exercise,group,weight,set,reps,...] blocks for more exercises on the same day',
    '#   - add as many set/reps pairs as sets performed (min 1)',
    '#',
    '# -------- BODY row format --------',
    '#   section,week,day,activity,group,minutes',
    '#   - body rows log time-based activities, not weight/reps',
    '#',
    '# DAYS: monday, tuesday, wednesday, thursday, friday, saturday, sunday',
    '#',
    '# WEIGHT groups: Chest, Back, Shoulders, Biceps, Triceps, Legs, Glutes, Core, Forearms',
    '# BODY groups:   Yoga, Swimming, Pilates, Cardio, HIIT, Calisthenics, Resistance,',
    '#                Chest, Back, Shoulders, Biceps, Triceps, Legs, Glutes, Core, Forearms',
    '#',
    '# REST DAYS: omit the row entirely, or include one with just section,week,day filled',
    '# WEIGHT is in pounds. toggle to kg in settings after import if desired.',
    '#',
    '# Sample data: a full week (monday → next monday) with one rest day and a body activity.',
    '# Notice saturday has no row — it\'s a rest day.',
    '#',
    'section,week,day,exercise,group,weight,set,reps,set,reps,set,reps,exercise,group,weight,set,reps,set,reps,set,reps,exercise,group,weight,set,reps,set,reps,set,reps',
    'weight,1,monday,Bench Press,Chest,135,1,10,2,10,3,8,Pull Up,Back,0,1,10,2,10,3,8,Deadlift,Legs,225,1,5,2,5,3,5',
    'weight,1,tuesday,Incline DB,Chest,60,1,12,2,12,3,10,Lat Pulldown,Back,150,1,12,2,12,3,10',
    'body,1,tuesday,Yoga Flow,Yoga,30',
    'weight,1,wednesday,Chest Press,Chest,95,1,10,2,10,3,10,Barbell Row,Back,95,1,8,2,8,3,8',
    'weight,1,thursday,Pec Fly,Chest,80,1,12,2,12,3,12,Lat Pulldown,Back,160,1,10,2,10,3,10',
    'weight,1,friday,Bench Press,Chest,140,1,10,2,10,3,8,Deadlift,Legs,235,1,5,2,5,3,5',
    '# saturday = rest day — row omitted entirely',
    'body,1,sunday,Long Run,Cardio,45',
    'weight,2,monday,Bench Press,Chest,140,1,10,2,10,3,10,Pull Up,Back,0,1,10,2,10,3,10,Deadlift,Legs,235,1,5,2,5,3,5',
  ].join('\n');
}

function downloadCSVTemplate() {
  const text = generateCSVTemplate();
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lift-track-vibe-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function validateAndImportCSV(text) {
  const rawLines = text.split(/\r?\n/);
  const rows = [];
  rawLines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('#')) return;
    rows.push({ lineNumber: i + 1, fields: parseCSVLine(line) });
  });

  if (rows.length === 0) {
    return { success: false, errors: [{ message: 'file is empty or contains only comments' }] };
  }

  const header = rows[0];
  const headerStart = header.fields.slice(0, 3).map(s => (s || '').toLowerCase());
  if (headerStart[0] !== 'section' || headerStart[1] !== 'week' || headerStart[2] !== 'day') {
    return {
      success: false,
      errors: [{ message: `line ${header.lineNumber}: expected header to start with 'section,week,day' — got '${header.fields.slice(0,3).join(',')}'` }],
    };
  }

  const errors = [];
  const staged = JSON.parse(JSON.stringify(state));
  const dayNames = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  let weightImports = 0, bodyImports = 0;

  for (let i = 1; i < rows.length; i++) {
    const { lineNumber, fields } = rows[i];
    const section = (fields[0] || '').toLowerCase();
    const weekStr = fields[1];
    const day = (fields[2] || '').toLowerCase();

    if (!section && !weekStr && !day) continue;

    if (section !== 'weight' && section !== 'body') {
      errors.push({ line: lineNumber, col: 1, message: `invalid section '${fields[0] || ''}' (expected 'weight' or 'body')` });
      continue;
    }
    const week = parseInt(weekStr, 10);
    if (isNaN(week) || week < 1) {
      errors.push({ line: lineNumber, col: 2, message: `invalid week '${weekStr || ''}' (must be a positive integer)` });
      continue;
    }
    if (!dayNames.includes(day)) {
      errors.push({ line: lineNumber, col: 3, message: `invalid day '${fields[2] || ''}' (must be monday..sunday)` });
      continue;
    }

    // Rest-day row (section/week/day only, everything else blank) → accept + skip
    if (fields.slice(3).every(v => !v)) continue;

    if (section === 'weight') {
      let c = 3;
      const parsedExercises = [];
      let rowHasError = false;
      while (c < fields.length && fields[c]) {
        const name = fields[c];
        const group = fields[c + 1];
        const weightStr = fields[c + 2];
        if (!group) {
          errors.push({ line: lineNumber, col: c + 2, message: `missing group for exercise '${name}'` });
          rowHasError = true;
          break;
        }
        if (!EXERCISE_GROUPS.includes(group)) {
          errors.push({ line: lineNumber, col: c + 2, message: `invalid weight group '${group}' for '${name}' (allowed: ${EXERCISE_GROUPS.join(', ')})` });
          rowHasError = true;
          break;
        }
        const weightNum = parseFloat(weightStr);
        if (weightStr === '' || weightStr == null || isNaN(weightNum)) {
          errors.push({ line: lineNumber, col: c + 3, message: `invalid weight '${weightStr || ''}' for '${name}'` });
          rowHasError = true;
          break;
        }
        const sets = [];
        let p = c + 3;
        while (p + 1 < fields.length && /^\d+$/.test(fields[p]) && fields[p + 1] !== '') {
          const repsNum = parseFloat(fields[p + 1]);
          if (isNaN(repsNum)) {
            errors.push({ line: lineNumber, col: p + 2, message: `invalid reps '${fields[p + 1]}' for '${name}' set ${fields[p]}` });
            rowHasError = true;
            break;
          }
          sets.push({ lbs: weightNum, reps: repsNum });
          p += 2;
        }
        if (rowHasError) break;
        if (sets.length === 0) {
          errors.push({ line: lineNumber, col: c + 4, message: `no sets logged for '${name}' — need at least one set/reps pair` });
          rowHasError = true;
          break;
        }
        parsedExercises.push({ name, group, sets });
        c = p;
      }
      if (rowHasError || parsedExercises.length === 0) continue;

      staged[week] ??= {};
      staged[week][day] ??= { exercises: {}, habits: {} };
      staged[week][day].exercises ??= {};
      parsedExercises.forEach(ex => {
        staged[week][day].exercises[ex.name] = {
          sets: ex.sets.map(s => ({ lbs: String(s.lbs), reps: String(s.reps) })),
        };
      });
      staged.exercises ??= {};
      staged.exercises[day] ??= (DAYS[day] || []).map(x => ({ ...x }));
      parsedExercises.forEach(ex => {
        if (!staged.exercises[day].some(x => x.name === ex.name)) {
          staged.exercises[day].push({ name: ex.name, group: ex.group });
        }
      });
      weightImports++;
    } else {
      const name = fields[3];
      const group = fields[4];
      const minutesStr = fields[5];
      if (!name) {
        errors.push({ line: lineNumber, col: 4, message: `missing activity name` });
        continue;
      }
      if (!group) {
        errors.push({ line: lineNumber, col: 5, message: `missing group for '${name}'` });
        continue;
      }
      if (!BODY_GROUPS.includes(group)) {
        errors.push({ line: lineNumber, col: 5, message: `invalid body group '${group}' for '${name}' (allowed: ${BODY_GROUPS.join(', ')})` });
        continue;
      }
      const minutes = parseFloat(minutesStr);
      if (isNaN(minutes) || minutes < 0) {
        errors.push({ line: lineNumber, col: 6, message: `invalid minutes '${minutesStr || ''}' for '${name}'` });
        continue;
      }
      staged.bodyActivities ??= {};
      staged.bodyActivities[day] ??= [];
      if (!staged.bodyActivities[day].some(a => a.name === name)) {
        staged.bodyActivities[day].push({ name, group });
      }
      staged[week] ??= {};
      staged[week][day] ??= { exercises: {}, habits: {} };
      staged[week][day].body ??= {};
      staged[week][day].body[name] = { minutes };
      bodyImports++;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  state = staged;
  saveState();
  return { success: true, weightImports, bodyImports };
}

function importCSVFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'text/csv,.csv';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', e => {
    const file = e.target.files?.[0];
    document.body.removeChild(input);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = validateAndImportCSV(ev.target.result);
      showImportFeedback(result);
    };
    reader.readAsText(file);
  });
  input.click();
}

function showImportFeedback(result) {
  const csvBlock = document.getElementById('csvBlock');
  const feedback = document.getElementById('importFeedback');
  if (!csvBlock || !feedback) return;

  if (result.success) {
    csvBlock.classList.remove('flash-error');
    void csvBlock.offsetWidth;
    csvBlock.classList.add('flash-success');
    feedback.hidden = false;
    feedback.className = 'import-feedback success';
    const total = (result.weightImports || 0) + (result.bodyImports || 0);
    feedback.innerHTML = `<strong>✓ import successful</strong><br>imported ${total} row${total === 1 ? '' : 's'} (${result.weightImports} weight, ${result.bodyImports} body)`;
    setTimeout(() => csvBlock.classList.remove('flash-success'), 1600);
  } else {
    csvBlock.classList.remove('flash-success');
    void csvBlock.offsetWidth;
    csvBlock.classList.add('flash-error');
    feedback.hidden = false;
    feedback.className = 'import-feedback error';
    const lines = result.errors.slice(0, 12).map(err => {
      if (err.line != null && err.col != null) return `line ${err.line}, col ${err.col}: ${err.message}`;
      if (err.line != null) return `line ${err.line}: ${err.message}`;
      return err.message;
    });
    const more = result.errors.length > 12 ? `<br>… (+${result.errors.length - 12} more)` : '';
    feedback.innerHTML = `<strong>✗ import failed — no data was changed</strong><br>${lines.join('<br>')}${more}<br><button class="btn inline-copy-btn" style="margin-top:8px">$ copy_error</button>`;
    const copyBtn = feedback.querySelector('.inline-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const fullText = `[CSV import failed]\n${lines.join('\n')}\n\n— lift_app @ ${new Date().toISOString()}`;
        try { await navigator.clipboard.writeText(fullText); copyBtn.textContent = '✓ copied'; }
        catch { copyBtn.textContent = '✗ copy failed'; }
        setTimeout(() => { copyBtn.textContent = '$ copy_error'; }, 1800);
      });
    }
    setTimeout(() => csvBlock.classList.remove('flash-error'), 1600);
  }
}

function renderImport() {
  const main = document.getElementById('content');
  main.innerHTML = '';
  destroyCharts();

  const jsonBlock = el(`
    <div class="settings">
      <div class="section-title">## json_backup // manual</div>
      <div class="settings-help" style="margin-bottom:12px">
        export a json snapshot of all state, or import a previous backup file.<br>
        import <strong>replaces</strong> all current data — use with care.
      </div>
      <div class="settings-buttons">
        <button class="btn btn-export">$ export_json</button>
        <button class="btn btn-import">$ import_json</button>
      </div>
    </div>
  `);
  jsonBlock.querySelector('.btn-export').addEventListener('click', exportData);
  jsonBlock.querySelector('.btn-import').addEventListener('click', importData);
  main.appendChild(jsonBlock);

  const csvBlock = el(`
    <div class="settings" id="csvBlock">
      <div class="section-title">## csv_import // spreadsheet</div>
      <div class="settings-help" style="margin-bottom:12px">
        import workouts and body activities from a spreadsheet. download the template first — it includes full instructions, the row format, and sample data covering a full week (with a rest day and a body activity).<br>
        csv import <strong>merges</strong> with existing data. errors are reported by line/column and no data is written unless the entire file is valid.
      </div>
      <div class="settings-buttons">
        <button class="btn btn-csv-template">$ download template</button>
        <button class="btn btn-csv-import">$ import csv</button>
      </div>
      <div class="import-feedback" id="importFeedback" hidden></div>
    </div>
  `);
  csvBlock.querySelector('.btn-csv-template').addEventListener('click', downloadCSVTemplate);
  csvBlock.querySelector('.btn-csv-import').addEventListener('click', importCSVFile);
  main.appendChild(csvBlock);

  const cacheBlock = el(`
    <div class="settings" id="cacheBlock">
      <div class="section-title">## clear_cache // troubleshooting</div>
      <div class="settings-help" style="margin-bottom:12px">
        clears the service worker cache and cached health data so the app reloads fresh from the server on next visit. use this after a deploy if the app feels stuck on an old version or health baseline data looks stale.<br>
        <strong>this does not delete your workout data, macros, habits, or backup config.</strong> it only removes:
        <ul style="margin:6px 0 0 16px;padding:0;list-style:disc">
          <li>service worker cached files (html, css, js)</li>
          <li>cached health/baseline data from apple shortcuts</li>
        </ul>
        the app will re-fetch everything on next load.
      </div>
      <div class="settings-buttons">
        <button class="btn btn-clear-cache">$ clear_cache</button>
      </div>
      <div class="import-feedback" id="cacheFeedback" hidden></div>
    </div>
  `);
  cacheBlock.querySelector('.btn-clear-cache').addEventListener('click', async () => {
    const fb = document.getElementById('cacheFeedback');
    try {
      // 1. Nuke all service worker caches
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      // 2. Unregister the service worker so it re-installs fresh
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      // 3. Clear cached health data
      localStorage.removeItem(HEALTH_CACHE_KEY);
      localStorage.removeItem(BASELINE_MANUAL_KEY);
      localStorage.removeItem(GROUP_WORKED_KEY);
      fb.hidden = false;
      fb.className = 'import-feedback success';
      fb.innerHTML = '<strong>done.</strong> cache cleared — reload the app to pull fresh files.';
    } catch (e) {
      showError('Clear cache failed', e.message || e);
    }
  });
  main.appendChild(cacheBlock);
}

// ─── Calendar / Habit Tracker ───
let calViewMonth = new Date().getMonth();
let calViewYear = new Date().getFullYear();

const HABIT_MILESTONES = [
  { day: 1,  msg: 'day one — the hardest step is starting',       level: 'small' },
  { day: 3,  msg: 'three days — withdrawal peak is passing',      level: 'small' },
  { day: 7,  msg: 'one week — cravings are weakening',            level: 'medium' },
  { day: 14, msg: 'two weeks — your body is healing',             level: 'large' },
  { day: 21, msg: 'three weeks — new neural pathways forming',    level: 'large' },
  { day: 30, msg: '30 days — habit killed 🏆',                    level: 'epic' },
  { day: 45, msg: '45 days — you\'re free',                       level: 'epic' },
];

function isDateMarked(date) {
  return state.habitCalendar?.[date] != null;
}

function getIntensity(date) {
  const v = state.habitCalendar?.[date];
  if (v === true) return null;
  return typeof v === 'number' ? v : null;
}

function intensityColor(level) {
  const map = { 1: '#28FE14', 2: '#86EFAC', 3: '#FFFF55', 4: '#FF9933', 5: '#FF6E6E' };
  return map[level] || '#28FE14';
}

function calcStreak() {
  const data = state.habitCalendar || {};
  let streak = 0;
  const d = new Date();
  if (!isDateMarked(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (isDateMarked(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calcBestStreak() {
  const dates = Object.keys(state.habitCalendar || {}).filter(d => isDateMarked(d)).sort();
  if (dates.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    if (diff === 1) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

function calcTotalMarkedDays() {
  return Object.keys(state.habitCalendar || {}).filter(d => isDateMarked(d)).length;
}

function calcSavings() {
  const cost = state.habitTracker?.dailyCost || 0;
  return calcTotalMarkedDays() * cost;
}

function spawnFireworks(cell, level) {
  const rect = cell.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = ['#FF6E6E','#FFAFCC','#FF9933','#FFFF55','#28FE14','#55FFFF','#A855F7'];
  const counts = { small: 10, medium: 20, large: 30, epic: 45 };
  const radii = { small: 35, medium: 55, large: 75, epic: 100 };
  const count = counts[level] || counts.small;
  const maxR = radii[level] || radii.small;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'firework-particle';
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const dist = maxR * 0.4 + Math.random() * maxR * 0.6;
    const size = 3 + Math.random() * 4;
    const dur = 0.6 + Math.random() * 0.5;
    p.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;background:${colors[i % colors.length]};border-radius:1px;z-index:200;pointer-events:none;animation:firework-fly ${dur}s ease-out forwards;--dx:${Math.cos(angle)*dist}px;--dy:${Math.sin(angle)*dist}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), dur * 1000 + 100);
  }

  if (level === 'epic') {
    const flash = el(`<div class="epic-flash"></div>`);
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1600);
  }
}

function renderHabitSetup() {
  const main = document.getElementById('content');
  main.innerHTML = '';
  destroyCharts();

  const setup = el(`
    <div class="habit-setup">
      <div class="habit-setup-title">let's track a habit . . .</div>
      <div class="habit-setup-subtitle">what are you trying to quit:</div>
      <div class="habit-presets">
        <button class="habit-preset" data-habit="drinking" data-icon="🍺">
          <span class="habit-preset-icon">🍺</span>
          <span class="habit-preset-label">drinking</span>
        </button>
        <button class="habit-preset" data-habit="smoking" data-icon="🚬">
          <span class="habit-preset-icon">🚬</span>
          <span class="habit-preset-label">smoking</span>
        </button>
        <button class="habit-preset" data-habit="biting nails" data-icon="💅">
          <span class="habit-preset-icon">💅</span>
          <span class="habit-preset-label">biting nails</span>
        </button>
        <button class="habit-preset" data-habit="eating junk food" data-icon="🍔">
          <span class="habit-preset-icon">🍔</span>
          <span class="habit-preset-label">eating junk food</span>
        </button>
      </div>
      <div class="habit-custom">
        <input type="text" class="habit-custom-input" placeholder="or type your own..." autocapitalize="off" autocorrect="off" spellcheck="false">
        <button class="habit-custom-btn">$ go</button>
      </div>
      <div class="habit-cost-section" hidden>
        <div class="habit-cost-label">how much did this cost you per day? (optional)</div>
        <div class="habit-cost-row">
          <span class="habit-cost-prefix">$</span>
          <input type="number" inputmode="decimal" placeholder="0" class="habit-cost-input">
          <span class="habit-cost-suffix">/ day</span>
        </div>
        <button class="habit-cost-go">$ start tracking</button>
      </div>
    </div>
  `);

  const showCostStep = (name, icon) => {
    setup.querySelector('.habit-presets').hidden = true;
    setup.querySelector('.habit-custom').hidden = true;
    setup.querySelector('.habit-setup-subtitle').hidden = true;
    setup.querySelector('.habit-setup-title').textContent = `${icon} quitting: ${name}`;
    setup.querySelector('.habit-cost-section').hidden = false;

    const goBtn = setup.querySelector('.habit-cost-go');
    const costInput = setup.querySelector('.habit-cost-input');
    const doStart = () => {
      const dailyCost = parseFloat(costInput?.value) || 0;
      state.habitTracker = {
        habit: name,
        icon: icon || '🎯',
        startDate: new Date().toISOString().slice(0, 10),
        goalDays: 30,
        dailyCost,
      };
      state.habitCalendar ??= {};
      saveState();
      renderCalendar();
    };
    goBtn.addEventListener('click', doStart);
    costInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doStart(); } });
  };

  setup.querySelectorAll('.habit-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      showCostStep(btn.dataset.habit, btn.dataset.icon);
    });
  });

  const customInput = setup.querySelector('.habit-custom-input');
  const customBtn = setup.querySelector('.habit-custom-btn');
  const doCustom = () => {
    const name = customInput.value.trim();
    if (!name) { customInput.classList.add('invalid'); setTimeout(() => customInput.classList.remove('invalid'), 600); return; }
    showCostStep(name, '🎯');
  };
  customBtn.addEventListener('click', doCustom);
  customInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doCustom(); } });

  main.appendChild(setup);
}

function renderCalendar() {
  if (!state.habitTracker) {
    renderHabitSetup();
    return;
  }

  const main = document.getElementById('content');
  main.innerHTML = '';
  destroyCharts();

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const firstDay = new Date(calViewYear, calViewMonth, 1);
  const lastDay = new Date(calViewYear, calViewMonth + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const streak = calcStreak();
  const { habit, icon, goalDays } = state.habitTracker;
  const pct = Math.min(100, Math.round((streak / goalDays) * 100));
  const goalReached = streak >= goalDays;

  state.habitCalendar ??= {};

  const bestStreak = calcBestStreak();
  const totalDays = calcTotalMarkedDays();
  const savings = calcSavings();
  const showSavings = (state.habitTracker.dailyCost || 0) > 0;
  const isRelapsed = streak === 0 && bestStreak > 0;

  let gridHtml = '';
  for (let i = 0; i < startDow; i++) gridHtml += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calViewYear}-${String(calViewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const marked = isDateMarked(dateStr);
    const intensity = getIntensity(dateStr);
    const isFuture = new Date(calViewYear, calViewMonth, d) > now;
    const intStyle = (marked && intensity) ? ` style="background:${intensityColor(intensity)}33;border-color:${intensityColor(intensity)}"` : '';
    gridHtml += `<div class="cal-cell${isToday ? ' today' : ''}${marked ? ' marked' : ''}${isFuture ? ' future' : ''}" data-date="${dateStr}"${intStyle}><span class="cal-day">${d}</span></div>`;
  }

  const calEl = el(`
    <div class="calendar-view">
      <div class="habit-banner">
        <span class="habit-banner-icon">${icon}</span>
        <span class="habit-banner-name">quitting: ${habit}</span>
        <button class="habit-reset-btn" data-role="reset-habit">✕</button>
      </div>
      ${isRelapsed ? `<div class="habit-relapse">> you made it ${bestStreak} day${bestStreak !== 1 ? 's' : ''} — that's still progress. keep going.</div>` : ''}
      <div class="habit-progress-wrap">
        <div class="habit-progress-bar-bg">
          <div class="habit-progress-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="habit-progress-label">${goalReached ? '🎉 goal reached!' : `day ${streak} of ${goalDays}`}</div>
      </div>
      <div class="habit-stats-row">
        <div class="habit-stat">
          <span class="habit-stat-num">${streak}</span>
          <span class="habit-stat-label">current</span>
        </div>
        <div class="habit-stat">
          <span class="habit-stat-num">${bestStreak}</span>
          <span class="habit-stat-label">best</span>
        </div>
        <div class="habit-stat">
          <span class="habit-stat-num">${totalDays}</span>
          <span class="habit-stat-label">total</span>
        </div>
        ${showSavings ? `<div class="habit-stat savings"><span class="habit-stat-num">$${savings.toFixed(0)}</span><span class="habit-stat-label">saved</span></div>` : ''}
      </div>
      <div class="cal-header">
        <button class="cal-nav" data-dir="-1">‹</button>
        <span class="cal-month">${monthNames[calViewMonth]} ${calViewYear}</span>
        <button class="cal-nav" data-dir="1">›</button>
      </div>
      <div class="cal-grid">
        <div class="cal-dow">S</div><div class="cal-dow">M</div><div class="cal-dow">T</div><div class="cal-dow">W</div><div class="cal-dow">T</div><div class="cal-dow">F</div><div class="cal-dow">S</div>
        ${gridHtml}
      </div>
      <div class="intensity-picker" id="intensityPicker" hidden>
        <div class="intensity-label">how hard was today?</div>
        <div class="intensity-buttons">
          <button data-level="1" style="color:#28FE14;border-color:#28FE14">1</button>
          <button data-level="2" style="color:#86EFAC;border-color:#86EFAC">2</button>
          <button data-level="3" style="color:#FFFF55;border-color:#FFFF55">3</button>
          <button data-level="4" style="color:#FF9933;border-color:#FF9933">4</button>
          <button data-level="5" style="color:#FF6E6E;border-color:#FF6E6E">5</button>
        </div>
      </div>
      <div class="cal-message" id="calMessage" hidden>congratulations — another day!</div>
      <div class="craving-trend" id="cravingTrend">
        <div class="section-title" style="color:var(--fg-dim);font-size:11px;margin-bottom:6px">> craving_trend</div>
        <div class="chart-wrapper" style="height:100px"><canvas id="cravingChart"></canvas></div>
      </div>
    </div>
  `);

  calEl.querySelectorAll('.cal-nav').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = parseInt(btn.dataset.dir);
      calViewMonth += dir;
      if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
      if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
      renderCalendar();
    });
  });

  const picker = calEl.querySelector('#intensityPicker');
  let pendingCell = null;
  let pendingDate = null;

  function commitMark(intensity) {
    if (!pendingDate || !pendingCell) return;
    state.habitCalendar[pendingDate] = intensity;
    saveState();

    const cell = pendingCell;
    cell.classList.add('marked', 'celebrating');
    cell.style.background = `${intensityColor(intensity)}33`;
    cell.style.borderColor = intensityColor(intensity);

    const s = calcStreak();
    const milestone = HABIT_MILESTONES.slice().reverse().find(m => m.day === s);
    const level = milestone ? milestone.level : 'small';

    spawnFireworks(cell, level);
    if (navigator.vibrate) navigator.vibrate(level === 'epic' ? [30, 50, 30] : 15);

    const msg = document.getElementById('calMessage');
    if (msg) {
      msg.textContent = milestone ? milestone.msg : 'congratulations — another day!';
      msg.hidden = false;
      msg.classList.remove('cal-msg-show');
      void msg.offsetWidth;
      msg.classList.add('cal-msg-show');
      setTimeout(() => { msg.classList.remove('cal-msg-show'); setTimeout(() => { msg.hidden = true; }, 300); }, 2800);
    }

    // Update stats
    const updateStat = (sel, val) => { const e = calEl.querySelector(sel); if (e) e.textContent = val; };
    updateStat('.habit-stats-row .habit-stat:nth-child(1) .habit-stat-num', s);
    updateStat('.habit-stats-row .habit-stat:nth-child(2) .habit-stat-num', calcBestStreak());
    updateStat('.habit-stats-row .habit-stat:nth-child(3) .habit-stat-num', calcTotalMarkedDays());
    const savingsEl = calEl.querySelector('.habit-stat.savings .habit-stat-num');
    if (savingsEl) savingsEl.textContent = `$${calcSavings().toFixed(0)}`;

    const fill = calEl.querySelector('.habit-progress-bar-fill');
    const pLabel = calEl.querySelector('.habit-progress-label');
    if (fill) fill.style.width = `${Math.min(100, Math.round((s / goalDays) * 100))}%`;
    if (pLabel) pLabel.textContent = s >= goalDays ? '🎉 goal reached!' : `day ${s} of ${goalDays}`;

    const relapse = calEl.querySelector('.habit-relapse');
    if (relapse && s > 0) relapse.remove();

    picker.hidden = true;
    pendingCell = null;
    pendingDate = null;

    setTimeout(() => cell.classList.remove('celebrating'), 1200);
    renderCravingChart();
  }

  picker.querySelectorAll('button[data-level]').forEach(btn => {
    btn.addEventListener('click', () => commitMark(parseInt(btn.dataset.level)));
  });

  calEl.querySelectorAll('.cal-cell:not(.empty):not(.future)').forEach(cell => {
    cell.addEventListener('click', () => {
      const dateStr = cell.dataset.date;
      if (isDateMarked(dateStr)) {
        delete state.habitCalendar[dateStr];
        saveState();
        cell.classList.remove('marked', 'celebrating');
        cell.style.background = '';
        cell.style.borderColor = '';
        picker.hidden = true;
        pendingCell = null;
        pendingDate = null;

        const s = calcStreak();
        const updateStat = (sel, val) => { const e = calEl.querySelector(sel); if (e) e.textContent = val; };
        updateStat('.habit-stats-row .habit-stat:nth-child(1) .habit-stat-num', s);
        updateStat('.habit-stats-row .habit-stat:nth-child(2) .habit-stat-num', calcBestStreak());
        updateStat('.habit-stats-row .habit-stat:nth-child(3) .habit-stat-num', calcTotalMarkedDays());
        const savingsEl = calEl.querySelector('.habit-stat.savings .habit-stat-num');
        if (savingsEl) savingsEl.textContent = `$${calcSavings().toFixed(0)}`;
        renderCravingChart();
        return;
      }
      pendingCell = cell;
      pendingDate = dateStr;
      picker.hidden = false;
    });
  });

  calEl.querySelector('[data-role="reset-habit"]').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!confirm('Reset your habit tracker? This clears all marked days.')) return;
    delete state.habitTracker;
    state.habitCalendar = {};
    saveState();
    renderCalendar();
  });

  function renderCravingChart() {
    const canvas = document.getElementById('cravingChart');
    if (!canvas) return;
    const dates = Object.keys(state.habitCalendar || {})
      .filter(d => typeof state.habitCalendar[d] === 'number')
      .sort();
    const trendWrap = document.getElementById('cravingTrend');
    if (dates.length < 2) {
      if (trendWrap) trendWrap.hidden = true;
      return;
    }
    if (trendWrap) trendWrap.hidden = false;
    const labels = dates.map(d => d.slice(5));
    const values = dates.map(d => state.habitCalendar[d]);
    const trend = linearRegression(values);

    const existing = chartInstances.findIndex(c => c.canvas === canvas);
    if (existing !== -1) { chartInstances[existing].destroy(); chartInstances.splice(existing, 1); }

    chartInstances.push(new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'craving',
            data: values,
            borderColor: '#FF9933',
            backgroundColor: '#FF993333',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: values.map(v => intensityColor(v)),
          },
          {
            label: 'trend',
            data: trend,
            borderColor: '#FFFF55',
            borderWidth: 2,
            borderDash: [4, 4],
            fill: false,
            pointRadius: 0,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            ticks: { color: '#666', font: { family: 'Menlo, monospace', size: 8 }, maxRotation: 60, minRotation: 60 },
            grid: { color: '#222' },
          },
          y: {
            min: 0,
            max: 5,
            ticks: { color: '#666', font: { family: 'Menlo, monospace', size: 9 }, stepSize: 1 },
            grid: { color: '#222' },
          },
        },
      },
    }));
  }

  main.appendChild(calEl);
  renderCravingChart();
}

// ─── Walkthrough / Elevator Pitch ───
function renderWalkthrough() {
  const main = document.getElementById('content');
  main.innerHTML = '';
  destroyCharts();

  const slides = [
    {
      phase: 'boot',
      lines: ['> initializing lift-track-vibe . . .', '> loading modules . . .', '> ready.'],
    },
    {
      title: 'your day at a glance',
      desc: 'every day starts with three boxes at the top.',
      preview: `
        <div class="wt-row">
          <div class="wt-box" style="border-color:var(--yellow)"><span style="color:var(--yellow)">## daily_tracking</span><br><span style="color:var(--fg-dim)">vitamins ☑ creatine ☑</span></div>
          <div class="wt-box" style="border-color:var(--orange)"><span style="color:var(--orange)">## macros</span><br><span style="color:var(--fg-dim)">protein: 140g</span></div>
        </div>
        <div class="wt-box" style="border-color:var(--cyan);margin-top:6px"><span style="color:var(--cyan)">## baseline</span> <span style="color:var(--fg-dim)">sleep 7.5 · stand 11 · steps 9200</span><br><span style="color:var(--pink)">sleep_score: target · steps_score: surpassed</span></div>
      `,
    },
    {
      title: 'log every set',
      desc: 'the [weight] section tracks your strength training. each exercise has 3 sets with weight and reps.',
      preview: `
        <div class="wt-box" style="border-color:var(--fg)">
          <span style="color:var(--fg)">> bench_press</span> <span style="color:var(--fg-dim)">chest</span><br>
          <div class="wt-row" style="margin-top:6px">
            <div class="wt-mini-input">135</div>
            <div class="wt-mini-input">10</div>
            <span style="color:#DC2626">−</span> <span style="color:#22C55E">+</span>
          </div>
          <div style="color:var(--fg-dim);font-size:10px;margin-top:4px">~set_1 · ~set_2 · ~set_3</div>
        </div>
      `,
    },
    {
      title: 'double-tap to complete',
      desc: 'done with an exercise? double-tap the header. a rainbow flash sweeps across the card and it collapses — protecting your numbers from accidental edits.',
      preview: `
        <div class="wt-box" style="border-color:var(--fg);position:relative;overflow:hidden">
          <span style="color:var(--fg)">> bench_press</span> <span style="color:var(--fg-dim)">chest</span>
          <div class="wt-rainbow-demo"></div>
        </div>
        <div class="wt-box" style="border-color:#AAA;background:rgba(200,200,200,0.1);margin-top:6px">
          <span style="color:#FFF">> bench_press</span> <span style="color:#AAA">✓ completed</span>
        </div>
      `,
    },
    {
      title: '[body] section',
      desc: 'yoga, cardio, and hiit log in kcal. resistance and bodyweight moves log mass × reps. both sections are collapsible and reorderable.',
      preview: `
        <div class="wt-box" style="border-color:var(--fg)">
          <span style="color:var(--fg)">[body]</span><br>
          <div style="margin-top:6px">
            <span style="color:var(--fg-dim)">> yoga_flow</span> <span style="color:var(--fg-dim)">yoga</span> <span class="wt-mini-input" style="width:50px">250</span> <span style="color:var(--fg-dim)">kcal</span>
          </div>
          <div style="margin-top:4px">
            <span style="color:var(--fg-dim)">> pull_up</span> <span style="color:var(--fg-dim)">calisthenics</span> <span class="wt-mini-input" style="width:40px">0</span> <span class="wt-mini-input" style="width:40px">12</span>
          </div>
        </div>
      `,
    },
    {
      title: 'track your progress',
      desc: 'the stats page shows pr evolution (week-over-week gains), macro trends, baseline health, and volume charts for both [weight] and [body]. tap any chart title to expand. rotate for landscape.',
      preview: `
        <div class="wt-box" style="border-color:#AAA;background:rgba(200,200,200,0.1)">
          <span style="color:#FFF">## pr_evolution</span><br>
          <span style="color:#28FE14">▲</span> <span style="color:#FFF">bench_press 135×10 → 140×10</span><br>
          <span style="color:#FF6E6E">▼</span> <span style="color:#FFF">deadlift 225×5 → 215×5</span>
        </div>
        <div class="wt-row" style="margin-top:6px">
          <div class="wt-box" style="border-color:var(--yellow);flex:1"><span style="color:var(--yellow);font-size:10px">## volume</span><div class="wt-chart-fake" style="background:var(--yellow)"></div></div>
          <div class="wt-box" style="border-color:var(--orange);flex:1"><span style="color:var(--orange);font-size:10px">## macros</span><div class="wt-chart-fake" style="background:var(--orange)"></div></div>
        </div>
      `,
    },
    {
      title: 'body heatmap',
      desc: 'tap the grid icon next to the app title. a futuristic front + back body map shows every muscle group you\'ve worked. green = today, pink = resting (1–2 days), outlined = focus (3+ days).',
      preview: `
        <div class="wt-row" style="justify-content:center;gap:12px;margin-top:4px">
          <div style="flex:0 0 auto;border:1px solid rgba(40,254,20,0.3);border-radius:6px;padding:8px;background:var(--bg-dim);width:110px">
            <div style="color:rgba(40,254,20,0.5);font-size:9px;text-align:center;letter-spacing:2px;margin-bottom:4px">FRONT</div>
            <svg viewBox="0 0 100 180" style="width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="50" cy="18" rx="10" ry="12" fill="none" stroke="rgba(40,254,20,0.35)" stroke-width="0.6"/>
              <rect x="46" y="30" width="8" height="6" rx="2" fill="#28FE14" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M30 40 Q35 35 46 36 L46 44 Q38 43 30 46 Z" fill="#28FE14" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M70 40 Q65 35 54 36 L54 44 Q62 43 70 46 Z" fill="#FF69B4" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M37 46 Q42 42 50 43 Q58 42 63 46 L63 60 Q58 63 50 63 Q42 63 37 60 Z" fill="#28FE14" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M42 63 L58 63 L57 90 Q53 94 50 94 Q47 94 43 90 Z" fill="rgba(40,254,20,0.15)" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M29 46 Q26 48 24 55 L22 70 Q24 73 26 71 L29 58 Z" fill="#FF69B4" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M71 46 Q74 48 76 55 L78 70 Q76 73 74 71 L71 58 Z" fill="#FF69B4" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M43 94 Q42 110 41 132 L40 150 Q43 153 46 150 L47 128 Q49 108 50 100 Q46 100 43 94 Z" fill="rgba(40,254,20,0.15)" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M57 94 Q58 110 59 132 L60 150 Q57 153 54 150 L53 128 Q51 108 50 100 Q54 100 57 94 Z" fill="rgba(40,254,20,0.15)" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
            </svg>
          </div>
          <div style="flex:0 0 auto;border:1px solid rgba(40,254,20,0.3);border-radius:6px;padding:8px;background:var(--bg-dim);width:110px">
            <div style="color:rgba(40,254,20,0.5);font-size:9px;text-align:center;letter-spacing:2px;margin-bottom:4px">BACK</div>
            <svg viewBox="0 0 100 180" style="width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="50" cy="18" rx="10" ry="12" fill="none" stroke="rgba(40,254,20,0.35)" stroke-width="0.6"/>
              <rect x="46" y="30" width="8" height="6" rx="2" fill="rgba(40,254,20,0.15)" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M30 40 Q35 35 46 36 L46 44 Q38 43 30 46 Z" fill="rgba(40,254,20,0.15)" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M70 40 Q65 35 54 36 L54 44 Q62 43 70 46 Z" fill="rgba(40,254,20,0.15)" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M37 40 Q42 35 50 36 Q58 35 63 40 L63 68 Q58 72 50 72 Q42 72 37 68 Z" fill="#28FE14" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M42 72 L58 72 L57 92 Q53 95 50 95 Q47 95 43 92 Z" fill="#FF69B4" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M29 46 Q24 48 22 56 L20 70 Q23 73 26 71 L29 58 Z" fill="#28FE14" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M71 46 Q76 48 78 56 L80 70 Q77 73 74 71 L71 58 Z" fill="#28FE14" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M43 95 Q44 102 50 105 Q56 102 57 95 L57 108 Q53 112 50 112 Q47 112 43 108 Z" fill="#FF69B4" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M43 150 Q42 162 41 172 Q46 174 47 172 L48 160 Q49 154 49 150 Z" fill="#FF69B4" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
              <path d="M57 150 Q58 162 59 172 Q54 174 53 172 L52 160 Q51 154 51 150 Z" fill="#FF69B4" stroke="rgba(40,254,20,0.3)" stroke-width="0.3"/>
            </svg>
          </div>
        </div>
        <div style="display:flex;justify-content:center;gap:10px;margin-top:8px;font-size:9px">
          <span style="color:#28FE14">● worked</span>
          <span style="color:#FF69B4">● resting</span>
          <span style="color:rgba(40,254,20,0.4)">○ focus</span>
        </div>
      `,
    },
    {
      title: 'kill a habit in 30 days',
      desc: 'pick a habit to quit. mark each day and rate your cravings 1–5. milestones at day 7, 14, 21, and 30 with escalating fireworks. track your savings and watch the craving trend drop.',
      preview: `
        <div style="text-align:center;margin-bottom:8px">
          <span style="font-size:24px">🚬</span> <span style="color:var(--fg)">quitting: smoking</span>
        </div>
        <div class="wt-progress-bar"><div class="wt-progress-fill" style="width:60%"></div></div>
        <div style="text-align:center;color:var(--fg-dim);font-size:10px;margin:4px 0 8px">day 18 of 30</div>
        <div class="wt-cal-grid">
          ${Array.from({length:14}, (_,i) => `<div class="wt-cal-dot${i < 12 ? ' filled' : ''}">${i+1}</div>`).join('')}
        </div>
      `,
    },
    {
      title: 'your data, backed up',
      desc: 'connect a private github repo in settings. every edit auto-commits (debounced 30s). full history forever. restore on any device. or export as json / import from csv.',
      preview: `
        <div class="wt-box" style="border-color:var(--fg)">
          <span style="color:var(--fg)">## github_backup</span><br>
          <span style="color:var(--fg-dim)">auto-commit: enabled</span><br>
          <span style="color:var(--fg-dim)">last_backup: 2 min ago</span><br>
          <span style="color:var(--fg)">✓ 847 commits · 0 data lost</span>
        </div>
      `,
    },
    {
      title: 'navigate with one hand',
      desc: 'days are at the bottom — thumb-friendly. tap the app title for the full menu: stats, settings, import, knowledge base, calendar, and this walkthrough.',
      preview: `
        <div class="wt-menu-demo">
          <div class="wt-menu-btn active">tdy</div>
          <div class="wt-menu-btn">tue</div>
          <div class="wt-menu-btn">wed</div>
          <div class="wt-menu-btn">thu</div>
          <div class="wt-menu-btn">fri</div>
          <div class="wt-menu-btn">sat</div>
          <div class="wt-menu-btn">sun</div>
        </div>
        <div style="text-align:center;color:var(--fg-dim);font-size:10px;margin-top:8px">tap <span style="color:var(--fg)">$ ./lift-track-vibe</span> for the full menu</div>
      `,
    },
  ];

  let slideIdx = 0;
  let bootDone = false;

  const container = el(`
    <div class="walkthrough">
      <div class="wt-slide-area" id="wtSlideArea"></div>
      <div class="wt-footer">
        <button class="wt-arrow wt-prev" id="wtPrev" disabled>‹</button>
        <div class="wt-dots" id="wtDots"></div>
        <button class="wt-arrow wt-next" id="wtNext">›</button>
      </div>
    </div>
  `);
  main.appendChild(container);

  const slideArea = document.getElementById('wtSlideArea');
  const dotsContainer = document.getElementById('wtDots');
  const prevBtn = document.getElementById('wtPrev');
  const nextBtn = document.getElementById('wtNext');

  function updateNav() {
    const total = slides.length - 1;
    const current = Math.max(0, slideIdx - 1);
    dotsContainer.innerHTML = Array.from({length: total}, (_, i) =>
      `<span class="wt-dot${i === current ? ' active' : ''}"></span>`
    ).join('');
    prevBtn.disabled = slideIdx <= 1;
    nextBtn.textContent = slideIdx >= slides.length - 1 ? '✓' : '›';
  }

  function showBoot() {
    const boot = slides[0];
    slideArea.innerHTML = '';
    const terminal = document.createElement('div');
    terminal.className = 'wt-boot';
    slideArea.appendChild(terminal);

    let lineIdx = 0;
    function typeLine() {
      if (lineIdx >= boot.lines.length) {
        bootDone = true;
        slideIdx = 1;
        updateNav();
        return;
      }
      const line = document.createElement('div');
      line.className = 'wt-boot-line';
      line.style.color = '#28FE14';
      terminal.appendChild(line);
      const chars = boot.lines[lineIdx].split('');
      let ci = 0;
      const iv = setInterval(() => {
        if (ci < chars.length) {
          line.textContent += chars[ci++];
        } else {
          clearInterval(iv);
          lineIdx++;
          setTimeout(typeLine, 300);
        }
      }, 20);
    }
    typeLine();
  }

  function showSlide() {
    if (slideIdx < 1 || slideIdx >= slides.length) return;
    const slide = slides[slideIdx];
    updateNav();
    slideArea.innerHTML = `
      <div class="wt-slide">
        <div class="wt-slide-title">${slide.title}</div>
        <div class="wt-slide-preview">${slide.preview}</div>
        <div class="wt-slide-desc">${slide.desc}</div>
      </div>
    `;
  }

  nextBtn.addEventListener('click', () => {
    if (!bootDone) return;
    if (slideIdx >= slides.length - 1) {
      currentDay = pickInitialDay();
      render();
      return;
    }
    slideIdx++;
    showSlide();
  });

  prevBtn.addEventListener('click', () => {
    if (slideIdx <= 1) return;
    slideIdx--;
    showSlide();
  });

  showBoot();
}

// ─── Knowledge Base ───
function renderKnowledge() {
  const main = document.getElementById('content');
  main.innerHTML = '';
  destroyCharts();

  const topics = [
    {
      title: '⚠ ## backup_your_data',
      body: `<strong>set this up first.</strong> your workout data, macros, and progress are stored locally on your device. if you clear your browser, delete the app, or switch phones — it's gone.

<em>> how to protect your data:</em>

1. create a <strong>private</strong> github repo (github.com → new → set to private)
2. generate a <strong>personal access token</strong> (settings → developer settings → tokens → fine-grained → select your repo → contents: read & write)
3. tap <strong>$ ./lift-track-vibe</strong> → tap the ⚙ gear icon → expand <strong>## github_backup</strong>
4. enter your github username, repo name, token, and file path (default: data.json)
5. tap <strong>$ save_config</strong>, then <strong>$ test_connection</strong> to verify

once configured, the app auto-commits every change to your repo (debounced 30s). every save = one commit, full history forever. if you ever lose your phone, tap <strong>$ restore_from_github</strong> on your new device.

<em>> no github?</em> use the import menu (download icon) to export a json backup manually. share it to icloud, email, or airdrop. re-import anytime.`,
    },
    {
      title: '## getting_started',
      body: `<strong>lift-track-vibe</strong> is a terminal-themed workout tracker that runs as a PWA on your phone.

<em>> navigating:</em> the bottom bar shows your week days (mon–sun). tap the app title <strong>$ ./lift-track-vibe</strong> to open the menu with stats, settings, import, knowledge base, calendar, and support.

<em>> today indicator:</em> the current day's tab shows <strong>tdy</strong> in a rainbow animation so you always know where you are.

<em>> weeks:</em> use the ‹ › arrows next to the week label to move between weeks. data is organized by week number (week_01 through week_52).`,
    },
    {
      title: '## daily_view',
      body: `each day has three zones at the top, then two collapsible workout sections below.

<em>> daily_tracking (yellow):</em> supplements you take daily — vitamins, creatine, etc. tap the checkboxes. use <strong>add/remove</strong> at the bottom to customize.

<em>> macros (orange):</em> log protein, fiber, carb, and fat in grams. feeds the macros analytics chart.

<em>> baseline (cyan):</em> shows yesterday's sleep, stand, and steps from your apple shortcuts feed. editable as a fallback. tap the <strong>(i)</strong> button for details. the pink score boxes rate sleep and steps against targets.`,
    },
    {
      title: '## [weight]_section',
      body: `the green <strong>[weight]</strong> collapsible section contains your strength exercises.

<em>> logging sets:</em> each exercise has 3 sets. type the weight and reps directly, or use the <strong>+</strong> and <strong>−</strong> buttons.

<em>> completing exercises:</em> double-tap the exercise header to mark it done. a rainbow flash plays and the card collapses to a grey row. double-tap again to reopen.

<em>> $ prv wk:</em> copies last week's set data for that exercise into this week. handy for progressive overload — copy, then bump the numbers.

<em>> add / remove:</em> tap <strong>$ add</strong> (green) to open the add modal — create a new exercise or pick one from your history. tap <strong>$ remove</strong> (red) to enter remove mode where you can delete, rename, or drag-reorder exercises.

<em>> library:</em> in the add modal's "from history" tab, swipe left on an exercise to hide it from the library. swipe right to pin it to the top. pinned items show a ★.`,
    },
    {
      title: '## [body]_section',
      body: `the green <strong>[body]</strong> collapsible section tracks bodyweight and cardio activities.

<em>> two input types based on group:</em>
• <strong>yoga, swimming, pilates, cardio, hiit, calisthenics</strong> → log in <strong>kcal</strong> (calories burned)
• <strong>resistance, chest, back, shoulders</strong>, etc. → log <strong>mass</strong> (weight) and <strong>reps</strong>, like the weight section but labeled "mass"

<em>> add / remove:</em> same flow as [weight] — green add button opens the modal with body-specific groups.

<em>> reordering sections:</em> when both [weight] and [body] are collapsed, long-press a header and drag to swap their order. the order persists.`,
    },
    {
      title: '## daily_totals',
      body: `three yellow summary boxes sit at the bottom of each day:

• <strong>>> dailyWeight_Volume</strong> — total weight × reps across all [weight] exercises. shows a green ▲ or red ▼ arrow comparing to the same day last week.
• <strong>>> dailyBody_Kcal</strong> — total kcal from [body] activities in kcal-based groups.
• <strong>>> dailyBody_Mass</strong> — total mass × reps from [body] activities in mass-based groups.

all volume/mass values respect the lb ↔ kg unit toggle in settings.`,
    },
    {
      title: '## stats_analytics',
      body: `tap the app title → tap the chart icon to open analytics.

<em>> pr_evolution:</em> shows week-over-week changes in your top sets. green ▲ for increases, red ▼ for decreases. grouped by day, alphabetized. only shows exercises that changed.

<em>> macros:</em> a compact avg bar shows your overall averages. below it, a stacked bar chart tracks protein/fiber/carb/fat over time with trend lines (solid, dashed, dotted, diamonds).

<em>> baseline:</em> a grouped bar chart of sleep, steps, and stand as % of target (8 hrs, 10k steps, 12 hrs). data from your apple shortcuts health feed.

<em>> [weight] reports:</em> collapsible section with volume-by-day (area chart, 12 weeks) and weekly-volume-trend (single purple line).

<em>> [body] reports:</em> same structure — kcal-by-day and body-mass-trend.

<em>> expanding charts:</em> tap any chart title to pop it out as a centered card over a blurred background. tap ✕ or the backdrop to close. pinch with two fingers to zoom in on details.

<em>> landscape:</em> rotate your phone sideways — the bottom menu hides and charts get the full screen.`,
    },
    {
      title: '## calendar_habit_tracker',
      body: `tap the app title → tap the calendar icon.

<em>> setup:</em> pick a habit to quit (drinking, smoking, biting nails, eating junk food, or type your own). optionally enter how much it cost you per day.

<em>> tracking:</em> tap a day to mark it. you'll be asked "how hard was today?" (1–5 craving intensity). marking a day triggers fireworks and a congratulations message.

<em>> milestones:</em> celebrations escalate at day 1, 3, 7, 14, 21, 30, and 45. day 30 triggers a full-screen rainbow flash — habit killed 🏆.

<em>> stats:</em> current streak, best-ever streak, total days marked, and savings ($X saved based on your daily cost).

<em>> relapse:</em> if your streak breaks, a message shows your best run: "you made it X days — that's still progress." no guilt — just restart.

<em>> craving trend:</em> a small chart at the bottom plots your intensity ratings over time with a trend line. watch the cravings drop.`,
    },
    {
      title: '## body_heatmap',
      body: `tap the <strong>grid icon</strong> (between the app title and the week arrows) to open the body heatmap — a futuristic front + back body map that shows which muscle groups you've worked recently.

<em>> how it works:</em> every time you <strong>complete an exercise</strong> (double-tap to mark done), the muscle group attached to that exercise gets stamped "worked" for that day's date. the heatmap reads those stamps and colors the body accordingly.

<em>> color states:</em>
• <strong>green (worked)</strong> — completed today
• <strong>pink (resting)</strong> — completed 1–2 days ago
• <strong>outline only (focus)</strong> — not worked in 3+ days, or never logged

<em>> two body views side by side:</em>
• <strong>front:</strong> neck, shoulders, chest, biceps, forearms, core, thighs
• <strong>back:</strong> shoulders, upper back, lower back, triceps, forearms, glutes, calves

<em>> muscle groups:</em> 12 tracked groups — neck, shoulders, chest, upper back, lower back, biceps, triceps, forearms, core, glutes, thighs, calves. each exercise is assigned a group when you add it. the detail list below the body breaks every group out head-to-toe with its status (today / 2d ago / etc).

<em>> undo:</em> if you double-tap a completed exercise to reopen it, the heatmap recalculates — if no other exercise in that group is still completed, the stamp is removed and the zone fades back.

<em>> design:</em> animated scan lines, glow effects on active zones, labels etched onto the body. use it as a visual check for "what did i skip this week" — if a zone is outlined, it's time to hit it.`,
    },
    {
      title: '## settings',
      body: `tap the app title → tap the gear icon.

three collapsible boxes (tap the title to expand):

<em>> github_backup (green):</em> auto-commits your data to a private github repo on every change (debounced 30s). configure your username, repo, token, and file path. use test_connection to verify. restore_from_github pulls the latest backup.

<em>> unit (yellow):</em> toggle between pounds and kilograms. all data is stored canonically in lbs and converted on display — toggling is lossless and reversible.

<em>> danger_zone (red):</em> wipe all local data. cannot be undone. github backup remains intact if configured.`,
    },
    {
      title: '## import_export',
      body: `tap the app title → tap the download icon.

<em>> json backup:</em> export a full snapshot of all state as a .json file (share via airdrop, files, email). import replaces ALL current data — use with care.

<em>> csv import:</em> import workouts and body activities from a spreadsheet. download the template first — it includes instructions, column format, and sample data.

csv rows use a <strong>section</strong> column ("weight" or "body") to route data. weight rows chain multiple exercises per day. body rows log a single activity with kcal or mass+reps. group validation is enforced — weight groups and body groups are separate.

the import is atomic: if any row has an error, nothing is written. errors report the exact line and column. success plays a green rainbow flash; failure plays a red one.`,
    },
    {
      title: '## tips_tricks',
      body: `<em>> reorder sections:</em> collapse both [weight] and [body], then long-press one header and drag it over the other to swap.

<em>> exercise library:</em> in the add modal "from history" tab, swipe left to permanently hide an exercise from the picker. swipe right to pin it to the top for quick access. re-adding a hidden exercise via the "new" tab brings it back.

<em>> double-tap to complete:</em> double-tap any exercise header to mark the workout done. a rainbow sweeps diagonally across the card, then it collapses to a grey bar — protecting your logged data from accidental edits. double-tap the grey bar to reopen.

<em>> baseline data:</em> baseline always shows yesterday's data (today reflects how you recovered before this workout). if apple shortcuts didn't run, manually type values in the baseline inputs.

<em>> csv template:</em> the template includes a skipped saturday (rest day) and a body activity on sunday to show how the parser handles mixed row types and gaps.`,
    },
  ];

  const container = el(`<div class="knowledge-base"></div>`);

  topics.forEach((topic, idx) => {
    const isPriority = idx === 0;
    const card = el(`
      <div class="kb-card${isPriority ? ' priority' : ''}">
        <div class="kb-header">
          <span class="kb-title">${topic.title}</span>
        </div>
        <div class="kb-body" hidden>${topic.body}</div>
      </div>
    `);
    card.querySelector('.kb-header').addEventListener('click', () => {
      const body = card.querySelector('.kb-body');
      body.hidden = !body.hidden;
      card.classList.toggle('expanded', !body.hidden);
    });
    container.appendChild(card);
  });

  main.appendChild(container);
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

// ─── Body Heatmap ───
const HEATMAP_GROUPS = ['Neck', 'Shoulders', 'Chest', 'Upper Back', 'Biceps', 'Triceps', 'Forearms', 'Core', 'Lower Back', 'Glutes', 'Thighs', 'Calves'];
const HEATMAP_GREEN = '#28FE14';
const HEATMAP_PINK  = '#FF69B4';
const HEATMAP_OUTLINE = 'rgba(40, 254, 20, 0.15)';

// Direct map: { "Chest": "2026-04-12", "Biceps": "2026-04-10", ... }
const GROUP_WORKED_KEY = 'lift_app_group_last_worked';

function getGroupWorkedMap() {
  try { return JSON.parse(localStorage.getItem(GROUP_WORKED_KEY)) || {}; }
  catch { return {}; }
}

function markGroupWorked(group, dateStr) {
  const map = getGroupWorkedMap();
  const existing = map[group];
  // Only update if this date is newer (or no existing entry)
  if (!existing || dateStr >= existing) {
    map[group] = dateStr;
    localStorage.setItem(GROUP_WORKED_KEY, JSON.stringify(map));
  }
}

// Called when an exercise is un-completed — recalculates the group's last-worked
// date by scanning all days for any remaining completed exercise in that group.
function unstampGroupIfNeeded(exGroup, dayName) {
  const group = normalizeGroup(exGroup);
  if (!group) return;

  // Check if any exercise in this group is still completed on the same day
  const exercises = getExercisesForDay(dayName);
  const stillCoveredToday = exercises.some(ex => {
    if (normalizeGroup(ex.group) !== group) return false;
    return !!state?.[currentWeek]?.[dayName]?.exercises?.[ex.name]?.completed;
  });
  if (stillCoveredToday) return;

  // No exercises in this group are completed on this day anymore.
  // Scan all days in the current week to find the most recent completed date
  // for this group, or remove the stamp entirely.
  const dayNames = Object.keys(DAYS);
  let bestDate = null;
  for (const d of dayNames) {
    const dayExercises = getExercisesForDay(d);
    for (const ex of dayExercises) {
      if (normalizeGroup(ex.group) !== group) continue;
      if (!state?.[currentWeek]?.[d]?.exercises?.[ex.name]?.completed) continue;
      const dt = dateForDayTab(d);
      if (!bestDate || dt > bestDate) bestDate = dt;
    }
  }

  const map = getGroupWorkedMap();
  if (bestDate) {
    map[group] = bestDate;
  } else {
    delete map[group];
  }
  localStorage.setItem(GROUP_WORKED_KEY, JSON.stringify(map));
}

// Called when an exercise is completed — stamps the tab's calendar date for that group
function stampGroupFromExercise(exGroup, dayName) {
  const group = normalizeGroup(exGroup);
  if (!group) return;
  const date = dateForDayTab(dayName || todayWeekdayKey());
  markGroupWorked(group, date);
}

// Compute days since each group was last worked, using the direct map
function calcGroupRecency() {
  const map = getGroupWorkedMap();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result = {};
  for (const g of HEATMAP_GROUPS) {
    const dateStr = map[g];
    if (!dateStr) {
      result[g] = null; // never worked
    } else {
      const worked = new Date(dateStr + 'T00:00:00');
      result[g] = Math.floor((today - worked) / 86400000);
    }
  }
  return result;
}

function heatmapColor(daysAgo) {
  if (daysAgo === null) return HEATMAP_OUTLINE;
  if (daysAgo <= 0) return HEATMAP_GREEN;
  if (daysAgo <= 2) return HEATMAP_PINK;
  return HEATMAP_OUTLINE;
}

function heatmapStatusText(daysAgo) {
  if (daysAgo === null) return '—';
  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  return `${daysAgo}d ago`;
}

function zoneLabelClass(daysAgo) {
  if (daysAgo === null || daysAgo > 1) return 'zone-label';
  if (daysAgo <= 0) return 'zone-label active-green';
  return 'zone-label active-pink';
}

function scanLines(startY, endY, step) {
  let lines = '';
  for (let y = startY; y <= endY; y += step) {
    lines += `<line class="scan-line" x1="0" y1="${y}" x2="200" y2="${y}"/>`;
  }
  return lines;
}

function buildFrontSvg(recency) {
  const c = (g) => heatmapColor(recency[g]);
  const lc = (g) => zoneLabelClass(recency[g]);
  const ol = 'rgba(40,254,20,0.25)';
  const glowId = 'glow-f';
  return `
    <svg viewBox="0 0 200 390" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${glowId}" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="bodyOutline-f" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(40,254,20,0.35)"/>
          <stop offset="100%" stop-color="rgba(40,254,20,0.1)"/>
        </linearGradient>
      </defs>
      ${scanLines(20, 385, 12)}
      <text x="100" y="14" text-anchor="middle" fill="rgba(40,254,20,0.4)" font-size="10" font-family="monospace" letter-spacing="3">FRONT</text>
      <!-- Head -->
      <ellipse cx="100" cy="38" rx="18" ry="22" fill="none" stroke="url(#bodyOutline-f)" stroke-width="0.8"/>
      <!-- Neck -->
      <rect class="muscle-zone" x="93" y="58" width="14" height="10" rx="3" fill="${c('Neck')}" stroke="${ol}" stroke-width="0.5" ${c('Neck') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Neck')}" x="100" y="65" text-anchor="middle" font-size="5">NECK</text>
      <!-- Shoulders -->
      <path class="muscle-zone" d="M62 76 Q72 66, 93 70 L93 83 Q78 81, 62 89 Z" fill="${c('Shoulders')}" stroke="${ol}" stroke-width="0.4" ${c('Shoulders') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <path class="muscle-zone" d="M138 76 Q128 66, 107 70 L107 83 Q122 81, 138 89 Z" fill="${c('Shoulders')}" stroke="${ol}" stroke-width="0.4" ${c('Shoulders') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Shoulders')}" x="16" y="78" font-size="6">SHLDR</text>
      <!-- Chest -->
      <path class="muscle-zone" d="M74 86 Q84 76, 100 78 Q116 76, 126 86 L126 110 Q116 116, 100 116 Q84 116, 74 110 Z" fill="${c('Chest')}" stroke="${ol}" stroke-width="0.4" ${c('Chest') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Chest')}" x="88" y="100" text-anchor="middle" font-size="6.5">CHEST</text>
      <!-- Core -->
      <path class="muscle-zone" d="M86 116 L114 116 L112 180 Q106 186, 100 186 Q94 186, 88 180 Z" fill="${c('Core')}" stroke="${ol}" stroke-width="0.4" ${c('Core') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Core')}" x="100" y="150" text-anchor="middle" font-size="6.5">CORE</text>
      <!-- Biceps -->
      <path class="muscle-zone" d="M60 89 Q54 88, 50 102 L46 134 Q50 140, 54 136 L60 112 Q63 98, 61 89 Z" fill="${c('Biceps')}" stroke="${ol}" stroke-width="0.4" ${c('Biceps') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <path class="muscle-zone" d="M140 89 Q146 88, 150 102 L154 134 Q150 140, 146 136 L140 112 Q137 98, 139 89 Z" fill="${c('Biceps')}" stroke="${ol}" stroke-width="0.4" ${c('Biceps') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Biceps')}" x="16" y="118" font-size="6">BICEP</text>
      <!-- Forearms -->
      <path class="muscle-zone" d="M36 142 Q32 152, 28 174 L26 192 Q30 196, 34 192 L42 170 Q46 154, 44 142 Z" fill="${c('Forearms')}" stroke="${ol}" stroke-width="0.4" ${c('Forearms') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <path class="muscle-zone" d="M164 142 Q168 152, 172 174 L174 192 Q170 196, 166 192 L158 170 Q154 154, 156 142 Z" fill="${c('Forearms')}" stroke="${ol}" stroke-width="0.4" ${c('Forearms') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Forearms')}" x="36" y="160" font-size="5.5" transform="rotate(-70 36 160)">FOREARM</text>
      <!-- Upper arm outer -->
      <path d="M50 102 Q44 100, 40 116 L36 142 Q40 146, 44 142 L46 134 Z" fill="none" stroke="${ol}" stroke-width="0.4"/>
      <path d="M150 102 Q156 100, 160 116 L164 142 Q160 146, 156 142 L154 134 Z" fill="none" stroke="${ol}" stroke-width="0.4"/>
      <!-- Hands -->
      <ellipse cx="25" cy="198" rx="5" ry="8" fill="none" stroke="${ol}" stroke-width="0.4"/>
      <ellipse cx="175" cy="198" rx="5" ry="8" fill="none" stroke="${ol}" stroke-width="0.4"/>
      <!-- Thighs -->
      <path class="muscle-zone" d="M86 186 Q84 212, 82 252 L80 296 Q86 302, 92 296 L95 248 Q99 214, 100 200 Q94 200, 86 186 Z" fill="${c('Thighs')}" stroke="${ol}" stroke-width="0.4" ${c('Thighs') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <path class="muscle-zone" d="M114 186 Q116 212, 118 252 L120 296 Q114 302, 108 296 L105 248 Q101 214, 100 200 Q106 200, 114 186 Z" fill="${c('Thighs')}" stroke="${ol}" stroke-width="0.4" ${c('Thighs') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Thighs')}" x="100" y="250" text-anchor="middle" font-size="6">THIGH</text>
      <!-- Shins (outline only) -->
      <path d="M80 302 Q78 322, 76 350 L74 370 Q82 376, 88 370 L90 342 Q91 318, 92 302 Z" fill="none" stroke="${ol}" stroke-width="0.4"/>
      <path d="M120 302 Q122 322, 124 350 L126 370 Q118 376, 112 370 L110 342 Q109 318, 108 302 Z" fill="none" stroke="${ol}" stroke-width="0.4"/>
    </svg>`;
}

function buildBackSvg(recency) {
  const c = (g) => heatmapColor(recency[g]);
  const lc = (g) => zoneLabelClass(recency[g]);
  const ol = 'rgba(40,254,20,0.25)';
  const glowId = 'glow-b';
  return `
    <svg viewBox="0 0 200 390" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${glowId}" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="bodyOutline-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(40,254,20,0.35)"/>
          <stop offset="100%" stop-color="rgba(40,254,20,0.1)"/>
        </linearGradient>
      </defs>
      ${scanLines(20, 385, 12)}
      <text x="100" y="14" text-anchor="middle" fill="rgba(40,254,20,0.4)" font-size="10" font-family="monospace" letter-spacing="3">BACK</text>
      <!-- Head -->
      <ellipse cx="100" cy="38" rx="18" ry="22" fill="none" stroke="url(#bodyOutline-b)" stroke-width="0.8"/>
      <!-- Neck -->
      <rect class="muscle-zone" x="93" y="58" width="14" height="10" rx="3" fill="${c('Neck')}" stroke="${ol}" stroke-width="0.5" ${c('Neck') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <!-- Shoulders -->
      <path class="muscle-zone" d="M62 76 Q72 66, 93 70 L93 83 Q78 81, 62 89 Z" fill="${c('Shoulders')}" stroke="${ol}" stroke-width="0.4" ${c('Shoulders') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <path class="muscle-zone" d="M138 76 Q128 66, 107 70 L107 83 Q122 81, 138 89 Z" fill="${c('Shoulders')}" stroke="${ol}" stroke-width="0.4" ${c('Shoulders') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Shoulders')}" x="184" y="78" text-anchor="end" font-size="6">SHLDR</text>
      <!-- Upper Back -->
      <path class="muscle-zone" d="M74 84 Q84 76, 100 78 Q116 76, 126 84 L126 142 Q116 148, 100 148 Q84 148, 74 142 Z" fill="${c('Upper Back')}" stroke="${ol}" stroke-width="0.4" ${c('Upper Back') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Upper Back')}" x="100" y="108" text-anchor="middle" font-size="6">UPPER</text>
      <text class="${lc('Upper Back')}" x="100" y="116" text-anchor="middle" font-size="6">BACK</text>
      <!-- Lower Back -->
      <path class="muscle-zone" d="M84 148 L116 148 L114 180 Q106 186, 100 186 Q94 186, 86 180 Z" fill="${c('Lower Back')}" stroke="${ol}" stroke-width="0.4" ${c('Lower Back') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Lower Back')}" x="100" y="168" text-anchor="middle" font-size="5.5">LOWER</text>
      <!-- Triceps -->
      <path class="muscle-zone" d="M60 89 Q50 88, 46 106 L42 138 Q46 144, 52 140 L58 114 Q62 98, 60 89 Z" fill="${c('Triceps')}" stroke="${ol}" stroke-width="0.4" ${c('Triceps') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <path class="muscle-zone" d="M140 89 Q150 88, 154 106 L158 138 Q154 144, 148 140 L142 114 Q138 98, 140 89 Z" fill="${c('Triceps')}" stroke="${ol}" stroke-width="0.4" ${c('Triceps') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Triceps')}" x="184" y="118" text-anchor="end" font-size="5.5">TRICEP</text>
      <!-- Forearms -->
      <path class="muscle-zone" d="M36 142 Q32 152, 28 174 L26 192 Q30 196, 34 192 L42 170 Q46 154, 44 142 Z" fill="${c('Forearms')}" stroke="${ol}" stroke-width="0.4" ${c('Forearms') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <path class="muscle-zone" d="M164 142 Q168 152, 172 174 L174 192 Q170 196, 166 192 L158 170 Q154 154, 156 142 Z" fill="${c('Forearms')}" stroke="${ol}" stroke-width="0.4" ${c('Forearms') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <!-- Hands -->
      <ellipse cx="25" cy="198" rx="5" ry="8" fill="none" stroke="${ol}" stroke-width="0.4"/>
      <ellipse cx="175" cy="198" rx="5" ry="8" fill="none" stroke="${ol}" stroke-width="0.4"/>
      <!-- Glutes -->
      <path class="muscle-zone" d="M86 180 Q88 188, 100 192 Q112 188, 114 180 L114 202 Q106 210, 100 210 Q94 210, 86 202 Z" fill="${c('Glutes')}" stroke="${ol}" stroke-width="0.4" ${c('Glutes') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Glutes')}" x="100" y="198" text-anchor="middle" font-size="5.5">GLUTE</text>
      <!-- Hamstrings (outline) -->
      <path d="M86 202 Q84 226, 82 260 L80 296 Q86 302, 92 296 L95 250 Q99 216, 100 210 Q94 210, 86 202 Z" fill="none" stroke="${ol}" stroke-width="0.4"/>
      <path d="M114 202 Q116 226, 118 260 L120 296 Q114 302, 108 296 L105 250 Q101 216, 100 210 Q106 210, 114 202 Z" fill="none" stroke="${ol}" stroke-width="0.4"/>
      <!-- Calves -->
      <path class="muscle-zone" d="M80 302 Q78 320, 76 350 L74 370 Q82 376, 88 370 L90 342 Q91 318, 92 302 Z" fill="${c('Calves')}" stroke="${ol}" stroke-width="0.4" ${c('Calves') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <path class="muscle-zone" d="M120 302 Q122 320, 124 350 L126 370 Q118 376, 112 370 L110 342 Q109 318, 108 302 Z" fill="${c('Calves')}" stroke="${ol}" stroke-width="0.4" ${c('Calves') !== HEATMAP_OUTLINE ? `filter="url(#${glowId})"` : ''}/>
      <text class="${lc('Calves')}" x="100" y="345" text-anchor="middle" font-size="6">CALF</text>
    </svg>`;
}

function renderHeatmap() {
  const main = document.getElementById('content');
  main.innerHTML = '';
  destroyCharts();

  const recency = calcGroupRecency();
  const container = el(`<div class="heatmap-view"></div>`);

  container.appendChild(el(`<h2>## body_heatmap</h2>`));

  // Front + Back SVGs side by side
  const bodyDiv = el(`<div class="heatmap-body-pair">
    <div class="heatmap-body">${buildFrontSvg(recency)}</div>
    <div class="heatmap-body">${buildBackSvg(recency)}</div>
  </div>`);
  container.appendChild(bodyDiv);

  // Legend
  container.appendChild(el(`<div class="heatmap-legend">
    <div class="heatmap-legend-item"><div class="heatmap-legend-swatch" style="background:${HEATMAP_GREEN}"></div><span>worked</span></div>
    <div class="heatmap-legend-item"><div class="heatmap-legend-swatch" style="background:${HEATMAP_PINK}"></div><span>resting</span></div>
    <div class="heatmap-legend-item"><div class="heatmap-legend-swatch" style="background:${HEATMAP_OUTLINE};border-color:rgba(40,254,20,0.4)"></div><span>focus</span></div>
  </div>`));

  // Detail list
  const detailDiv = el(`<div class="heatmap-detail"></div>`);
  for (const group of HEATMAP_GROUPS) {
    const daysAgo = recency[group];
    const color = heatmapColor(daysAgo);
    const status = heatmapStatusText(daysAgo);
    detailDiv.appendChild(el(`
      <div class="heatmap-detail-row">
        <span class="group-name"><span class="group-swatch" style="background:${color}"></span>${group}</span>
        <span class="group-status" style="color:${color}">${status}</span>
      </div>
    `));
  }
  container.appendChild(detailDiv);

  main.appendChild(container);
}

function render() {
  document.getElementById('weekLabel').textContent = `week_${String(currentWeek).padStart(2, '0')}`;
  localStorage.setItem('lift_app_week', String(currentWeek));
  if (currentDay === 'heatmap') {
    renderHeatmap();
  } else if (currentDay === 'analytics') {
    renderAnalytics();
  } else if (currentDay === 'settings') {
    renderSettings();
  } else if (currentDay === 'import') {
    renderImport();
  } else if (currentDay === 'calendar') {
    renderCalendar();
  } else if (currentDay === 'knowledge') {
    renderKnowledge();
  } else if (currentDay === 'support') {
    renderWalkthrough();
  } else {
    destroyCharts();
    renderDay(currentDay);
  }
}

// ─── Wire up nav ───
function highlightTodayTab() {
  const todayKey = todayWeekdayKey();
  document.querySelectorAll('#dayTabs button').forEach(btn => {
    const isToday = btn.dataset.day === todayKey;
    btn.classList.toggle('today', isToday);
    if (isToday) {
      if (!btn.dataset.label) btn.dataset.label = btn.textContent;
      btn.textContent = 'tdy';
    } else if (btn.dataset.label) {
      btn.textContent = btn.dataset.label;
    }
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
    document.getElementById('appMenu').hidden = true;
  });
});

// Single-tap the app title ($ ./lift-track-vibe) to reveal stats / sett
(() => {
  const promptEl = document.getElementById('prompt');
  const menuEl = document.getElementById('appMenu');
  if (!promptEl || !menuEl) return;
  const setMenuOpen = (open) => {
    menuEl.hidden = !open;
    document.body.classList.toggle('menu-open', open);
  };
  promptEl.addEventListener('click', () => {
    setMenuOpen(menuEl.hidden);
  });
  menuEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.disabled) { e.preventDefault(); return; }
      currentDay = btn.dataset.day;
      localStorage.setItem('lift_app_day', currentDay);
      setActiveTab(currentDay);
      render();
      setMenuOpen(false);
    });
  });
  // Stop clicks inside the menu from bubbling to the document close handler
  menuEl.addEventListener('click', (e) => e.stopPropagation());
  // Tap anywhere outside the menu or prompt closes it
  document.addEventListener('click', (e) => {
    if (menuEl.hidden) return;
    if (e.target.closest('#appMenu') || e.target.closest('#prompt')) return;
    setMenuOpen(false);
  });
})();

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

// Initial render: pick today / saved day, auto-set week, highlight today
currentDay = pickInitialDay();
const _todayDate = new Date().toISOString().slice(0, 10);
const _lastVisit = localStorage.getItem('lift_app_last_visit');
if (_lastVisit !== _todayDate) {
  currentWeek = currentCalendarWeek();
}
localStorage.setItem('lift_app_last_visit', _todayDate);
localStorage.setItem('lift_app_day', currentDay);
localStorage.setItem('lift_app_week', String(currentWeek));
highlightTodayTab();
setActiveTab(currentDay);
render();

// ─── Heatmap button ───
document.getElementById('heatmapBtn').addEventListener('click', () => {
  if (currentDay === 'heatmap') {
    // Toggle back to previous day
    currentDay = todayWeekdayKey();
    document.getElementById('heatmapBtn').classList.remove('active');
  } else {
    currentDay = 'heatmap';
    document.getElementById('heatmapBtn').classList.add('active');
  }
  localStorage.setItem('lift_app_day', currentDay);
  setActiveTab(currentDay);
  render();
  document.getElementById('appMenu').hidden = true;
});

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
