/**
 * Yangi yuklangan fakturalarni mavjudlari bilan solishtirish.
 * Asosiy kalit — Roaming ID (PDFdagi "Ҳужжат IDси (Rouming.uz)").
 * Roaming ID bo'lmasa: xaridor STIR + faktura raqami + sana.
 *
 * Holatlar:
 *  new     — yangi faktura
 *  pending — avval yuklangan, lekin TTN hali yozilmagan
 *  written — avval yuklangan va TTN yozilgan
 *  batch   — shu yuklashning o'zida takrorlangan
 */
function fallbackKey(inv) {
  if (!inv.invoiceNumber) return '';
  return `n:${inv.buyerTin || ''}|${inv.invoiceNumber}|${inv.invoiceDate || ''}`;
}

function classifyInvoices(parsedList, existingInvoices, writtenIds) {
  const written = new Set(writtenIds || []);
  const byRoaming = new Map();
  const byFallback = new Map();
  for (const e of existingInvoices || []) {
    if (e.roamingId) byRoaming.set(String(e.roamingId).toLowerCase(), e);
    const fk = fallbackKey(e);
    if (fk) byFallback.set(fk, e);
  }
  const seen = new Set();
  return parsedList.map((p) => {
    const rid = p.roamingId ? String(p.roamingId).toLowerCase() : '';
    const fk = fallbackKey(p);
    const batchKey = rid ? 'r:' + rid : fk;
    if (batchKey && seen.has(batchKey)) return { status: 'batch' };
    if (batchKey) seen.add(batchKey);
    const existing = (rid && byRoaming.get(rid)) || (fk && byFallback.get(fk)) || null;
    if (!existing) return { status: 'new' };
    return { status: written.has(existing.id) ? 'written' : 'pending', existingId: existing.id };
  });
}

module.exports = { classifyInvoices, fallbackKey };
