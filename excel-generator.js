const XLSX = require('xlsx');
const { effectivePackaging } = require('./cargo-type');
const path = require('path');
const fs = require('fs');

// Viloyatlar o'rtasidagi taxminiy yo'l masofalari (km)
// SOATO kodlari: 1726=Toshkent sh, 1727=Toshkent v, 1718=Samarqand, 1730=Farg'ona,
// 1703=Andijon, 1706=Buxoro, 1708=Jizzax, 1710=Qashqadaryo, 1712=Navoiy,
// 1714=Namangan, 1724=Sirdaryo, 1722=Surxondaryo, 1733=Xorazm, 1735=Qoraqalpog'iston
const OBLAST_DISTANCES = {
  '1726': { '1726': 15,   '1727': 40,   '1718': 330,  '1730': 430,  '1703': 400,  '1706': 590,  '1708': 200,  '1710': 500,  '1712': 460,  '1714': 310,  '1724': 100,  '1722': 680,  '1733': 1100, '1735': 1400 },
  '1727': { '1726': 40,   '1727': 50,   '1718': 350,  '1730': 450,  '1703': 420,  '1706': 610,  '1708': 210,  '1710': 520,  '1712': 480,  '1714': 330,  '1724': 110,  '1722': 700,  '1733': 1120, '1735': 1420 },
  '1718': { '1726': 330,  '1727': 350,  '1718': 75,   '1730': 380,  '1703': 440,  '1706': 260,  '1708': 130,  '1710': 180,  '1712': 180,  '1714': 430,  '1724': 230,  '1722': 460,  '1733': 780,  '1735': 1030 },
  '1730': { '1726': 430,  '1727': 450,  '1718': 380,  '1730': 30,   '1703': 90,   '1706': 640,  '1708': 530,  '1710': 580,  '1712': 560,  '1714': 130,  '1724': 530,  '1722': 660,  '1733': 1200, '1735': 1500 },
  '1703': { '1726': 400,  '1727': 420,  '1718': 440,  '1730': 90,   '1703': 20,   '1706': 700,  '1708': 590,  '1710': 640,  '1712': 620,  '1714': 150,  '1724': 500,  '1722': 720,  '1733': 1260, '1735': 1560 },
  '1706': { '1726': 590,  '1727': 610,  '1718': 260,  '1730': 640,  '1703': 700,  '1706': 40,   '1708': 390,  '1710': 280,  '1712': 120,  '1714': 700,  '1724': 490,  '1722': 520,  '1733': 490,  '1735': 730  },
  '1708': { '1726': 200,  '1727': 210,  '1718': 130,  '1730': 530,  '1703': 590,  '1706': 390,  '1708': 30,   '1710': 310,  '1712': 310,  '1714': 530,  '1724': 130,  '1722': 590,  '1733': 880,  '1735': 1130 },
  '1710': { '1726': 500,  '1727': 520,  '1718': 180,  '1730': 580,  '1703': 640,  '1706': 280,  '1708': 310,  '1710': 50,   '1712': 280,  '1714': 630,  '1724': 400,  '1722': 210,  '1733': 760,  '1735': 1010 },
  '1712': { '1726': 460,  '1727': 480,  '1718': 180,  '1730': 560,  '1703': 620,  '1706': 120,  '1708': 310,  '1710': 280,  '1712': 40,   '1714': 660,  '1724': 360,  '1722': 490,  '1733': 600,  '1735': 850  },
  '1714': { '1726': 310,  '1727': 330,  '1718': 430,  '1730': 130,  '1703': 150,  '1706': 700,  '1708': 530,  '1710': 630,  '1712': 660,  '1714': 20,   '1724': 410,  '1722': 730,  '1733': 1270, '1735': 1570 },
  '1724': { '1726': 100,  '1727': 110,  '1718': 230,  '1730': 530,  '1703': 500,  '1706': 490,  '1708': 130,  '1710': 400,  '1712': 360,  '1714': 410,  '1724': 40,   '1722': 580,  '1733': 980,  '1735': 1280 },
  '1722': { '1726': 680,  '1727': 700,  '1718': 460,  '1730': 660,  '1703': 720,  '1706': 520,  '1708': 590,  '1710': 210,  '1712': 490,  '1714': 730,  '1724': 580,  '1722': 50,   '1733': 1010, '1735': 1260 },
  '1733': { '1726': 1100, '1727': 1120, '1718': 780,  '1730': 1200, '1703': 1260, '1706': 490,  '1708': 880,  '1710': 760,  '1712': 600,  '1714': 1270, '1724': 980,  '1722': 1010, '1733': 30,   '1735': 200  },
  '1735': { '1726': 1400, '1727': 1420, '1718': 1030, '1730': 1500, '1703': 1560, '1706': 730,  '1708': 1130, '1710': 1010, '1712': 850,  '1714': 1570, '1724': 1280, '1722': 1260, '1733': 200,  '1735': 80   },
};

