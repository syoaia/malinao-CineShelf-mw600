const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve frontend static files from project root
app.use(express.static(path.join(__dirname)));

const DB_PATH = path.join(__dirname, 'cineshelf.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) return console.error('DB open error', err);
  console.log('Opened SQLite DB at', DB_PATH);
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS movies (
      id TEXT PRIMARY KEY,
      title TEXT,
      year INTEGER,
      watched INTEGER,
      poster TEXT,
      rating INTEGER,
      notes TEXT,
      added INTEGER
    )
  `);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/movies', (req, res) => {
  db.all('SELECT * FROM movies ORDER BY added DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // convert watched integer to boolean
    const out = rows.map(r => ({
      id: r.id,
      title: r.title,
      year: r.year,
      watched: !!r.watched,
      poster: r.poster,
      rating: r.rating,
      notes: r.notes,
      added: r.added
    }));
    res.json(out);
  });
});

app.get('/api/movies/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM movies WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({
      id: row.id,
      title: row.title,
      year: row.year,
      watched: !!row.watched,
      poster: row.poster,
      rating: row.rating,
      notes: row.notes,
      added: row.added
    });
  });
});

app.post('/api/movies', (req, res) => {
  const m = req.body || {};
  if (!m.id || !m.title) return res.status(400).json({ error: 'id and title required' });
  const stmt = db.prepare(`INSERT OR REPLACE INTO movies (id,title,year,watched,poster,rating,notes,added) VALUES (?,?,?,?,?,?,?,?)`);
  stmt.run(
    m.id,
    m.title,
    m.year || null,
    m.watched ? 1 : 0,
    m.poster || null,
    m.rating != null ? m.rating : null,
    m.notes || null,
    m.added || Date.now(),
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
  stmt.finalize();
});

app.delete('/api/movies/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM movies WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`CineShelf backend listening on http://localhost:${PORT}`);
});
