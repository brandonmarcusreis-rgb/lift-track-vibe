const fs = require('fs');
const SHIFT = 14;
const IN = '/Users/brandonreis/Desktop/data.json';
const OUT = '/Users/brandonreis/Desktop/data-shifted.json';

const parsed = JSON.parse(fs.readFileSync(IN, 'utf8'));
const data = parsed.data;

function weekHasRealData(wk) {
  for (const day of Object.keys(wk)) {
    const dd = wk[day];
    if (!dd || typeof dd !== 'object') continue;
    // Check exercises with non-empty sets
    if (dd.exercises) {
      for (const ex of Object.values(dd.exercises)) {
        if (ex.sets && ex.sets.some(s => (parseFloat(s.lbs) || 0) > 0 || (parseFloat(s.reps) || 0) > 0)) return true;
        if (ex.completed) return true;
      }
    }
    // Macros
    for (const k of ['protein', 'fiber', 'carb', 'fat']) {
      if (dd[k] && parseFloat(dd[k]) > 0) return true;
    }
    // Habits
    if (dd.habits && Object.values(dd.habits).some(v => v)) return true;
    // Water
    if (Array.isArray(dd.water) && dd.water.some(v => v > 0)) return true;
    // Baseline
    if (dd.sleep && parseFloat(dd.sleep) > 0) return true;
    if (dd.steps && parseFloat(dd.steps) > 0) return true;
  }
  return false;
}

const shifted = {};
for (const k of Object.keys(data)) {
  if (!/^\d+$/.test(k)) shifted[k] = data[k]; // preserve non-week keys
}

const origWeeksWithData = [];
for (const k of Object.keys(data)) {
  if (!/^\d+$/.test(k)) continue;
  if (!weekHasRealData(data[k])) continue;
  const oldNum = parseInt(k, 10);
  const newNum = oldNum + SHIFT;
  if (newNum > 53) {
    console.log(`Skipping week ${oldNum} (would shift to ${newNum}, beyond valid range)`);
    continue;
  }
  shifted[String(newNum)] = data[k];
  origWeeksWithData.push(oldNum);
}

parsed.data = shifted;
parsed.shifted_by = SHIFT;
parsed.shifted_at = new Date().toISOString();
fs.writeFileSync(OUT, JSON.stringify(parsed, null, 2));

const newWeeks = origWeeksWithData.map(w => w + SHIFT);
console.log('Weeks with real data:', origWeeksWithData.join(','));
console.log('Shifted to:', newWeeks.join(','));
console.log('Output file:', OUT);
