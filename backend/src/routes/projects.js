const express = require('express');
const { body, validationResult } = require('express-validator');
const { readDB, writeDB, generateId } = require('../db/database');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router();

// GET /api/projects - list all projects user has access to
router.get('/', authenticate, (req, res) => {
  const db = readDB();
  let projects;

  if (req.user.role === 'admin') {
    projects = db.projects;
  } else {
    const memberProjectIds = db.projectMembers
      .filter(m => m.userId === req.user.id)
      .map(m => m.projectId);
    projects = db.projects.filter(p => memberProjectIds.includes(p.id));
  }

  // Enrich with stats
  const enriched = projects.map(p => {
    const tasks = db.tasks.filter(t => t.projectId === p.id);
    const members = db.projectMembers.filter(m => m.projectId === p.id);
    const memberUsers = members.map(m => {
      const u = db.users.find(u => u.id === m.userId);
      return u ? { id: u.id, name: u.name, email: u.email, role: m.role } : null;
    }).filter(Boolean);

    return {
      ...p,
      taskCount: tasks.length,
      completedCount: tasks.filter(t => t.status === 'done').length,
      overdueCount: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length,
      memberCount: members.length,
      members: memberUsers
    };
  });

  res.json({ projects: enriched });
});

// POST /api/projects - create project (admin only)
router.post('/', authenticate, [
  body('name').trim().isLength({ min: 2 }).withMessage('Project name required'),
  body('description').optional().trim(),
], (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create projects' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description, color } = req.body;
  const db = readDB();

  const project = {
    id: generateId(),
    name,
    description: description || '',
    color: color || '#6366f1',
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.projects.push(project);

  // Add creator as admin member
  db.projectMembers.push({
    id: generateId(),
    projectId: project.id,
    userId: req.user.id,
    role: 'admin',
    joinedAt: new Date().toISOString()
  });

  writeDB(db);
  res.status(201).json({ project });
});

// GET /api/projects/:projectId
router.get('/:projectId', authenticate, requireProjectAccess, (req, res) => {
  const db = readDB();
  const tasks = db.tasks.filter(t => t.projectId === req.params.projectId);
  const members = db.projectMembers
    .filter(m => m.projectId === req.params.projectId)
    .map(m => {
      const u = db.users.find(u => u.id === m.userId);
      return u ? { id: u.id, name: u.name, email: u.email, projectRole: m.role } : null;
    }).filter(Boolean);

  const enrichedTasks = tasks.map(t => {
    const assignee = t.assigneeId ? db.users.find(u => u.id === t.assigneeId) : null;
    return {
      ...t,
      assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : null
    };
  });

  res.json({ project: req.project, tasks: enrichedTasks, members });
});

// PUT /api/projects/:projectId
router.put('/:projectId', authenticate, requireProjectAccess, [
  body('name').optional().trim().isLength({ min: 2 }),
], (req, res) => {
  if (req.projectRole !== 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required to edit project' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = readDB();
  const idx = db.projects.findIndex(p => p.id === req.params.projectId);
  if (idx === -1) return res.status(404).json({ error: 'Project not found' });

  const { name, description, color } = req.body;
  db.projects[idx] = {
    ...db.projects[idx],
    ...(name && { name }),
    ...(description !== undefined && { description }),
    ...(color && { color }),
    updatedAt: new Date().toISOString()
  };

  writeDB(db);
  res.json({ project: db.projects[idx] });
});

// DELETE /api/projects/:projectId
router.delete('/:projectId', authenticate, requireProjectAccess, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can delete projects' });
  }

  const db = readDB();
  db.projects = db.projects.filter(p => p.id !== req.params.projectId);
  db.tasks = db.tasks.filter(t => t.projectId !== req.params.projectId);
  db.projectMembers = db.projectMembers.filter(m => m.projectId !== req.params.projectId);
  writeDB(db);

  res.json({ message: 'Project deleted successfully' });
});

// POST /api/projects/:projectId/members - add member
router.post('/:projectId/members', authenticate, requireProjectAccess, [
  body('userId').notEmpty().withMessage('User ID required'),
  body('role').optional().isIn(['admin', 'member']),
], (req, res) => {
  if (req.projectRole !== 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required to manage members' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { userId, role } = req.body;
  const db = readDB();

  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existing = db.projectMembers.find(
    m => m.projectId === req.params.projectId && m.userId === userId
  );
  if (existing) return res.status(409).json({ error: 'User already a member' });

  const member = {
    id: generateId(),
    projectId: req.params.projectId,
    userId,
    role: role || 'member',
    joinedAt: new Date().toISOString()
  };

  db.projectMembers.push(member);
  writeDB(db);

  res.status(201).json({
    member: { ...member, user: { id: user.id, name: user.name, email: user.email } }
  });
});

// DELETE /api/projects/:projectId/members/:userId
router.delete('/:projectId/members/:userId', authenticate, requireProjectAccess, (req, res) => {
  if (req.projectRole !== 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const db = readDB();
  db.projectMembers = db.projectMembers.filter(
    m => !(m.projectId === req.params.projectId && m.userId === req.params.userId)
  );
  writeDB(db);

  res.json({ message: 'Member removed' });
});

module.exports = router;
