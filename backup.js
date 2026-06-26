const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_BACKUPS = 30;

// D: disk mavjud bo'lsa — u yerga, aks holda Hujjatlar papkasiga
function getBackupDir() {
  try {
    if (fs.existsSync('D:\\')) {
      return 'D:\\1uz arxiv\\AvtoETTN';
    }
  } catch (_) {}
  return path.join(os.homedir(), 'Documents', '1uz arxiv', 'AvtoETTN');
}
const BACKUP_DIR = getBackupDir();

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getDbPath() {
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'db.json');
    }
  } catch (e) {}
  return null;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}_${h}${min}`;
}

function createBackup() {
  const dbPath = getDbPath();
  if (!dbPath || !fs.existsSync(dbPath)) return { ok: false, message: "Ma'lumotlar bazasi topilmadi" };

  try {
    ensureBackupDir();

    const content = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(content);

    // Bo'sh bazani backup qilmaymiz
    const profiles = Object.values(parsed.profiles || {});
    const isEmpty = profiles.every(p =>
      (p.vehicles || []).length === 0 &&
      (p.customers || []).length === 0 &&
      (p.manualInvoices || []).length === 0
    );
    if (isEmpty) return { ok: false, message: "Bo'sh baza backup qilinmadi" };

    const fileName = `AvtoETTN_${formatDate(new Date())}.json`;
    const backupPath = path.join(BACKUP_DIR, fileName);
    fs.writeFileSync(backupPath, content, 'utf8');

    // Eski backuplarni tozalash (MAX_BACKUPS dan ortiqchasini o'chirish)
    cleanOldBackups();

    return { ok: true, path: backupPath, fileName };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('AvtoETTN_') && f.endsWith('.json'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    files.slice(MAX_BACKUPS).forEach(f => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f.name)); } catch (_) {}
    });
  } catch (_) {}
}

function listBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('AvtoETTN_') && f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(fullPath);
        let profileCount = 0;
        let vehicleCount = 0;
        try {
          const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          const profiles = Object.values(data.profiles || {});
          profileCount = profiles.length;
          vehicleCount = profiles.reduce((s, p) => s + (p.vehicles || []).length, 0);
        } catch (_) {}
        return { name: f, path: fullPath, date: stat.mtime.toISOString(), size: stat.size, profileCount, vehicleCount };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (_) {
    return [];
  }
}

function restoreBackup(backupPath) {
  const dbPath = getDbPath();
  if (!dbPath) return { ok: false, message: "Ilova yo'li topilmadi" };
  if (!fs.existsSync(backupPath)) return { ok: false, message: "Backup fayl topilmadi: " + backupPath };

  try {
    // Avval hozirgi bazani .bak ga ko'chirib qo'yamiz
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, dbPath + '.bak');
    }
    fs.copyFileSync(backupPath, dbPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function getLatestBackup() {
  const list = listBackups();
  return list.length > 0 ? list[0] : null;
}

// Bugun backup qilinganmi tekshirish
function isTodayBackedUp() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return false;
    const today = formatDate(new Date()).slice(0, 10); // "2026-06-26"
    const files = fs.readdirSync(BACKUP_DIR);
    return files.some(f => f.startsWith(`AvtoETTN_${today}`));
  } catch (_) {
    return false;
  }
}

// Yangi o'rnatilgan ilova ekanligini tekshirish (db.json yangi yoki bo'sh)
function isFreshInstall() {
  const dbPath = getDbPath();
  if (!dbPath || !fs.existsSync(dbPath)) return true;
  try {
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const profiles = Object.values(data.profiles || {});
    return profiles.every(p =>
      (p.vehicles || []).length === 0 &&
      (p.customers || []).length === 0 &&
      (p.manualInvoices || []).length === 0 &&
      Object.keys(p.settings || {}).length === 0
    );
  } catch (_) {
    return true;
  }
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  getLatestBackup,
  isTodayBackedUp,
  isFreshInstall,
  BACKUP_DIR
};
