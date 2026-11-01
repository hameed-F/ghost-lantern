const $ = s => document.querySelector(s);
// Everything below uses textContent, so database values can never be interpreted as HTML.
function row(tbody, cells) { const tr = document.createElement('tr'); cells.forEach(c => { const td = document.createElement('td'); td.textContent = c; tr.appendChild(td); }); tbody.appendChild(tr); }
async function api(u) { const r = await fetch(u, { credentials: 'same-origin' }); if (r.status === 401) { location.href = '/login.html'; throw new Error('auth'); } return r.json(); }
(async () => {
  const me = await api('/api/auth/me');
  $('#hello').textContent = 'Welcome back, ' + me.username.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
  const { stats, recent } = await api('/api/games/me');
  const items = [['Games played', stats.games], ['Best score', stats.best], ['Average score', stats.avg], ['Ghosts banished', stats.banished], ['Diamonds', stats.diamonds], ['Escapes', stats.escapes]];
  items.forEach(([l, v]) => { const d = document.createElement('div'); d.className = 'stat'; const b = document.createElement('b'); b.textContent = v; const s = document.createElement('span'); s.textContent = l; d.append(b, s); $('#stats').appendChild(d); });
  if (!recent.length) row($('#recent'), ['No runs yet. Press Play now.', '', '', '', '', '']);
  recent.forEach(g => row($('#recent'), [new Date(g.played_at).toLocaleString(), g.score, g.diamonds, g.banished, g.won ? 'Escaped' : 'Lost on level ' + g.levels, g.duration + 's']));
  const { rows } = await api('/api/games/leaderboard');
  if (!rows.length) row($('#board'), ['', 'Nobody yet', '', '', '']);
  rows.forEach((r, i) => row($('#board'), [i + 1, r.username, r.best, r.games, r.escapes]));
})().catch(e => { if (e.message !== 'auth') $('#hello').textContent = 'Could not load your stats.'; });
$('#logout').onclick = async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); location.href = '/'; };
