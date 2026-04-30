const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../../data/db.json');

const defaultDB = {
  users: [],
  projects: [],
  tasks: [],
  projectMembers: []
};

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDB(defaultDB);
      return JSON.parse(JSON.stringify(defaultDB));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return JSON.parse(JSON.stringify(defaultDB));
  }
}

function writeDB(data) {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

module.exports = { readDB, writeDB, generateId };
