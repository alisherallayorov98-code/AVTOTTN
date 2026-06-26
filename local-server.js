const express = require('express');
const os = require('os');
const db = require('./db');

let serverInstance = null;
const DEFAULT_PORT = 3737;

function getLocalIps() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of (interfaces[name] || [])) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, ip: iface.address });
      }
    }
  }
  return ips;
}

function startServer(port) {
  if (serverInstance) return Promise.resolve({ ok: true, already: true, port: port || DEFAULT_PORT, ips: getLocalIps() });

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  const route = (fn) => async (req, res) => {
    try {
      const result = await fn(req);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  };

  // Ping
  app.get('/ping', route(() => ({
    ok: true,
    version: (() => { try { return require('./package.json').version; } catch (_) { return '?'; } })(),
    ips: getLocalIps()
  })));

  // Profiles
  app.get('/api/profiles',            route(() => db.getProfiles()));
  app.post('/api/profiles/create',    route(req => db.createProfile(req.body.name)));
  app.post('/api/profiles/switch',    route(req => db.switchProfile(req.body.id)));
  app.post('/api/profiles/rename',    route(req => db.renameProfile(req.body.id, req.body.name)));
  app.delete('/api/profiles/:id',     route(req => db.deleteProfile(req.params.id)));

  // Vehicles
  app.get('/api/vehicles',            route(() => db.getVehicles()));
  app.post('/api/vehicles',           route(req => db.saveVehicle(req.body)));
  app.delete('/api/vehicles/:id',     route(req => db.deleteVehicle(req.params.id)));

  // Customers
  app.get('/api/customers',           route(() => db.getCustomers()));
  app.post('/api/customers',          route(req => db.saveCustomer(req.body)));

  // Settings
  app.get('/api/settings',            route(() => db.getSettings()));
  app.post('/api/settings',           route(req => db.saveSettings(req.body)));

  // Manual invoices
  app.get('/api/manual-invoices',          route(() => db.getManualInvoices()));
  app.post('/api/manual-invoices',         route(req => db.saveManualInvoice(req.body)));
  app.delete('/api/manual-invoices/:id',   route(req => db.deleteManualInvoice(req.params.id)));

  // Written invoice IDs
  app.get('/api/written-ids',              route(() => db.getWrittenInvoiceIds()));
  app.post('/api/written-ids/mark',        route(req => db.markInvoiceAsWritten(req.body.id)));
  app.post('/api/written-ids/unmark',      route(req => db.unmarkInvoiceAsWritten(req.body.id)));

  return new Promise((resolve, reject) => {
    const srv = app.listen(port || DEFAULT_PORT, '0.0.0.0', () => {
      serverInstance = srv;
      resolve({ ok: true, port: port || DEFAULT_PORT, ips: getLocalIps() });
    });
    srv.on('error', (err) => {
      reject(new Error(`Server port ${port || DEFAULT_PORT} da ishlamadi: ${err.message}`));
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!serverInstance) { resolve({ ok: true }); return; }
    serverInstance.close(() => {
      serverInstance = null;
      resolve({ ok: true });
    });
  });
}

function isRunning() { return serverInstance !== null; }

module.exports = { startServer, stopServer, isRunning, getLocalIps, DEFAULT_PORT };
