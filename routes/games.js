const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../db'), { requireAuth } = require('./auth');
const h = fn => (req, res, next) => fn(req, res, next).catch(next);

const Run = z.object({
  score: z.number().int().min(0).max(6000), diamonds: z.number().int().min(0).max(12),
  keys: z.number().int().min(0).max(2), banished: z.number().int().min(0).max(300),
  levels: z.number().int().min(1).max(2), won: z.boolean(), duration: z.number().int().min(5).max(7200)
}).strict();

router.post('/', requireAuth, h(async (req, res) => {
  const r = Run.safeParse(req.body);
  if (!r.success) return res.status(400).json({ error: 'Invalid game data.' });
  const d = r.data;
  // anti-cheat: a score can never exceed what the rules allow
  const max = d.diamonds * 100 + d.keys * 150 + d.banished * 25 + 1200;
  if (d.score > max || (d.won && (d.diamonds < 12 || d.keys < 2))) return res.status(400).json({ error: 'Score rejected.' });
  await pool.query(`INSERT INTO games(user_id,score,diamonds,keys_found,banished,levels,won,duration)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [req.user.id, d.score, d.diamonds, d.keys, d.banished, d.levels, d.won, d.duration]);
  res.status(201).json({ ok: true });
}));

router.get('/me', requireAuth, h(async (req, res) => {
  const s = (await pool.query(`SELECT count(*)::int AS games, coalesce(max(score),0)::int AS best,
    coalesce(round(avg(score)),0)::int AS avg, coalesce(sum(banished),0)::int AS banished,
    coalesce(sum(diamonds),0)::int AS diamonds, (count(*) FILTER (WHERE won))::int AS escapes
    FROM games WHERE user_id=$1`, [req.user.id])).rows[0];
  const recent = (await pool.query(`SELECT score, diamonds, banished, levels, won, duration, played_at
    FROM games WHERE user_id=$1 ORDER BY played_at DESC LIMIT 10`, [req.user.id])).rows;
  res.json({ stats: s, recent });
}));

router.get('/leaderboard', requireAuth, h(async (req, res) => {
  const rows = (await pool.query(`SELECT u.username, max(g.score)::int AS best, count(*)::int AS games,
    (count(*) FILTER (WHERE g.won))::int AS escapes
    FROM games g JOIN users u ON u.id=g.user_id GROUP BY u.username ORDER BY best DESC LIMIT 10`)).rows;
  res.json({ rows });
}));

module.exports = router;
