const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign } = require('../middleware/auth');

// 学生注册：学号、姓名、书院、密码
router.post('/register', (req, res) => {
  const { studentId, name, college, password } = req.body || {};
  if (!studentId || !name || !college || !password) {
    return res.status(400).json({ error: '请填写学号、姓名、书院和密码' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: '密码至少 6 位' });
  }
  if (db.prepare('SELECT id FROM users WHERE student_id=?').get(studentId)) {
    return res.status(409).json({ error: '该学号已注册' });
  }
  const info = db.prepare(
    'INSERT INTO users (student_id,name,college,password_hash,role,created_at) VALUES (?,?,?,?,?,?)'
  ).run(studentId, name, college, bcrypt.hashSync(password, 10), 'student', Date.now());
  const user = db.prepare('SELECT id,student_id,name,college,role FROM users WHERE id=?').get(info.lastInsertRowid);
  res.json({ token: sign(user), user });
});

// 登录（学生与管理员共用）
router.post('/login', (req, res) => {
  const { studentId, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE student_id=?').get(studentId || '');
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: '学号或密码错误' });
  }
  res.json({
    token: sign(user),
    user: { id: user.id, student_id: user.student_id, name: user.name, college: user.college, role: user.role }
  });
});

module.exports = router;
