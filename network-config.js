const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  networkMode: 'local', // 'local' | 'server' | 'client'
  serverIp: '',
  serverPort: 3737,
};

function getConfigPath() {
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

module.exports = { get, save, DEFAULTS };
