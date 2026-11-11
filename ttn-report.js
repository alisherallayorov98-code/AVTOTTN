/**
 * TTN jurnalidan hisobot: qopli/sochma, mashina, mijoz bo'yicha.
 * Jurnal yozuvi: { date, invoiceId, invoiceNumber, buyerTin, buyerName, packaging, vehicleId, plateNumber, quantity }
 */
const round3 = (n) => parseFloat(n.toFixed(3));

function buildReport(log, from, to) {
  const rows = (log || []).filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
  const byType = {};
  const byVehicle = {};
  const byBuyer = {};
  let totalTons = 0;

  for (const r of rows) {
    const q = parseFloat(r.quantity) || 0;
    totalTons += q;

    const t = r.packaging || 'any';
    byType[t] = byType[t] || { trips: 0, tons: 0 };
    byType[t].trips++;
    byType[t].tons = round3(byType[t].tons + q);

    const vk = r.plateNumber || r.vehicleId || '—';
    byVehicle[vk] = byVehicle[vk] || { plateNumber: vk, packaging: t, trips: 0, tons: 0 };
    byVehicle[vk].trips++;
    byVehicle[vk].tons = round3(byVehicle[vk].tons + q);

    const bk = r.buyerTin || r.buyerName || '—';
    byBuyer[bk] = byBuyer[bk] || { buyerTin: r.buyerTin || '', buyerName: r.buyerName || '', trips: 0, tons: 0 };
    byBuyer[bk].trips++;
    byBuyer[bk].tons = round3(byBuyer[bk].tons + q);
  }

  const desc = (a, b) => b.tons - a.tons;
  return {
    totalTrips: rows.length,
    totalTons: round3(totalTons),
    byType,
    byVehicle: Object.values(byVehicle).sort(desc),
    byBuyer: Object.values(byBuyer).sort(desc),
    rows,
  };
}

const TYPE_LABEL = { bag: 'Qopli', bulk: 'Sochma (sementovoz)', any: 'Turi belgilanmagan' };

// Hisobotni Excel buferiga aylantirish (4 ta varaq)
function reportToXlsx(report, from, to) {
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();
  const add = (name, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);

  add('Xulosa', [
    ['Davr', `${from || '...'} — ${to || '...'}`],
    ['Jami reys', report.totalTrips],
    ['Jami tonna', report.totalTons],
    [],
    ['Yuk turi', 'Reys', 'Tonna'],
    ...Object.entries(report.byType).map(([t, v]) => [TYPE_LABEL[t] || t, v.trips, v.tons]),
  ]);
  add('Mashinalar', [['Davlat raqami', 'Reys', 'Tonna'], ...report.byVehicle.map((v) => [v.plateNumber, v.trips, v.tons])]);
  add('Mijozlar', [['STIR', 'Mijoz', 'Reys', 'Tonna'], ...report.byBuyer.map((b) => [b.buyerTin, b.buyerName, b.trips, b.tons])]);
  add('Reyslar', [
    ['Sana', 'Faktura', 'Mijoz', 'STIR', 'Mashina', 'Yuk turi', 'Tonna'],
    ...report.rows.map((r) => [r.date, r.invoiceNumber, r.buyerName, r.buyerTin, r.plateNumber, TYPE_LABEL[r.packaging] || r.packaging, r.quantity]),
  ]);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildReport, reportToXlsx };
