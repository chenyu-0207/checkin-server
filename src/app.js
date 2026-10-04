require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('./db');
const authRoutes = require('./routes/auth');
const activityRoutes = require('./routes/activities');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/activities', activityRoutes);

// 同域名托管前端单页（public/index.html）
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) app.use(express.static(publicDir));

// 全局错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('checkin-server running on http://localhost:' + PORT));
