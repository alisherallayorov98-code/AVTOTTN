const fs = require('fs');
const path = require('path');

function getSeedDbPath() {
  let baseDir = __dirname;
  if (__dirname.includes('app.asar')) {
    if (process.resourcesPath) {
      const resSeed = path.join(process.resourcesPath, 'db.json');
      if (fs.existsSync(resSeed)) return resSeed;
    }
    baseDir = path.join(__dirname, '..', '..');
  } else if (__dirname.endsWith('dist')) {
    baseDir = path.join(__dirname, '..');
  }
  return path.join(baseDir, 'db.json');
}

let _dbPath = null;
function getDbPath() {
  if (_dbPath) return _dbPath;
  let userDataDir = null;
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') userDataDir = app.getPath('userData');
  } catch (e) {}

  if (!userDataDir) {
    _dbPath = getSeedDbPath();
    return _dbPath;
  }

  const targetPath = path.join(userDataDir, 'db.json');
  if (!fs.existsSync(targetPath)) {
    try {
      const seedPath = getSeedDbPath();
      if (fs.existsSync(seedPath)) {
        fs.copyFileSync(seedPath, targetPath);
      } else {
        fs.writeFileSync(targetPath, JSON.stringify(makeEmptyDb(), null, 2), 'utf8');
      }
    } catch (err) {
      console.error('db.json seed ko\'chirishda xatolik:', err);
    }
  }
  _dbPath = targetPath;
  return _dbPath;
}

function makeEmptyDb() {
  const id = 'p_' + Date.now();
  return {
    currentProfile: id,
    profiles: { [id]: makeEmptyProfile(id, 'Asosiy kompaniya') }
  };
}

function makeEmptyProfile(id, name) {
  return { id, name, vehicles: [], customers: [], settings: {}, writtenInvoiceIds: [], manualInvoices: [] };
}

function getData() {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) return makeEmptyDb();
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(raw);
    return migrate(data);
  } catch (err) {
    console.error('db.json o\'qishda xatolik:', err);
    try { fs.copyFileSync(dbPath, dbPath + '.bak'); } catch (_) {}
    return makeEmptyDb();
  }
}

function migrate(data) {
  // v1 → v2: flat structure → profiles
  if (!data.profiles) {
    const id = 'p_default';
    const profile = makeEmptyProfile(id, data.settings?.senderName || 'Asosiy kompaniya');
    profile.vehicles = data.vehicles || [];
    profile.customers = data.customers || [];
    profile.settings = data.settings || {};
    profile.writtenInvoiceIds = data.writtenInvoiceIds || [];
    profile.manualInvoices = data.manualInvoices || [];
    const migrated = { currentProfile: id, profiles: { [id]: profile } };
    saveData(migrated);
    console.log('db.json v1→v2 migratsiyasi bajarildi (profiles)');
    return migrated;
  }

  // SOATO normalization across all profiles
  let changed = false;
  Object.values(data.profiles).forEach(profile => {
    (profile.customers || []).forEach(c => {
      (c.addresses || []).forEach(a => {
        if (String(a.oblastCode) === '33') { a.oblastCode = '1726'; changed = true; }
      });
    });
  });
  if (changed) saveData(data);
  return data;
}

