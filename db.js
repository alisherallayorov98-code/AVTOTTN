const fs = require('fs');
const path = require('path');

// Boshlang'ich (bundle'dagi) db.json joylashuvini aniqlash.
// Bu fayl faqat "urug'" (seed) sifatida ishlatiladi — unga yozilmaydi.
function getSeedDbPath() {
  let baseDir = __dirname;
  if (__dirname.includes('app.asar')) {
    // Paketlangan holatda db.json extraResources orqali resourcesPath'ga tushadi
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

// Yoziladigan db.json yo'li — har doim userData papkasida (yozish huquqi kafolatlangan).
// Electron app modulini lazy require qilamiz, chunki bu modul main jarayonida yuklanadi.
let _dbPath = null;
function getDbPath() {
  if (_dbPath) return _dbPath;

  let userDataDir = null;
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      userDataDir = app.getPath('userData');
    }
  } catch (e) {
    // Electron mavjud bo'lmasa (masalan, test rejimi) — seed yo'liga qaytamiz
  }

  if (!userDataDir) {
    _dbPath = getSeedDbPath();
    return _dbPath;
  }

  const targetPath = path.join(userDataDir, 'db.json');

  // Birinchi ishga tushish: agar userData'da db.json bo'lmasa, bundle'dagi seed'dan ko'chiramiz
  if (!fs.existsSync(targetPath)) {
    try {
      const seedPath = getSeedDbPath();
      if (fs.existsSync(seedPath)) {
        fs.copyFileSync(seedPath, targetPath);
        console.log(`db.json seed ko'chirildi: ${targetPath}`);
      } else {
        fs.writeFileSync(targetPath, JSON.stringify({ vehicles: [], customers: [], settings: {}, manualInvoices: [], writtenInvoiceIds: [] }, null, 2), 'utf8');
      }
    } catch (err) {
      console.error('db.json seed ko\'chirishda xatolik:', err);
    }
  }

  _dbPath = targetPath;
  return _dbPath;
}

// Bir martalik ma'lumot migratsiyalari (jarayon davomida bir marta ishlaydi)
let _migrated = false;
function runMigrations(data) {
  let changed = false;
  // SOATO normalizatsiya: eski/placeholder "33" viloyat kodi -> Toshkent shahri "1726"
  (data.customers || []).forEach(c => {
    (c.addresses || []).forEach(a => {
      if (String(a.oblastCode) === '33') {
        a.oblastCode = '1726';
        changed = true;
      }
    });
  });
  return changed;
}

function getData() {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    return { vehicles: [], customers: [], settings: {} };
  }
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(raw);
    if (!_migrated) {
      _migrated = true;
      if (runMigrations(data)) {
        saveData(data);
        console.log('db.json migratsiya qilindi (SOATO kodlari normalizatsiyasi).');
      }
    }
    return data;
  } catch (err) {
    console.error('Error reading database file:', err);
    return { vehicles: [], customers: [], settings: {} };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(getDbPath(), JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing database file:', err);
    return false;
  }
}

module.exports = {
  getVehicles: () => {
    return getData().vehicles || [];
  },
  
  saveVehicle: (vehicle) => {
    const data = getData();
    if (!data.vehicles) data.vehicles = [];
    
    if (vehicle.id) {
      const idx = data.vehicles.findIndex(v => v.id === vehicle.id);
      if (idx !== -1) {
        data.vehicles[idx] = { ...data.vehicles[idx], ...vehicle };
      }
    } else {
      vehicle.id = 'v_' + Date.now();
      data.vehicles.push(vehicle);
    }
    saveData(data);
    return vehicle;
  },
  
  deleteVehicle: (id) => {
    const data = getData();
    if (!data.vehicles) return false;
    const initialLen = data.vehicles.length;
    data.vehicles = data.vehicles.filter(v => v.id !== id);
    if (data.vehicles.length < initialLen) {
      saveData(data);
      return true;
    }
    return false;
  },

  getCustomers: () => {
    return getData().customers || [];
  },

  saveCustomer: (customer) => {
    const data = getData();
    if (!data.customers) data.customers = [];
    
    const idx = data.customers.findIndex(c => c.tin === customer.tin);
    if (idx !== -1) {
      // update
      data.customers[idx] = { ...data.customers[idx], ...customer };
    } else {
      // create
      data.customers.push(customer);
    }
    saveData(data);
    return customer;
  },

  getSettings: () => {
    const settings = getData().settings || {};
    
    const dbUrl = settings.soliqApiUrl || '';
    const dbKey = settings.soliqApiKey || '';
    
    const isDemoUrl = !dbUrl || dbUrl.includes('api.soliq.uz/v1/taxpayer') || dbUrl.includes('example.com');
    const isDemoKey = !dbKey || dbKey.startsWith('demo-');
    
    return {
      ...settings,
      soliqApiUrl: isDemoUrl ? (process.env.SOLIQ_API_URL || dbUrl) : dbUrl,
      soliqApiKey: isDemoKey ? (process.env.SOLIQ_API_KEY || dbKey) : dbKey
    };
  },

  saveSettings: (settings) => {
    const data = getData();
    data.settings = { ...data.settings, ...settings };
    saveData(data);
    return data.settings;
  },

  getManualInvoices: () => {
    return getData().manualInvoices || [];
  },

  saveManualInvoice: (invoice) => {
    const data = getData();
    if (!data.manualInvoices) data.manualInvoices = [];
    
    if (!invoice.id) {
      invoice.id = 'manual_' + Date.now();
    }
    
    const idx = data.manualInvoices.findIndex(inv => inv.id === invoice.id);
    if (idx !== -1) {
      data.manualInvoices[idx] = { ...data.manualInvoices[idx], ...invoice };
    } else {
      data.manualInvoices.push(invoice);
    }
    
    saveData(data);
    return invoice;
  },

  deleteManualInvoice: (id) => {
    const data = getData();
    if (!data.manualInvoices) return false;
    const initialLen = data.manualInvoices.length;
    data.manualInvoices = data.manualInvoices.filter(inv => inv.id !== id);
    if (data.manualInvoices.length < initialLen) {
      saveData(data);
      return true;
    }
    return false;
  },

  getWrittenInvoiceIds: () => {
    return getData().writtenInvoiceIds || [];
  },

  markInvoiceAsWritten: (id) => {
    const data = getData();
    if (!data.writtenInvoiceIds) data.writtenInvoiceIds = [];
    if (!data.writtenInvoiceIds.includes(id)) {
      data.writtenInvoiceIds.push(id);
      saveData(data);
    }
    return true;
  },

  unmarkInvoiceAsWritten: (id) => {
    const data = getData();
    if (!data.writtenInvoiceIds) return false;
    const initialLen = data.writtenInvoiceIds.length;
    data.writtenInvoiceIds = data.writtenInvoiceIds.filter(writtenId => writtenId !== id);
    if (data.writtenInvoiceIds.length < initialLen) {
      saveData(data);
      return true;
    }
    return false;
  }
};
