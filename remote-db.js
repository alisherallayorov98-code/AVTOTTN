const axios = require('axios');

function createRemoteDb(serverIp, port) {
  const base = `http://${serverIp}:${port || 3737}`;
  const ax = axios.create({ baseURL: base, timeout: 8000 });

  return {
    getProfiles:            () => ax.get('/api/profiles').then(r => r.data),
    createProfile:          (name) => ax.post('/api/profiles/create', { name }).then(r => r.data),
    switchProfile:          (id) => ax.post('/api/profiles/switch', { id }).then(r => r.data),
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

    ping:                   () => ax.get('/ping', { timeout: 3000 }).then(r => r.data),
  };
}

module.exports = { createRemoteDb };
