const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// 生成不重复的 6 位活动签到码
function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let s = '';
    for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
    if (!db.prepare('SELECT 1 FROM activities WHERE code=?').get(s)) return s;
  }
}

// 活动列表：管理员看全部；学生附带自己在该活动的签到时间 checked_at
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM checkins c WHERE c.activity_code = a.code) AS total,
      c2.checked_at AS checked_at
    FROM activities a
    LEFT JOIN checkins c2 ON c2.activity_code = a.code AND c2.user_id = ?
    ORDER BY a.created_at DESC`).all(req.user.uid);
  res.json(rows);
});

// 创建活动（仅管理员）
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { name, date, location } = req.body || {};
  if (!name || !date) return res.status(400).json({ error: '请填写活动名称和日期' });
  const code = genCode();
  db.prepare('INSERT INTO activities (code,name,date,location,open,created_by,created_at) VALUES (?,?,?,?,1,?,?)')
    .run(code, name, date, location || '', req.user.uid, Date.now());
  res.json(db.prepare('SELECT * FROM activities WHERE code=?').get(code));
});

// 结束 / 重开签到（仅管理员）
router.patch('/:code/open', requireAuth, requireAdmin, (req, res) => {
  const act = db.prepare('SELECT * FROM activities WHERE code=?').get(req.params.code);
  if (!act) return res.status(404).json({ error: '活动不存在' });
  const open = req.body && typeof req.body.open === 'boolean'
    ? req.body.open
    : !act.open;
  db.prepare('UPDATE activities SET open=? WHERE code=?').run(open ? 1 : 0, act.code);
  res.json({ ok: true, open });
});

// 删除活动及其签到数据（仅管理员）
router.delete('/:code', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM checkins WHERE activity_code=?').run(req.params.code);
  db.prepare('DELETE FROM activities WHERE code=?').run(req.params.code);
  res.json({ ok: true });
});

// 学生签到：自动带入账号中的姓名与书院，防重复
router.post('/:code/checkin', requireAuth, (req, res) => {
  const act = db.prepare('SELECT * FROM activities WHERE code=?').get(req.params.code);
  if (!act) return res.status(404).json({ error: '活动不存在' });
  if (!act.open) return res.status(400).json({ error: '该活动已结束签到' });
  const me = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.uid);
  try {
    db.prepare('INSERT INTO checkins (activity_code,user_id,name,college,checked_at) VALUES (?,?,?,?,?)')
      .run(act.code, me.id, me.name, me.college, Date.now());
  } catch {
    return res.status(409).json({ error: '请勿重复签到' });
  }
  res.json({ ok: true, activity: act.name, name: me.name, college: me.college });
});

// 实时签到名单（仅管理员）
router.get('/:code/checkins', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT u.student_id, c.name, c.college, c.checked_at
    FROM checkins c JOIN users u ON u.id = c.user_id
    WHERE c.activity_code = ? ORDER BY c.checked_at`).all(req.params.code);
  res.json(rows);
});

// 导出 CSV（含 BOM，Excel 直接打开不乱码）
router.get('/:code/export', requireAuth, requireAdmin, (req, res) => {
  const act = db.prepare('SELECT * FROM activities WHERE code=?').get(req.params.code);
  if (!act) return res.status(404).json({ error: '活动不存在' });
  const rows = db.prepare(`
    SELECT u.student_id, c.name, c.college, c.checked_at
    FROM checkins c JOIN users u ON u.id = c.user_id
    WHERE c.activity_code = ? ORDER BY c.college, c.checked_at`).all(act.code);
  const lines = [['序号', '学号', '姓名', '书院', '签到时间']].concat(
    rows.map((r, i) => [
      i + 1, r.student_id, r.name, r.college,
      new Date(r.checked_at).toLocaleString('zh-CN', { hour12: false })
    ])
  );
  const csv = '\ufeff' + lines.map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(act.name + '-签到名单.csv') + '"');
  res.send(csv);
});

module.exports = router;
