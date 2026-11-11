const test = require('node:test');
const assert = require('node:assert');
const XLSX = require('xlsx');
const { generateBulkEttnExcel } = require('../excel-generator');
const { autoSplit } = require('../splitter');

const alloc = (over = {}) => ({
  invoice: {
    id: 1, invoiceNumber: '15', invoiceDate: '03.11.2026', contractNumber: 'D-14', contractDate: '2026-01-15',
    buyerTin: '305123456', quantity: 25,
    items: [
      { productName: 'Sement', productMxik: '02523001001000000', unitName: 'tonna', quantity: 20, price: 55000 },
      { productName: 'Qum', productMxik: '02505001001000000', unitName: 'tonna', quantity: 5, price: 120000 },
    ],
  },
  vehicle: { plateNumber: '01 A 123 BC', driverPinfl: '31708931590013' },
  quantityAllocated: 25,
  unloadingAddressObj: { oblastCode: '1727', rayonCode: '10', addressText: 'Test 1' },
  ...over,
});
const settings = { loadingOblast: '1726', loadingRayon: '13', loadingAddress: 'Manzil' };
const read = (buf) => {
  const w = XLSX.read(buf);
  return { names: w.SheetNames, rows: XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]], { header: 1 }) };
};

test('faqat TTN varag\'i, 3-qatordan ma\'lumot', () => {
  const { names, rows } = read(generateBulkEttnExcel([alloc()], settings));
  assert.deepStrictEqual(names, ['ТТН']);
  assert.strictEqual(rows.length, 4); // sarlavha + izoh + 2 tovar
});

test('ko\'p tovarli TTN: sarlavha faqat birinchi qatorda', () => {
  const { rows } = read(generateBulkEttnExcel([alloc()], settings));
  assert.strictEqual(rows[2][1], '15-1');
  assert.ok(!rows[3][0] && !rows[3][1]);
  assert.strictEqual(rows[3][19], 'Qum');
});

test('sana ISO, brutto/netto kg', () => {
  const { rows } = read(generateBulkEttnExcel([alloc()], settings));
  assert.strictEqual(rows[2][2], '2026-11-03');
  assert.strictEqual(rows[2][24], 20000);
  assert.strictEqual(rows[3][25], 5000);
});

test('xato ma\'lumotda fayl yaratilmaydi', () => {
  const bad = alloc({ vehicle: { plateNumber: '', driverPinfl: '1' } });
  assert.throws(() => generateBulkEttnExcel([bad], settings), /xatolar bor/);
});

test('autoSplit: umumiy hajm taqsimlanadi', () => {
  const v = [1, 2, 3].map(i => ({ id: i, maxCapacity: 50, maxDailyTrips: 2, isActive: true }));
  const r = autoSplit(150, v);
  const sum = r.allocations.reduce((a, x) => a + x.quantityAllocated, 0);
  assert.strictEqual(sum, 150);
  assert.strictEqual(r.remaining, 0);
  assert.strictEqual(r.allocations.length, 3); // 3 mashina x 1 reys
});
