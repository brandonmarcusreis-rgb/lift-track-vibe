// POST /api/health
// Body: { date, sleep_hrs, steps, stand_hrs, secret }
// Auth: shared secret in body matched against SHARED_SECRET env var
// Action: writes /health/{date}.json to the configured GitHub repo

export default async function handler(req, res) {
  // CORS for the iOS Shortcut and the PWA itself
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = req.body || {};
  const { date, sleep_hrs, steps, stand_hrs, secret } = body;

  if (!process.env.SHARED_SECRET) {
    return res.status(500).json({ error: 'server SHARED_SECRET not set' });
  }
  if (!secret || secret !== process.env.SHARED_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'invalid date — expected YYYY-MM-DD', got: date });
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    return res.status(500).json({ error: 'server not configured (missing GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN)' });
  }

  const path = `health/${date}.json`;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const fileContent = {
    date,
    sleep_hrs: Number(sleep_hrs) || 0,
    steps: Number(steps) || 0,
    stand_hrs: Number(stand_hrs) || 0,
    written_at: new Date().toISOString(),
  };
  const encoded = Buffer.from(JSON.stringify(fileContent, null, 2)).toString('base64');

  // Get existing SHA if file already exists (so update is allowed)
  let sha = null;
  try {
    const getResp = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'lift-app-vercel',
      },
    });
    if (getResp.ok) {
      const j = await getResp.json();
      sha = j.sha;
    }
  } catch {
    // ignore — proceed without sha
  }

  const putBody = {
    message: `health auto: ${date}`,
    content: encoded,
  };
  if (sha) putBody.sha = sha;

  try {
    const putResp = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'lift-app-vercel',
      },
      body: JSON.stringify(putBody),
    });

    if (!putResp.ok) {
      const txt = await putResp.text();
      return res.status(putResp.status).json({
        error: 'github write failed',
        status: putResp.status,
        detail: txt.slice(0, 400),
      });
    }

    return res.status(200).json({ ok: true, date, path, updated: !!sha });
  } catch (e) {
    return res.status(500).json({ error: 'fetch failed', detail: String(e.message || e) });
  }
}
