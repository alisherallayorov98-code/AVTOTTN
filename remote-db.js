const axios = require('axios');
const netConfig = require('./network-config');

function createRemoteDb(serverIp, port, keyOverride) {
  const base = `http://${serverIp}:${port || 3737}`;
  const ax = axios.create({ baseURL: base, timeout: 8000 });
  // Har so'rovga kalit, tanlangan kompaniya va foydalanuvchi nomi qo'shiladi
  ax.interceptors.request.use((req) => {
    const cfg = netConfig.get();
    req.headers['x-access-key'] = keyOverride !== undefined ? keyOverride : (cfg.accessKey || '');
    if (cfg.clientProfile) req.headers['x-profile'] = cfg.clientProfile;
    if (cfg.userName) req.headers['x-user'] = encodeURIComponent(cfg.userName);
    return req;
  });
  ax.interceptors.response.use(r => r, (err) => {
    if (err.response && err.response.status === 401) return Promise.reject(new Error("Kirish kaliti noto'g'ri"));
    if (err.response && err.response.data && err.response.data.error) return Promise.reject(new Error(err.response.data.error));
    return Promise.reject(err);
  });

  return {
    getProfiles:            () => ax.get('/api/profiles').then(r => r.data),
    createProfile:          (name) => ax.post('/api/profiles/create', { name }).then(r => {
      netConfig.save({ ...netConfig.get(), clientProfile: r.data.id }); // faqat shu kompyuter uchun
      return r.data;
    }),
    // Kompaniyani almashtirish serverdagi boshqa foydalanuvchilarga ta'sir qilmaydi
    switchProfile:          (id) => { netConfig.save({ ...netConfig.get(), clientProfile: id }); return Promise.resolve(true); },
    getRev:                 () => ax.get('/api/rev').then(r => r.data.rev),
    authCheck:              () => ax.get('/api/auth-check').then(r => r.data),
    renameProfile:          (id, name) => ax.post('/api/profiles/rename', { id, name }).then(r => r.data),
    deleteProfile:          (id) => ax.delete(`/api/profiles/${encodeURIComponent(id)}`).then(r => r.data),

    getVehicles:            () => ax.get('/api/vehicles').then(r => r.data),
    saveVehicle:            (v) => ax.post('/api/vehicles', v).then(r => r.data),
    deleteVehicle:          (id) => ax.delete(`/api/vehicles/${encodeURIComponent(id)}`).then(r => r.data),

    getCustomers:           () => ax.get('/api/customers').then(r => r.data),
    saveCustomer:           (c) => ax.post('/api/customers', c).then(r => r.data),

    getSettings:            () => ax.get('/api/settings').then(r => r.data),
    saveSettings:           (s) => ax.post('/api/settings', s).then(r => r.data),

    getManualInvoices:      () => ax.get('/api/manual-invoices').then(r => r.data),
    saveManualInvoice:      (inv) => ax.post('/api/manual-invoices', inv).then(r => r.data),
    deleteManualInvoice:    (id) => ax.delete(`/api/manual-invoices/${encodeURIComponent(id)}`).then(r => r.data),

    getWrittenInvoiceIds:   () => ax.get('/api/written-ids').then(r => r.data),
    markInvoiceAsWritten:   (id) => ax.post('/api/written-ids/mark', { id }).then(r => r.data),
    unmarkInvoiceAsWritten: (id) => ax.post('/api/written-ids/unmark', { id }).then(r => r.data),

    addTtnLog:              (e) => ax.post('/api/ttn-log', { entries: e }).then(r => r.data),
    getTtnLog:              () => ax.get('/api/ttn-log').then(r => r.data),

    ping:                   () => ax.get('/ping', { timeout: 3000 }).then(r => r.data),
  };
}

module.exports = { createRemoteDb };
