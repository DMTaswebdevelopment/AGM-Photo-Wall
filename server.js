const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;

// On Render, set DATA_DIR to your persistent disk's mount path (e.g. /var/data)
// so uploaded photos and the index survive restarts and redeploys.
// Locally, this just defaults to a "data" folder next to server.js.
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');

const PUBLIC_DIR = path.join(__dirname, 'public');
const ASSETS_DIR = path.join(__dirname, 'assets'); // top-level assets folder (e.g. logo files)
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

// Make sure our storage folders/files exist
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(INDEX_FILE)) fs.writeFileSync(INDEX_FILE, '[]');

app.use(express.json({ limit: '15mb' })); // photos arrive as base64 JSON
app.use(express.static(PUBLIC_DIR));
app.use('/assets', express.static(ASSETS_DIR)); // serves the repo's top-level assets/ folder
app.use('/uploads', express.static(UPLOADS_DIR)); // photos now live outside /public

function readIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeIndex(arr) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(arr, null, 2));
}

// List all photos (metadata + url)
app.get('/api/photos', (req, res) => {
  res.json(readIndex());
});

// Add a new photo
app.post('/api/photos', (req, res) => {
  const { dataUrl, name, caption } = req.body || {};

  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Missing or invalid image data.' });
  }

  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Could not parse image data.' });
  }

  const ext = match[1] === 'jpeg' ? 'jpg' : match[1].replace(/[^a-z0-9]/gi, '');
  const base64 = match[2];
  const id = Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
  const filename = `${id}.${ext}`;

  try {
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(base64, 'base64'));
  } catch (e) {
    console.error('Failed to write image file:', e);
    return res.status(500).json({ error: 'Could not save image.' });
  }

  const entry = {
    id,
    url: `/uploads/${filename}`,
    name: (name || '').toString().trim().slice(0, 40),
    caption: (caption || '').toString().trim().slice(0, 80),
    ts: Date.now(),
  };

  const idx = readIndex();
  idx.push(entry);
  writeIndex(idx);

  res.status(201).json(entry);
});

// Optional: remove a photo (handy for moderation)
app.delete('/api/photos/:id', (req, res) => {
  const id = req.params.id;
  let idx = readIndex();
  const entry = idx.find((e) => e.id === id);
  if (!entry) return res.status(404).json({ error: 'Not found.' });

  idx = idx.filter((e) => e.id !== id);
  writeIndex(idx);

  try {
    fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(entry.url)));
  } catch (e) {
    // file already gone — fine
  }

  res.json({ ok: true });
});

// Download every photo (plus a manifest of names/captions) as one zip file.
// Visit /admin/download-all in a browser to trigger the download.
// If ADMIN_KEY is set as an environment variable, you must add ?key=yourkey
// to the URL — without it, this endpoint is open to anyone who knows the URL.
app.get('/admin/download-all', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && req.query.key !== adminKey) {
    return res.status(403).send('Forbidden — add ?key=... to the URL.');
  }

  const idx = readIndex();

  res.attachment(`photo-wall-export-${new Date().toISOString().slice(0, 10)}.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    console.error('Zip export error:', err);
    if (!res.headersSent) res.status(500).end();
  });

  archive.pipe(res);

  idx.forEach((entry, i) => {
    const filePath = path.join(UPLOADS_DIR, path.basename(entry.url));
    if (!fs.existsSync(filePath)) return;
    const label = [entry.name, entry.caption]
      .filter(Boolean)
      .join(' - ')
      .replace(/[^a-z0-9\- ]/gi, '')
      .trim();
    const ext = path.extname(filePath);
    const niceName = `${String(i + 1).padStart(3, '0')}_${label || 'photo'}${ext}`;
    archive.file(filePath, { name: niceName });
  });

  archive.append(JSON.stringify(idx, null, 2), { name: 'photo-manifest.json' });
  archive.finalize();
});

function getLanAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

app.listen(PORT, '0.0.0.0', () => {
  const lan = getLanAddress();
  console.log('');
  console.log(`  Photo wall is running`);
  console.log(`  ------------------------------------------`);
  console.log(`  On this computer:`);
  console.log(`    Wall display   http://localhost:${PORT}/#wall`);
  console.log(`    Submit photo   http://localhost:${PORT}/#submit`);
  if (lan) {
    console.log('');
    console.log(`  On phones on the same Wi-Fi:`);
    console.log(`    Wall display   http://${lan}:${PORT}/#wall`);
    console.log(`    Submit photo   http://${lan}:${PORT}/#submit`);
  }
  console.log(`  ------------------------------------------`);
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
