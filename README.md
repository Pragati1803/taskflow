# ⚡ TaskFlow — Team Task Manager

A full-stack team task management application with role-based access control, project management, and real-time task tracking.

---

## 🌐 Live Demo

> Deploy URL goes here after Railway deployment

---

## 🚀 Features

### Authentication
- JWT-based signup & login
- First registered user automatically becomes **Admin**
- All subsequent users are **Members** by default
- Protected routes — token required for all API calls

### Role-Based Access Control
| Feature | Admin | Member |
|---|---|---|
| Create projects | ✅ | ❌ |
| Delete projects | ✅ | ❌ |
| Manage members | ✅ | ❌ (project admins can) |
| Create tasks | ✅ | ✅ (in their projects) |
| Edit tasks | ✅ | ✅ (assigned or created) |
| Delete tasks | ✅ | ✅ (only own tasks) |
| View all projects | ✅ | ❌ (only assigned) |

### Project Management
- Create, edit, delete projects (admin)
- Color-coded projects with progress tracking
- Add/remove team members per project
- Per-project member roles (admin/member)

### Task Management
- Create tasks with title, description, status, priority, assignee, due date
- Status flow: `To Do → In Progress → Review → Done`
- Priority levels: `Low / Medium / High / Critical`
- Overdue detection and highlighting
- Filter tasks by status, priority, project

### Dashboard
- Live stats: projects, total tasks, my tasks, overdue count
- Status breakdown with progress bars
- Overall completion percentage
- Overdue task alerts
- Recent activity feed

### Views
- **Kanban Board** — drag-friendly column view per project
- **List View** — sortable table with all task details
- **Team Page** — see all workspace members

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (no build step, CDN), Vanilla CSS |
| Backend | Node.js, Express 5 |
| Database | JSON file-based persistence (zero dependencies) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | express-validator |
| Deployment | Railway |

---

## 📁 Project Structure

```
taskflow/
├── backend/
│   ├── src/
│   │   ├── server.js          # Express app entry point
│   │   ├── db/
│   │   │   └── database.js    # JSON file database
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT auth + RBAC middleware
│   │   └── routes/
│   │       ├── auth.js        # /api/auth/*
│   │       ├── projects.js    # /api/projects/*
│   │       └── tasks.js       # /api/tasks/*
│   ├── data/
│   │   └── db.json            # Auto-created database file
│   ├── package.json
│   ├── railway.toml
│   └── .env.example
├── frontend/
│   └── dist/
│       └── index.html         # Complete React SPA (single file)
├── railway.toml
├── Procfile
└── README.md
```

---

## 🔌 REST API Reference

### Auth
```
POST /api/auth/signup     { name, email, password }
POST /api/auth/login      { email, password }
GET  /api/auth/me         → current user
GET  /api/auth/users      → all users (for assignment)
```

### Projects
```
GET    /api/projects                      → list accessible projects
POST   /api/projects                      → create project (admin)
GET    /api/projects/:id                  → project detail + tasks + members
PUT    /api/projects/:id                  → update project
DELETE /api/projects/:id                  → delete project (admin)
POST   /api/projects/:id/members          → add member
DELETE /api/projects/:id/members/:userId  → remove member
```

### Tasks
```
GET    /api/tasks                    → all accessible tasks
GET    /api/tasks/dashboard/stats    → dashboard statistics
GET    /api/tasks/project/:id        → tasks for a project
POST   /api/tasks                    → create task
PUT    /api/tasks/:id                → update task
DELETE /api/tasks/:id                → delete task
```

---

**First-time setup:**
1. Click "Sign up" and create your first account
2. You'll automatically be assigned the **Admin** role
3. Create a project, add tasks, invite team members!

---

## 🔐 Security Features

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens expire after 7 days
- All routes protected with auth middleware
- Project-level access control (can't see other projects)
- Input validation on all endpoints
- SQL injection safe (no SQL used)

---

## 📊 Data Model

```
User { id, name, email, password(hashed), role, createdAt }

Project { id, name, description, color, createdBy, createdAt }

ProjectMember { id, projectId, userId, role(admin|member), joinedAt }

Task { id, title, description, projectId, assigneeId, status,
       priority, dueDate, createdBy, createdAt, updatedAt }
```

---


---

## 👥 Pragati Srivastava

Built for the Full-Stack Assignment — Team Task Manager with RBAC.