function saveData(data) {
  try {
    fs.writeFileSync(getDbPath(), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('db.json yozishda xatolik:', err);
  }
}

function current() {
  const data = getData();
  let id = data.currentProfile;
  let profile = data.profiles[id];
  if (!profile) {
    id = Object.keys(data.profiles)[0];
    data.currentProfile = id;
    profile = data.profiles[id];
    saveData(data);
  }
  return { data, profile };
}

function save(data, profile) {
  data.profiles[profile.id] = profile;
  saveData(data);
}

module.exports = {
  // ─── Profil boshqaruvi ───────────────────────────────────────────────────────
  getProfiles: () => {
    const data = getData();
    return {
      currentId: data.currentProfile,
      list: Object.values(data.profiles).map(p => ({ id: p.id, name: p.name }))
    };
  },

  createProfile: (name) => {
    const data = getData();
    const id = 'p_' + Date.now();
    data.profiles[id] = makeEmptyProfile(id, name || 'Yangi kompaniya');
    data.currentProfile = id;
    saveData(data);
    return { id, name: data.profiles[id].name };
  },

  switchProfile: (id) => {
    const data = getData();
    if (!data.profiles[id]) throw new Error('Profil topilmadi: ' + id);
    data.currentProfile = id;
    saveData(data);
    return true;
  },

  renameProfile: (id, name) => {
    const data = getData();
    if (!data.profiles[id]) throw new Error('Profil topilmadi');
    data.profiles[id].name = name;
    saveData(data);
    return true;
  },

  deleteProfile: (id) => {
    const data = getData();
    if (Object.keys(data.profiles).length <= 1) throw new Error("Oxirgi profilni o'chirib bo'lmaydi");
    delete data.profiles[id];
    if (data.currentProfile === id) data.currentProfile = Object.keys(data.profiles)[0];
    saveData(data);
    return true;
  },

  // ─── Mashinalar ──────────────────────────────────────────────────────────────
  getVehicles: () => {
    const { profile } = current();
    return profile.vehicles || [];
  },

  saveVehicle: (vehicle) => {
    const { data, profile } = current();
    if (!profile.vehicles) profile.vehicles = [];
    if (vehicle.id) {
      const idx = profile.vehicles.findIndex(v => v.id === vehicle.id);
      if (idx !== -1) profile.vehicles[idx] = { ...profile.vehicles[idx], ...vehicle };
      else profile.vehicles.push(vehicle);
    } else {
      vehicle.id = 'v_' + Date.now();
      profile.vehicles.push(vehicle);
    }
    save(data, profile);
    return vehicle;
  },

  deleteVehicle: (id) => {
    const { data, profile } = current();
    const len = (profile.vehicles || []).length;
    profile.vehicles = (profile.vehicles || []).filter(v => v.id !== id);
    if (profile.vehicles.length < len) { save(data, profile); return true; }
    return false;
  },

  // ─── Mijozlar ────────────────────────────────────────────────────────────────
  getCustomers: () => {
    const { profile } = current();
    return profile.customers || [];
  },

  saveCustomer: (customer) => {
    const { data, profile } = current();
    if (!profile.customers) profile.customers = [];
    const idx = profile.customers.findIndex(c => c.tin === customer.tin);
    if (idx !== -1) profile.customers[idx] = { ...profile.customers[idx], ...customer };
    else profile.customers.push(customer);
    save(data, profile);
    return customer;
  },

  // ─── Sozlamalar ──────────────────────────────────────────────────────────────
  getSettings: () => {
    const { profile } = current();
    const s = profile.settings || {};
    const isDemoUrl = !s.soliqApiUrl || s.soliqApiUrl.includes('example.com');
    const isDemoKey = !s.soliqApiKey || s.soliqApiKey.startsWith('demo-');
    return {
      ...s,
      soliqApiUrl: isDemoUrl ? (process.env.SOLIQ_API_URL || s.soliqApiUrl) : s.soliqApiUrl,
      soliqApiKey: isDemoKey ? (process.env.SOLIQ_API_KEY || s.soliqApiKey) : s.soliqApiKey
    };
  },

  saveSettings: (settings) => {
    const { data, profile } = current();
    profile.settings = { ...profile.settings, ...settings };
    save(data, profile);
    return profile.settings;
  },

  // ─── Qo'lda kiritilgan fakturalar ────────────────────────────────────────────
  getManualInvoices: () => {
    const { profile } = current();
    return profile.manualInvoices || [];
  },

  saveManualInvoice: (invoice) => {
    const { data, profile } = current();
    if (!profile.manualInvoices) profile.manualInvoices = [];
    if (!invoice.id) invoice.id = 'manual_' + Date.now();
    const idx = profile.manualInvoices.findIndex(inv => inv.id === invoice.id);
    if (idx !== -1) profile.manualInvoices[idx] = { ...profile.manualInvoices[idx], ...invoice };
    else profile.manualInvoices.push(invoice);
    save(data, profile);
    return invoice;
  },

  deleteManualInvoice: (id) => {
    const { data, profile } = current();
    const len = (profile.manualInvoices || []).length;
    profile.manualInvoices = (profile.manualInvoices || []).filter(inv => inv.id !== id);
    if (profile.manualInvoices.length < len) { save(data, profile); return true; }
    return false;
  },

  // ─── Yozilgan faktura IDlari ─────────────────────────────────────────────────
  getWrittenInvoiceIds: () => {
    const { profile } = current();
    return profile.writtenInvoiceIds || [];
  },

  markInvoiceAsWritten: (id) => {
    const { data, profile } = current();
    if (!profile.writtenInvoiceIds) profile.writtenInvoiceIds = [];
    if (!profile.writtenInvoiceIds.includes(id)) {
      profile.writtenInvoiceIds.push(id);
      save(data, profile);
    }
    return true;
  },

  unmarkInvoiceAsWritten: (id) => {
    const { data, profile } = current();
    const len = (profile.writtenInvoiceIds || []).length;
    profile.writtenInvoiceIds = (profile.writtenInvoiceIds || []).filter(w => w !== id);
    if (profile.writtenInvoiceIds.length < len) { save(data, profile); return true; }
    return false;
  }
};
