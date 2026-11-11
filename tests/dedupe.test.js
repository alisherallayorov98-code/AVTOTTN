const test = require('node:test');
const assert = require('node:assert');
const { classifyInvoices } = require('../invoice-dedupe');
const { autoSplit, bulkAutoDispatch } = require('../splitter');

const inv = (over = {}) => ({ roamingId: 'aaa', invoiceNumber: '1', buyerTin: '305123456', invoiceDate: '2026-05-19', ...over });

test('yangi faktura', () => {
  assert.deepStrictEqual(classifyInvoices([inv()], [], []), [{ status: 'new' }]);
});
test('roaming ID bo\'yicha: TTN yozilgan / yozilmagan', () => {
  const ex = [{ id: 'e1', roamingId: 'AAA' }];
  assert.strictEqual(classifyInvoices([inv()], ex, ['e1'])[0].status, 'written');
  assert.strictEqual(classifyInvoices([inv()], ex, [])[0].status, 'pending');
});
test('roaming ID yo\'q bo\'lsa: STIR+raqam+sana', () => {
  const ex = [{ id: 'e2', buyerTin: '305123456', invoiceNumber: '1', invoiceDate: '2026-05-19' }];
  assert.strictEqual(classifyInvoices([inv({ roamingId: '' })], ex, [])[0].status, 'pending');
});
test('bir yuklashdagi takror', () => {
  const r = classifyInvoices([inv(), inv()], [], []);
  assert.deepStrictEqual(r.map(x => x.status), ['new', 'batch']);
});
test('bir xil raqam, boshqa roaming ID — boshqa faktura', () => {
  const ex = [{ id: 'e1', roamingId: 'bbb', invoiceNumber: '1', buyerTin: '305123456', invoiceDate: '2026-05-19' }];
  assert.strictEqual(classifyInvoices([inv()], ex, [])[0].status, 'pending'); // fallback kalit mos
});
test('sig\'imi yo\'q mashina NaN bermaydi', () => {
  const r = autoSplit(10, [{ id: 1, maxDailyTrips: 2 }, { id: 2, maxCapacity: '5', maxDailyTrips: 2 }]);
  assert.ok(r.allocations.every(a => a.quantityAllocated > 0));
  assert.strictEqual(r.allocations.reduce((s, a) => s + a.quantityAllocated, 0), 10);
});
test('bulk: reys limiti tugasa qoldiq qaytadi', () => {
  const r = bulkAutoDispatch([{ id: 'a', quantity: 100, buyerTin: '1' }], [{ id: 1, maxCapacity: 20, maxDailyTrips: 2 }]);
  assert.strictEqual(r.allocations.length, 2);
  assert.strictEqual(r.remainingInvoices[0].remainingQty, 60);
});

const { detectPackaging } = require('../cargo-type');

test('qadoq turini aniqlash', () => {
  assert.strictEqual(detectPackaging('Портландцемент рассыпной М400'), 'bulk');
  assert.strictEqual(detectPackaging('Цемент сочма'), 'bulk');
  assert.strictEqual(detectPackaging('Цемент в мешках 50 кг'), 'bag');
  assert.strictEqual(detectPackaging('Портландцемент ЦЕМ II'), 'unknown');
});

test('sochma sement faqat sementovozga; qopli sementovozga emas', () => {
  const fleet = [
    { id: 'T', maxCapacity: 30, maxDailyTrips: 2, cargoType: 'bulk' },
    { id: 'B', maxCapacity: 20, maxDailyTrips: 2, cargoType: 'bag' },
  ];
  const inv = { id: 'i1', buyerTin: '1', quantity: 50, items: [
    { productName: 'Цемент рассыпной', quantity: 30 },
    { productName: 'Цемент в мешках', quantity: 20 },
  ] };
  const r = bulkAutoDispatch([inv], fleet);
  const bulk = r.allocations.filter(a => a.packaging === 'bulk');
  const bag = r.allocations.filter(a => a.packaging === 'bag');
  assert.ok(bulk.length > 0 && bulk.every(a => a.vehicleId === 'T'));
  assert.ok(bag.length > 0 && bag.every(a => a.vehicleId === 'B'));
  assert.strictEqual(r.remainingInvoices.length, 0);
});

test('sementovoz yo\'q bo\'lsa sochma yuk qoldiq bo\'ladi', () => {
  const r = bulkAutoDispatch([{ id: 'i', buyerTin: '1', quantity: 30, packaging: 'bulk' }], [{ id: 'B', maxCapacity: 30, maxDailyTrips: 2, cargoType: 'bag' }]);
  assert.strictEqual(r.allocations.length, 0);
  assert.strictEqual(r.remainingInvoices[0].reason, 'no_vehicle');
});

test('Excel: sochma reys faqat sochma tovarni oladi', () => {
  const XLSX = require('xlsx');
  const { generateBulkEttnExcel } = require('../excel-generator');
  const invoice = { id: 1, invoiceNumber: '7', invoiceDate: '2026-05-01', contractNumber: 'D', contractDate: '2026-01-01', buyerTin: '305123456', quantity: 50,
    items: [
      { productName: 'Цемент рассыпной', productMxik: '02523001001000000', unitName: 'tonna', quantity: 30, price: 1000 },
      { productName: 'Цемент в мешках', productMxik: '02523001001000001', unitName: 'tonna', quantity: 20, price: 1100 },
    ] };
  const buf = generateBulkEttnExcel([{ invoice, vehicle: { plateNumber: '01 A 123 BC', driverPinfl: '31708931590013' }, quantityAllocated: 30, packaging: 'bulk', unloadingAddressObj: {} }], {});
  const w = XLSX.read(buf);
  const rows = XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]], { header: 1 }).slice(2);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0][19], 'Цемент рассыпной');
  assert.strictEqual(rows[0][22], 30);
});
