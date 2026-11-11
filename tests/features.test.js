const test = require('node:test');
const assert = require('node:assert');
const { bulkAutoDispatch, isAvailable } = require('../splitter');
const { buildReport } = require('../ttn-report');

const fleet = [{ id: 'A', plateNumber: '01A', maxCapacity: 10, maxDailyTrips: 2 }];
const inv = [{ id: 'i1', buyerTin: '1', quantity: 30 }];

test('bugungi reyslar limitga qo\'shiladi', () => {
  const r = bulkAutoDispatch(inv, fleet, { A: 1 }, '2026-11-11');
  assert.strictEqual(r.allocations.length, 1); // 2 limitdan 1 ta qoldi
  assert.strictEqual(r.remainingInvoices[0].remainingQty, 20);
});

test('ta\'mirdagi mashina taqsimlanmaydi', () => {
  assert.strictEqual(isAvailable({ pausedUntil: '2026-11-15' }, '2026-11-11'), false);
  assert.strictEqual(isAvailable({ pausedUntil: '2026-11-10' }, '2026-11-11'), true);
  const paused = [{ ...fleet[0], pausedUntil: '2099-01-01' }];
  const r = bulkAutoDispatch(inv, paused, {}, '2026-11-11');
  assert.strictEqual(r.allocations.length, 0);
});

test('jurnal hisoboti: tur, mashina, mijoz, sana oralig\'i', () => {
  const log = [
    { date: '2026-11-10', plateNumber: '01A', buyerTin: '1', buyerName: 'X', packaging: 'bulk', quantity: 30 },
    { date: '2026-11-11', plateNumber: '01A', buyerTin: '2', buyerName: 'Y', packaging: 'bag', quantity: 20 },
    { date: '2026-11-11', plateNumber: '02B', buyerTin: '2', buyerName: 'Y', packaging: 'bag', quantity: 10 },
  ];
  const all = buildReport(log, '', '');
  assert.strictEqual(all.totalTons, 60);
  assert.strictEqual(all.byType.bulk.tons, 30);
  const day = buildReport(log, '2026-11-11', '2026-11-11');
  assert.strictEqual(day.totalTrips, 2);
  assert.strictEqual(day.byBuyer.length, 1);
  assert.strictEqual(day.byBuyer[0].tons, 30);
});
