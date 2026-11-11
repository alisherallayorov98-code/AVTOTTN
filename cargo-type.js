/**
 * Yuk turi: qopli (bag) yoki sochma/rassipnoy (bulk) sement.
 * Sochma sement faqat sementovozda (cargoType = 'bulk') tashiladi.
 */
const BULK_RE = /рассып|сочма|навал|наливн|балк|цементовоз|цемент?овоз|sement?ovoz|rassip|sochma|navalom|bulk/i;
const BAG_RE = /мешк|мешок|қоп|коп[ли]|тарал|qop|bag|упаков/i;

// Tovar nomidan qadoq turini aniqlash: 'bulk' | 'bag' | 'unknown'
function detectPackaging(name) {
  const s = String(name || '');
  if (BULK_RE.test(s)) return 'bulk';
  if (BAG_RE.test(s)) return 'bag';
  return 'unknown';
}

// Tovarning amaldagi turi: qo'lda belgilangan (faktura) > avtomatik aniqlangan > 'any'
function effectivePackaging(invoice, item) {
  const manual = invoice && invoice.packaging;
  if (manual === 'bag' || manual === 'bulk') return manual;
  const p = (item && item.packaging) || detectPackaging(item && item.productName);
  return p === 'bag' || p === 'bulk' ? p : 'any';
}

// Mashina shu yukni tashiy oladimi
function vehicleFits(vehicle, packaging) {
  const t = vehicle.cargoType || 'any';
  if (packaging === 'bulk') return t === 'bulk';
  if (packaging === 'bag') return t !== 'bulk';
  return true;
}

// Faktura tovarlarini tur bo'yicha guruhlaydi: [{ packaging, quantity }]
function packagingGroups(invoice) {
  const items = invoice.items && invoice.items.length ? invoice.items : [{ productName: invoice.productName, quantity: invoice.quantity }];
  const map = new Map();
  for (const it of items) {
    const p = effectivePackaging(invoice, it);
    map.set(p, (map.get(p) || 0) + (parseFloat(it.quantity) || 0));
  }
  if (!invoice.items || !invoice.items.length) map.set([...map.keys()][0], parseFloat(invoice.quantity) || 0);
  return [...map.entries()].map(([packaging, quantity]) => ({ packaging, quantity: parseFloat(quantity.toFixed(3)) }));
}

module.exports = { detectPackaging, effectivePackaging, vehicleFits, packagingGroups };
