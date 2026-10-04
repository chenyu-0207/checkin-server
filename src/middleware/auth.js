const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret';

function sign(user) {
  return jwt.sign({ uid: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '需要举办方权限' });
  next();
}

module.exports = { sign, requireAuth, requireAdmin };
