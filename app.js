// CineShelf — shared storage and page logic (localStorage CRUD)
(function () {
  const STORAGE_KEY = 'cineshelf_movies_v1';

  // ---------- Storage API ----------
  function readMovies() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('readMovies', e);
      return [];
    }
  }

  function writeMovies(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  // localStorage CRUD with optional remote sync
  function createMovie(data) {
    const movies = readMovies();
    movies.push(data);
    writeMovies(movies);
    if (remoteAvailable) {
      fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(() => {});
    }
  }

  function updateMovie(id, update) {
    const movies = readMovies().map(m => (m.id === id ? Object.assign({}, m, update) : m));
    writeMovies(movies);
    if (remoteAvailable) {
      const obj = getById(id) || Object.assign({}, update, { id });
      fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obj)
      }).catch(() => {});
    }
  }

  function deleteMovie(id) {
    const movies = readMovies().filter(m => m.id !== id);
    writeMovies(movies);
    if (remoteAvailable) {
      fetch('/api/movies/' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {});
    }
  }

  // remote backend sync
  let remoteAvailable = false;
  function detectRemoteAndSync() {
    return fetch('/api/health').then(r => {
      if (!r.ok) throw new Error('no api');
      remoteAvailable = true;
      return fetch('/api/movies').then(r2 => r2.json()).then(remoteMovies => {
        const normalized = (remoteMovies || []).map(m => ({
          id: m.id,
          title: m.title,
          year: m.year,
          watched: !!m.watched,
          poster: m.poster,
          rating: m.rating,
          notes: m.notes,
          added: m.added
        }));
        writeMovies(normalized);
      }).catch(() => {});
    }).catch(() => { remoteAvailable = false; });
  }

  function getById(id) {
    return readMovies().find(m => m.id === id);
  }

  function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function placeholderDataUrl(title, year) {
    const text = escapeHtml((title || 'Movie').slice(0, 20));
    const color = '#0ea5a4';
    const bg = '#0f172a';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='500' height='750'><rect width='100%' height='100%' fill='${bg}'/><text x='50%' y='50%' fill='${color}' font-family='Arial, Helvetica, sans-serif' font-size='28' dominant-baseline='middle' text-anchor='middle'>${text}</text></svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  // ---------- Helpers ----------
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function starsHtml(rating, sizeClass) {
    const r = Number(rating) || 0;
    const size = sizeClass || 'text-sm';
    let out = '';
    for (let i = 1; i <= 5; i++) {
      out += `<span class="${size} ${i <= r ? 'text-emerald-300' : 'text-zinc-600'}">★</span>`;
    }
    return out;
  }

  // ---------- Dashboard (index) ----------
  function renderIndex() {
    const totalEl = document.getElementById('statTotal');
    const watchedEl = document.getElementById('statWatched');
    const unwatchedEl = document.getElementById('statUnwatched');
    const listEl = document.getElementById('list');
    const search = document.getElementById('search');
    const filter = document.getElementById('filterWatched');
    const clearBtn = document.getElementById('clearBtn');

    function build() {
      const q = (search && search.value || '').trim().toLowerCase();
      const f = filter && filter.value;
      let movies = readMovies().slice().reverse();

      if (f === 'watched') movies = movies.filter(m => !!m.watched);
      if (f === 'unwatched') movies = movies.filter(m => !m.watched);
      if (q) movies = movies.filter(m => (m.title || '').toLowerCase().includes(q) || (m.notes||'').toLowerCase().includes(q));

      totalEl.textContent = readMovies().length;
      watchedEl.textContent = readMovies().filter(m => m.watched).length;
      unwatchedEl.textContent = readMovies().filter(m => !m.watched).length;

      // build carousel
      const carousel = document.getElementById('carousel');
      carousel.innerHTML = '';
      listEl.innerHTML = '';
      if (!movies.length) {
        carousel.innerHTML = '<div class="p-4 text-zinc-400">No posters yet.</div>';
        listEl.innerHTML = '<div class="p-6 bg-zinc-800 rounded text-zinc-400">No entries yet. Add one from + Add a Movie.</div>';
        return;
      }

      movies.forEach(m => {
        const item = document.createElement('div');
        item.className = 'bg-zinc-800 p-4 rounded flex items-start justify-between';
        item.innerHTML = `
          <div class="space-y-1">
            <div class="text-sm font-semibold text-zinc-100">${escapeHtml(m.title)}</div>
            <div class="text-xs text-zinc-400">${m.year ? escapeHtml(String(m.year)) + ' · ' : ''}${m.watched ? '<span class="text-emerald-300">Watched</span>' : '<span class="text-zinc-400">Unwatched</span>'}</div>
            <div class="mt-1">${starsHtml(m.rating,'text-sm')}</div>
            ${m.notes ? `<div class="mt-2 text-sm text-zinc-200">${escapeHtml(m.notes)}</div>` : ''}
          </div>
          <div class="flex-shrink-0 flex items-center gap-2">
            <a href="form.html?id=${encodeURIComponent(m.id)}" class="px-3 py-1 rounded bg-zinc-700 text-sm hover:bg-zinc-600">Edit</a>
            <button data-id="${m.id}" class="delBtn px-3 py-1 rounded bg-emerald-600 text-zinc-900 hover:bg-emerald-500">Delete</button>
          </div>
        `;
        listEl.appendChild(item);

        // carousel card
        const card = document.createElement('div');
        card.className = 'w-40 flex-shrink-0';
        const img = document.createElement('img');
        img.className = 'w-40 h-56 object-cover rounded shadow-md bg-zinc-800';
        img.src = m.poster || placeholderDataUrl(m.title, m.year);
        img.alt = m.title || 'poster';
        img.onerror = function () { this.onerror = null; this.src = placeholderDataUrl(m.title, m.year); };
        const caption = document.createElement('div');
        caption.className = 'mt-2 text-sm text-zinc-200';
        caption.innerHTML = `${escapeHtml(m.title)}<div class="text-xs text-zinc-400">${m.year || ''}</div>`;
        card.appendChild(img);
        card.appendChild(caption);
        card.dataset.id = m.id;
        carousel.appendChild(card);
      });
    }

    listEl.addEventListener('click', function (e) {
      const btn = e.target.closest('button.delBtn');
      if (btn) {
        const id = btn.dataset.id;
        if (!id) return;
        if (!confirm('Delete this movie?')) return;
        deleteMovie(id);
        build();
        return;
      }
      // open modal when clicking on item (but not Edit link)
      const link = e.target.closest('a');
      if (link && link.getAttribute('href') && link.getAttribute('href').startsWith('form.html')) return;
      const card = e.target.closest('.bg-zinc-800');
      if (card) {
        // find corresponding movie by nearby edit link or by title match
        const edit = card.querySelector('a[href^="form.html?id="]');
        const id = edit ? new URL(edit.href).searchParams.get('id') : null;
        if (id) {
          openModal(getById(id));
        }
      }
    });

    // carousel click -> modal
    const carouselEl = document.getElementById('carousel');
    carouselEl.addEventListener('click', function (e) {
      const card = e.target.closest('[data-id]');
      if (!card) return;
      const id = card.dataset.id;
      if (!id) return;
      openModal(getById(id));
    });

    if (search) search.addEventListener('input', build);
    if (filter) filter.addEventListener('change', build);
    if (clearBtn) clearBtn.addEventListener('click', function () {
      if (!confirm('Remove all movies from localStorage?')) return;
      writeMovies([]);
      build();
    });

    build();
  }

  // ---------- Diary page ----------
  function renderDiary() {
    const tbody = document.getElementById('diaryBody');
    function build() {
      const movies = readMovies().slice().reverse();
      tbody.innerHTML = '';
      if (!movies.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="px-4 py-6 text-zinc-400" colspan="6">No diary entries yet.</td>`;
        tbody.appendChild(tr);
        return;
      }
      movies.forEach(m => {
        const tr = document.createElement('tr');
        tr.dataset.id = m.id;
        tr.innerHTML = `
          <td class="px-4 py-3">${escapeHtml(m.title)}</td>
          <td class="px-4 py-3">${m.year ? escapeHtml(String(m.year)) : ''}</td>
          <td class="px-4 py-3">${m.watched ? 'Yes' : 'No'}</td>
          <td class="px-4 py-3">${m.rating != null ? starsHtml(m.rating,'text-sm') : ''}</td>
          <td class="px-4 py-3">${m.notes ? escapeHtml(m.notes) : ''}</td>
          <td class="px-4 py-3">${m.added ? new Date(m.added).toLocaleString() : ''}</td>
          <td class="px-4 py-3">
            <a class="mr-2 text-sm px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600" href="form.html?id=${encodeURIComponent(m.id)}">Edit</a>
            <button data-id="${m.id}" class="text-sm px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 del">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    tbody.addEventListener('click', function (e) {
      const btn = e.target.closest('button.del');
      if (btn) {
        const id = btn.dataset.id;
        if (!id) return;
        if (!confirm('Delete this movie?')) return;
        deleteMovie(id);
        build();
        return;
      }
      // open modal when clicking row (but not the Edit link)
      const link = e.target.closest('a');
      if (link && link.getAttribute('href') && link.getAttribute('href').startsWith('form.html')) return;
      const row = e.target.closest('tr[data-id]');
      if (row) {
        const id = row.dataset.id;
        openModal(getById(id));
      }
    });

    build();
  }

  // ---------- Form page ----------
  function renderForm() {
    const form = document.getElementById('movieForm');
    const cancel = document.getElementById('cancel');
    const params = new URLSearchParams(location.search);
    const editId = params.get('id');

    const titleEl = document.getElementById('title');
    const yearEl = document.getElementById('year');
    const watchedEl = document.getElementById('watched');
    const posterEl = document.getElementById('poster');
    const ratingEl = document.getElementById('rating');
    const notesEl = document.getElementById('notes');

    if (editId) {
      const found = getById(editId);
      if (found) {
        titleEl.value = found.title || '';
        yearEl.value = found.year || '';
        watchedEl.value = found.watched ? 'true' : 'false';
        posterEl.value = found.poster || '';
        // normalize older 0-10 ratings to 0-5
        if (found.rating != null) {
          const r = Number(found.rating);
          ratingEl.value = r > 5 ? Math.round((r / 10) * 5) : Math.round(r);
        } else {
          ratingEl.value = '';
        }
        notesEl.value = found.notes || '';
      }
    }

    // star rating UI
    const starButtons = Array.from(document.querySelectorAll('#starRating .star'));
    function setStarVisual(value) {
      starButtons.forEach(b => {
        const v = Number(b.dataset.value);
        if (v <= value) {
          b.classList.remove('text-zinc-500');
          b.classList.add('text-emerald-300');
        } else {
          b.classList.remove('text-emerald-300');
          b.classList.add('text-zinc-500');
        }
      });
      const hidden = document.getElementById('rating');
      if (hidden) hidden.value = value;
    }

    starButtons.forEach(b => {
      b.addEventListener('click', function () {
        const v = Number(this.dataset.value);
        setStarVisual(v);
      });
    });

    // initialize star visuals from hidden rating value
    const initialRating = Number(document.getElementById('rating').value) || 0;
    if (initialRating) setStarVisual(initialRating);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const title = titleEl.value.trim();
      if (!title) return alert('Title required');
      const payload = {
        id: editId || createId(),
        title: title,
        year: yearEl.value ? Number(yearEl.value) : '',
        watched: watchedEl.value === 'true',
        poster: posterEl.value ? posterEl.value.trim() : '',
        rating: ratingEl.value ? Number(ratingEl.value) : null,
        notes: notesEl.value.trim(),
        added: editId ? (getById(editId) || {}).added || Date.now() : Date.now()
      };

      if (editId) updateMovie(editId, payload);
      else createMovie(payload);

      location.href = 'diary.html';
    });

    cancel.addEventListener('click', function () {
      history.back();
    });
  }

  // ---------- Init dispatcher ----------
  // ---------- Modal helpers ----------
  function openModal(movie) {
    if (!movie) return;
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const meta = document.getElementById('modalMeta');
    const notes = document.getElementById('modalNotes');
    const rating = document.getElementById('modalRating');
    const poster = document.getElementById('modalPoster');

    title.textContent = movie.title || '';
    meta.innerHTML = `${movie.year ? escapeHtml(String(movie.year)) + ' · ' : ''}${movie.watched ? '<span class="text-emerald-300">Watched</span>' : '<span class="text-zinc-400">Not watched</span>'}`;
    rating.innerHTML = movie.rating != null ? `<div class="mt-2">${starsHtml(movie.rating,'text-xl')}<div class="text-sm text-zinc-400 mt-1">${escapeHtml(String(movie.rating))} / 5</div></div>` : '';
    notes.textContent = movie.notes || '';
    poster.src = movie.poster || placeholderDataUrl(movie.title, movie.year);
    poster.onerror = function () { this.onerror = null; this.src = placeholderDataUrl(movie.title, movie.year); };

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // attach close handlers
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    function onClose() { closeModal(); }
    overlay.addEventListener('click', onClose, { once: true });
    closeBtn.addEventListener('click', onClose, { once: true });
  }

  function closeModal() {
    const modal = document.getElementById('modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  function init() {
    const page = document.body && document.body.dataset && document.body.dataset.page;
    if (page === 'index') renderIndex();
    if (page === 'diary') renderDiary();
    if (page === 'form') renderForm();
  }

  function start() {
    detectRemoteAndSync().finally(() => init());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // Expose for debugging
  window.CineShelf = {
    readMovies, writeMovies, createMovie, updateMovie, deleteMovie, getById
  };
})();