function getOblastDistance(loadingOblastCode, unloadingOblastCode) {
  const from = String(loadingOblastCode || '1726');
  const to = String(unloadingOblastCode || '1726');
  if (OBLAST_DISTANCES[from] && OBLAST_DISTANCES[from][to] !== undefined) {
    return OBLAST_DISTANCES[from][to];
  }
  if (OBLAST_DISTANCES[to] && OBLAST_DISTANCES[to][from] !== undefined) {
    return OBLAST_DISTANCES[to][from];
  }
  return from === to ? 50 : 200;
}

/**
 * Sana formatini DD.MM.YYYY ko'rinishiga o'tkazish
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Bitta faktura uchun Didox Excel shablonini to'ldirish
 */
function generateEttnExcel(invoice, allocations, unloadingAddressObj, settings) {
  // Bitta faktura taqsimotini massiv formatga o'tkazib bulk funksiyasidan foydalanamiz
  const bulkAllocations = allocations.map(a => ({
    invoice: invoice,
    vehicle: a.vehicle,
    quantityAllocated: a.quantityAllocated,
    packaging: a.packaging,
    unloadingAddressObj: unloadingAddressObj
  }));
  
  return generateBulkEttnExcel(bulkAllocations, settings);
}

// SOATO kod -> nom (ELEX shabloni viloyat/tuman uchun nom yoki kod qabul qiladi)
let _soato = null;
function loadSoato() {
  if (_soato) return _soato;
  const candidates = [
    path.join(__dirname, 'public', 'soato.json'),
    path.join(__dirname, 'frontend', 'src', 'data', 'soato.json'),
    path.join(__dirname, '..', 'public', 'soato.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) { _soato = JSON.parse(fs.readFileSync(p, 'utf8')); return _soato; }
    } catch (e) { /* keyingisini sinaymiz */ }
  }
  _soato = [];
  return _soato;
}

// Kod topilsa nom qaytaradi, topilmasa kodning o'zini
function regionName(oblastCode) {
  const o = loadSoato().find(r => String(r.code) === String(oblastCode));
  return o ? o.name : (oblastCode ? String(oblastCode) : '');
}
function districtName(oblastCode, rayonCode) {
  const o = loadSoato().find(r => String(r.code) === String(oblastCode));
  const d = o && (o.districts || []).find(x => String(x.code) === String(rayonCode));
  return d ? d.name : (rayonCode ? String(rayonCode) : '');
}

// Davlat raqamini ELEX formatiga keltirish: 01A123BC -> "01 A 123 BC", 30156UBA -> "30 156 UBA"
function normalizePlate(raw) {
  const p = String(raw || '').replace(/\s+/g, '').toUpperCase();
  let m = p.match(/^(\d{2})([A-Z])(\d{3})([A-Z]{2})$/);
  if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  m = p.match(/^(\d{2})(\d{3})([A-Z]{3})$/);
  if (m) return `${m[1]} ${m[2]} ${m[3]}`;
  return String(raw || '').trim();
}

// ELEX sanasi: YYYY-MM-DD
function formatIsoDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ELEX ustunlari sarlavha matni bo'yicha topiladi (ustun tartibi o'zgarsa ham ishlaydi)
const FIELD_HEADERS = {
  seq: 'т/р №', number: 'ттн рақами', date: 'ттн санаси', type: 'ташув тури',
  contractNo: 'шартнома №', contractDate: 'шартнома санаси', receiver: 'юк қабул қилувчи',
  driver: 'ҳайдовчи жшшири', plate: 'машина давлат', trailer: 'тиркама', responsible: 'масъул шахс',
  loadRegion: 'юклаш вилояти', loadDistrict: 'юклаш тумани', loadAddr: 'юклаш манзили',
  unloadRegion: 'тушириш вилояти', unloadDistrict: 'тушириш тумани', unloadAddr: 'тушириш манзили',
  distance: 'масофа', pricePerKm: '1 км нархи', product: 'товар номи', ikpu: 'икпу',
  pack: 'код упаковки', qty: 'миқдор', price: 'нарх', gross: 'брутто', net: 'нетто',
};
const REQUIRED_FIELDS = ['seq', 'number', 'date', 'receiver', 'driver', 'plate', 'product', 'ikpu', 'qty', 'price'];

