const express = require('express');
const { body, validationResult } = require('express-validator');
const { readDB, writeDB, generateId } = require('../db/database');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = ['todo', 'in_progress', 'review', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

// GET /api/tasks - get all tasks for current user (dashboard)
router.get('/', authenticate, (req, res) => {
  const db = readDB();
  let tasks;

  if (req.user.role === 'admin') {
    tasks = db.tasks;
  } else {
    const memberProjectIds = db.projectMembers
      .filter(m => m.userId === req.user.id)
      .map(m => m.projectId);
    tasks = db.tasks.filter(
      t => memberProjectIds.includes(t.projectId) || t.assigneeId === req.user.id
    );
  }

  const enriched = tasks.map(t => {
    const project = db.projects.find(p => p.id === t.projectId);
    const assignee = t.assigneeId ? db.users.find(u => u.id === t.assigneeId) : null;
    const creator = db.users.find(u => u.id === t.createdBy);
    return {
      ...t,
      project: project ? { id: project.id, name: project.name, color: project.color } : null,
      assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : null,
      creator: creator ? { id: creator.id, name: creator.name } : null,
      isOverdue: t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done'
    };
  });

  res.json({ tasks: enriched });
});

// GET /api/tasks/project/:projectId - tasks for a project
router.get('/project/:projectId', authenticate, requireProjectAccess, (req, res) => {
  const db = readDB();
  const tasks = db.tasks.filter(t => t.projectId === req.params.projectId);

  const enriched = tasks.map(t => {
    const assignee = t.assigneeId ? db.users.find(u => u.id === t.assigneeId) : null;
    const creator = db.users.find(u => u.id === t.createdBy);
    return {
      ...t,
      assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : null,
      creator: creator ? { id: creator.id, name: creator.name } : null,
      isOverdue: t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done'
    };
  });

  res.json({ tasks: enriched });
});

// POST /api/tasks - create task
router.post('/', authenticate, [
  body('title').trim().isLength({ min: 2 }).withMessage('Task title required'),
  body('projectId').notEmpty().withMessage('Project ID required'),
  body('status').optional().isIn(VALID_STATUSES),
  body('priority').optional().isIn(VALID_PRIORITIES),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = readDB();
  const { title, description, projectId, assigneeId, status, priority, dueDate } = req.body;

  // Check project access
  const member = db.projectMembers.find(m => m.projectId === projectId && m.userId === req.user.id);
  if (!member && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'No access to this project' });
  }

  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Validate assignee is project member
  if (assigneeId) {
    const assigneeMember = db.projectMembers.find(m => m.projectId === projectId && m.userId === assigneeId);
    if (!assigneeMember && req.user.role !== 'admin') {
      return res.status(400).json({ error: 'Assignee must be a project member' });
    }
  }

  const task = {
    id: generateId(),
    title,
    description: description || '',
    projectId,
    assigneeId: assigneeId || null,
    status: status || 'todo',
    priority: priority || 'medium',
    dueDate: dueDate || null,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.tasks.push(task);
  writeDB(db);

  const assignee = task.assigneeId ? db.users.find(u => u.id === task.assigneeId) : null;
  res.status(201).json({
    task: {
      ...task,
      assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : null,
      project: { id: project.id, name: project.name, color: project.color }
    }
  });
});

// PUT /api/tasks/:taskId - update task
router.put('/:taskId', authenticate, [
  body('status').optional().isIn(VALID_STATUSES),
  body('priority').optional().isIn(VALID_PRIORITIES),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = readDB();
  const taskIdx = db.tasks.findIndex(t => t.id === req.params.taskId);
  if (taskIdx === -1) return res.status(404).json({ error: 'Task not found' });

  const task = db.tasks[taskIdx];

  // Check access: admin, project member, or task assignee
  const member = db.projectMembers.find(m => m.projectId === task.projectId && m.userId === req.user.id);
  if (!member && req.user.role !== 'admin' && task.assigneeId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { title, description, assigneeId, status, priority, dueDate } = req.body;

  db.tasks[taskIdx] = {
    ...task,
    ...(title && { title }),
    ...(description !== undefined && { description }),
    ...(assigneeId !== undefined && { assigneeId }),
    ...(status && { status }),
    ...(priority && { priority }),
    ...(dueDate !== undefined && { dueDate }),
    updatedAt: new Date().toISOString()
  };

  writeDB(db);

  const updatedTask = db.tasks[taskIdx];
  const assignee = updatedTask.assigneeId ? db.users.find(u => u.id === updatedTask.assigneeId) : null;
  const project = db.projects.find(p => p.id === updatedTask.projectId);

  res.json({
    task: {
      ...updatedTask,
      assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : null,
      project: project ? { id: project.id, name: project.name, color: project.color } : null,
      isOverdue: updatedTask.dueDate && new Date(updatedTask.dueDate) < new Date() && updatedTask.status !== 'done'
    }
  });
});

// DELETE /api/tasks/:taskId
router.delete('/:taskId', authenticate, (req, res) => {
  const db = readDB();
  const task = db.tasks.find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Only admin or task creator can delete
  if (req.user.role !== 'admin' && task.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'Only admin or task creator can delete tasks' });
  }

  db.tasks = db.tasks.filter(t => t.id !== req.params.taskId);
  writeDB(db);

  res.json({ message: 'Task deleted' });
});

// GET /api/tasks/dashboard - dashboard stats
router.get('/dashboard/stats', authenticate, (req, res) => {
  const db = readDB();
  let tasks, projects;

  if (req.user.role === 'admin') {
    tasks = db.tasks;
    projects = db.projects;
  } else {
    const memberProjectIds = db.projectMembers
      .filter(m => m.userId === req.user.id)
      .map(m => m.projectId);
    tasks = db.tasks.filter(
      t => memberProjectIds.includes(t.projectId) || t.assigneeId === req.user.id
    );
    projects = db.projects.filter(p => memberProjectIds.includes(p.id));
  }

  const now = new Date();
  const myTasks = tasks.filter(t => t.assigneeId === req.user.id);
  const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done');

  const stats = {
    totalProjects: projects.length,
    totalTasks: tasks.length,
    myTasks: myTasks.length,
    overdueTasks: overdueTasks.length,
    byStatus: {
      todo: tasks.filter(t => t.status === 'todo').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      done: tasks.filter(t => t.status === 'done').length,
    },
    byPriority: {
      critical: tasks.filter(t => t.priority === 'critical').length,
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length,
    },
    recentTasks: tasks
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(t => {
        const project = db.projects.find(p => p.id === t.projectId);
        const assignee = t.assigneeId ? db.users.find(u => u.id === t.assigneeId) : null;
        return {
          ...t,
          project: project ? { id: project.id, name: project.name, color: project.color } : null,
          assignee: assignee ? { id: assignee.id, name: assignee.name } : null
        };
      }),
    overdueList: overdueTasks.slice(0, 5).map(t => {
      const project = db.projects.find(p => p.id === t.projectId);
      return { ...t, project: project ? { id: project.id, name: project.name, color: project.color } : null };
    })
  };

  res.json({ stats });
});

module.exports = router;
