const jwt = require('jsonwebtoken');
const { readDB } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-secret-key-2024';

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = readDB();
    const user = db.users.find(u => u.id === decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  } catch (e) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireProjectAccess(req, res, next) {
  const db = readDB();
  const projectId = req.params.projectId || req.body.projectId;
  const project = db.projects.find(p => p.id === projectId);

  if (!project) return res.status(404).json({ error: 'Project not found' });

  const member = db.projectMembers.find(
    m => m.projectId === projectId && m.userId === req.user.id
  );

  if (!member && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied to this project' });
  }

  req.project = project;
  req.projectRole = member ? member.role : 'admin';
  next();
}

module.exports = { authenticate, requireAdmin, requireProjectAccess, JWT_SECRET };