function mapColumns(headerRow) {
  const norm = (h) => String(h || '').toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const heads = headerRow.map(norm);
  const map = {};
  for (const [key, text] of Object.entries(FIELD_HEADERS)) {
    const idx = heads.findIndex(h => h.startsWith(text));
    if (idx >= 0) map[key] = idx;
  }
  const missing = REQUIRED_FIELDS.filter(k => map[k] === undefined);
  if (missing.length) {
    throw new Error("Shablonda ustun topilmadi: " + missing.map(k => FIELD_HEADERS[k]).join(', ') + ". Shablon o'zgargan bo'lishi mumkin.");
  }
  return map;
}

// Excel yaratishdan oldin majburiy maydonlarni tekshirish
function validateAllocations(bulkAllocations) {
  const errors = [];
  const digits = (v) => String(v || '').replace(/\D/g, '');
  bulkAllocations.forEach((a) => {
    const inv = a.invoice || {};
    const v = a.vehicle || {};
    const tag = `Faktura ${inv.invoiceNumber || '?'}`;
    if (![9, 14].includes(digits(inv.buyerTin).length)) errors.push(`${tag}: xaridor STIR/JShShIR noto'g'ri (9 yoki 14 raqam)`);
    if (digits(v.driverPinfl).length !== 14) errors.push(`${tag}: haydovchi JShShIR 14 raqam bo'lishi kerak (${v.plateNumber || 'mashina?'})`);
    if (!String(v.plateNumber || '').trim()) errors.push(`${tag}: mashina davlat raqami yo'q`);
    if (!inv.contractNumber || !inv.contractDate) errors.push(`${tag}: shartnoma raqami yoki sanasi yo'q`);
    if (!(parseFloat(a.quantityAllocated) > 0)) errors.push(`${tag}: yuk miqdori noldan katta bo'lishi kerak`);
    (inv.items || []).forEach((it) => {
      if (digits(it.productMxik).length !== 17) errors.push(`${tag}: "${it.productName}" IKPU 17 raqam bo'lishi kerak`);
    });
  });
  return [...new Set(errors)];
}

/**
 * Ko'plab fakturalar va mashina taqsimotlarini ELEX import shablonining "ТТН" varag'iga yozish.
 * Shablon: ELEX-import-template.oz.xlsx — 1-qator sarlavha, 2-qator izoh, 3-qatordan ma'lumot.
 * Faqat "ТТН" varag'i qoldiriladi (boshqa varaqlardagi namuna qatorlar hujjat bo'lib import qilinmasligi uchun).
 */
