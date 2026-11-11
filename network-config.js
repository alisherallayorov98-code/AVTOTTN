const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  networkMode: 'local', // 'local' | 'server' | 'client'
  serverIp: '',
  serverPort: 3737,
  accessKey: '',     // server va mijozlar uchun umumiy kirish kaliti
  userName: '',      // shu kompyuter foydalanuvchisi (jurnalda ko'rinadi)
  clientProfile: '', // mijoz rejimida shu kompyuter tanlagan kompaniya
};

function getConfigPath() {
  if (process.env.AVTO_NETCFG_PATH) return process.env.AVTO_NETCFG_PATH; // testlar uchun
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'network-config.json');
    }
  } catch (_) {}
  return path.join(__dirname, 'network-config.json');
}

function get() {
  try {
    const p = getConfigPath();
    if (!fs.existsSync(p)) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(p, 'utf8')) };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

function save(cfg) {
  fs.writeFileSync(getConfigPath(), JSON.stringify({ ...DEFAULTS, ...cfg }, null, 2), 'utf8');
  return true;
}

function generateKey() {
  return require('crypto').randomBytes(6).toString('hex'); // 12 belgi
}

// Server uchun kalit bo'lmasa — yaratib saqlaydi
function ensureAccessKey() {
  const cfg = get();
  if (cfg.accessKey) return cfg.accessKey;
  const accessKey = generateKey();
  save({ ...cfg, accessKey });
  return accessKey;
}

module.exports = { get, save, DEFAULTS, generateKey, ensureAccessKey };
