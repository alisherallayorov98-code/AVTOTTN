const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Haqiqiy sozlamalarga tegmaslik uchun vaqtinchalik fayl
const cfgPath = path.join(os.tmpdir(), `avto-netcfg-${process.pid}.json`);
process.env.AVTO_NETCFG_PATH = cfgPath;

const axios = require('axios');
const server = require('../local-server');
const netConfig = require('../network-config');
const { localDate } = require('../local-date');
const PORT = 3791;
const base = `http://127.0.0.1:${PORT}`;
const status = (url, headers = {}) => axios.get(base + url, { headers, validateStatus: () => true });

test.before(async () => { await server.startServer(PORT); });
test.after(async () => { await server.stopServer(); try { fs.unlinkSync(cfgPath); } catch {} });

test('server kalit avtomatik yaratadi (12 belgi)', () => {
  assert.strictEqual(netConfig.get().accessKey.length, 12);
});

test('kalitsiz va noto\'g\'ri kalit rad etiladi, to\'g\'ri kalit qabul qilinadi', async () => {
  const key = netConfig.get().accessKey;
  assert.strictEqual((await status('/api/auth-check')).status, 401);
  assert.strictEqual((await status('/api/auth-check', { 'x-access-key': 'x'.repeat(12) })).status, 401);
  assert.strictEqual((await status('/api/auth-check', { 'x-access-key': key })).status, 200);
});

test('CORS ochiq emas, /ping IP oshkor qilmaydi', async () => {
  const r = await status('/ping');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers['access-control-allow-origin'], undefined);
  assert.strictEqual(r.data.ips, undefined);
});

test('kalit o\'zgarsa qayta ishga tushirmasdan kuchga kiradi', async () => {
  const oldKey = netConfig.get().accessKey;
  netConfig.save({ ...netConfig.get(), accessKey: 'abcdef123456' });
  assert.strictEqual((await status('/api/auth-check', { 'x-access-key': oldKey })).status, 401);
  assert.strictEqual((await status('/api/auth-check', { 'x-access-key': 'abcdef123456' })).status, 200);
});

test('mahalliy sana (UTC emas)', () => {
  assert.strictEqual(localDate(new Date(2026, 10, 11, 1, 30)), '2026-11-11'); // mahalliy 01:30
  assert.match(localDate(), /^\d{4}-\d{2}-\d{2}$/);
});