function generateBulkEttnExcel(bulkAllocations, settings) {
  let baseDir = __dirname;
  if (__dirname.includes('app.asar')) {
    baseDir = path.join(__dirname, '..', '..');
  }
  const templatePath = path.join(baseDir, 'ELEX-import-template.oz.xlsx');
  if (!fs.existsSync(templatePath)) {
    throw new Error('ELEX-import-template.oz.xlsx shablon fayli topilmadi: ' + templatePath);
  }

  const errors = validateAllocations(bulkAllocations);
  if (errors.length) throw new Error("Ma'lumotlarda xatolar bor:\n- " + errors.join('\n- '));

  const srcWb = XLSX.readFile(templatePath);
  const sheetName = srcWb.SheetNames.find(n => n.toUpperCase().includes('ТТН') || n.toUpperCase().includes('TTN'));
  if (!sheetName) throw new Error('Shablonda "ТТН" varag\'i topilmadi.');
  const rows = XLSX.utils.sheet_to_json(srcWb.Sheets[sheetName], { header: 1, defval: '' });
  const headerRows = rows.slice(0, 2); // sarlavha + izoh
  const colMap = mapColumns(headerRows[0] || []);
  const COLS = Math.max(...Object.values(colMap)) + 1;
  const outRows = [...headerRows];

  const loadingAddress = settings.loadingAddress || '';
  const deliveryCostPerKm = parseFloat(settings.deliveryCostPerKm) || 1;

  // Matn sifatida saqlanadigan raqamlar (STIR/JShShIR) — scientific notation bo'lmasligi uchun
  const txt = (val) => {
    const str = String(val || '').replace(/\D/g, '');
    return !str || str === '0' ? '' : { t: 's', v: str };
  };
  const isTonna = (item) => {
    const n = String(item.unitName || 'tonna').trim().toLowerCase();
    return n === 'tonna' || n === 'т' || n === 'тонна' || n === 't';
  };

  const invoiceAllocIndex = {};
  let ttnSeq = 0;

  bulkAllocations.forEach((alloc) => {
    const inv = alloc.invoice;
    const v = alloc.vehicle;
    const qty = alloc.quantityAllocated;
    const unloadingAddr = alloc.unloadingAddressObj || {};

    const invKey = String(inv.id || inv.invoiceNumber);
    invoiceAllocIndex[invKey] = (invoiceAllocIndex[invKey] || 0) + 1;
    ttnSeq++;
    const ttnNumber = `${inv.invoiceNumber}-${invoiceAllocIndex[invKey]}`;

    const allItems = inv.items && inv.items.length > 0 ? inv.items : [{
      productName: inv.productName || 'Sement',
      productMxik: inv.productMxik || '02523002001236004',
      unitName: inv.unitName || 'tonna',
      quantity: inv.quantity || qty,
      price: inv.price || 0,
    }];
    // Reys qopli yoki sochma bo'lsa — faqat shu turdagi tovarlar TTNga kiradi
    const wanted = alloc.packaging;
    const filtered = (wanted === 'bag' || wanted === 'bulk')
      ? allItems.filter(it => effectivePackaging(inv, it) === wanted)
      : allItems;
    const items = filtered.length > 0 ? filtered : allItems;
    const groupQty = items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0), 0);

    const loadOblast = settings.loadingOblast || '1726';
    const unloadOblast = unloadingAddr.oblastCode || '1726';
    const distance = getOblastDistance(loadOblast, unloadOblast);
    const isThirdParty = (v.vehicleOwnerType || 'own') === 'third_party';

    items.forEach((item, itemIdx) => {
      const ratio = groupQty > 0 ? (item.quantity / groupQty) : (1 / items.length);
      const itemQty = parseFloat((qty * ratio).toFixed(3));
      const weightKg = isTonna(item) ? parseFloat((itemQty * 1000).toFixed(2)) : itemQty;

      const row = new Array(COLS).fill('');
      const set = (k, val) => { if (colMap[k] !== undefined) row[colMap[k]] = val; };
      if (itemIdx === 0) {
        // Sarlavha maydonlari faqat hujjatning birinchi qatorida
        set('seq', ttnSeq);                                   // A Т/р №
        set('number', ttnNumber);                                // B TTN raqami
        set('date', formatIsoDate(inv.invoiceDate));           // C TTN sanasi
        set('type', 2);                                        // D Ташув тури (sotuvchidan xaridorga)
        set('contractNo', inv.contractNumber || '');                 // E Shartnoma №
        set('contractDate', formatIsoDate(inv.contractDate));          // F Shartnoma sanasi
        set('receiver', txt(inv.buyerTin));                        // G Qabul qiluvchi STIR
        set('driver', txt(v.driverPinfl));                       // H Haydovchi JShShIR
        set('plate', normalizePlate(v.plateNumber));                      // I Mashina raqami
        set('trailer', normalizePlate(v.trailerPlate));                     // J Tirkama raqami
        set('responsible', '');                                      // K Mas'ul shaxs (bo'sh = haydovchi)
        set('loadRegion', regionName(loadOblast));                  // L Yuklash viloyati
        set('loadDistrict', districtName(loadOblast, settings.loadingRayon)); // M Yuklash tumani
        set('loadAddr', loadingAddress);                          // N Yuklash manzili
        set('unloadRegion', regionName(unloadOblast));                // O Tushirish viloyati
        set('unloadDistrict', districtName(unloadOblast, unloadingAddr.rayonCode)); // P Tushirish tumani
        set('unloadAddr', unloadingAddr.addressText || '');         // Q Tushirish manzili
        set('distance', distance);                                // R Masofa, km
        set('pricePerKm', isThirdParty ? deliveryCostPerKm : 0);    // S 1 km narxi
      }
      set('product', item.productName || 'Sement');              // T Tovar nomi
      set('ikpu', item.productMxik || '02523002001236004');   // U IKPU
      set('pack', '');                                        // V Qadoq kodi (bo'sh = katalogdan)
      set('qty', itemQty);                                   // W Miqdor
      set('price', item.price || 0);                           // X Narx (birlik uchun)
      set('gross', weightKg);                                  // Y Brutto, kg
      set('net', weightKg);                                  // Z Netto, kg
      outRows.push(row);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(outRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  normalizePlate,
  generateEttnExcel,
  generateBulkEttnExcel
};
