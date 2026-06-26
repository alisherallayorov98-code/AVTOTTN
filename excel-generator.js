const XLSX = require('xlsx');
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
    unloadingAddressObj: unloadingAddressObj
  }));
  
  return generateBulkEttnExcel(bulkAllocations, settings);
}

/**
 * Ko'plab fakturalar va mashina taqsimotlarini bitta umumiy Didox Excel shabloniga to'ldirish
 * 
 * @param {Array} bulkAllocations - Taqsimotlar ro'yxati [{ invoice, vehicle, quantityAllocated, unloadingAddressObj }]
 * @param {Object} settings - Tizim sozlamalari
 * @returns {Buffer} Excel fayli buferi
 */
function generateBulkEttnExcel(bulkAllocations, settings) {
  let baseDir = __dirname;
  if (__dirname.includes('app.asar')) {
    baseDir = path.join(__dirname, '..', '..');
  }
  const templatePath = path.join(baseDir, 'didox_shablon.xlsx');
  
  let workbook;
  let templateHeaderRows = [];

  // 1. Shablon faylini o'qib, boshlang'ich 4 ta qatorni olish
  if (fs.existsSync(templatePath)) {
    try {
      console.log('Loading Excel template from didox_shablon.xlsx...');
      workbook = XLSX.readFile(templatePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      templateHeaderRows = rows.slice(0, 4);
    } catch (err) {
      console.error('Error reading template workbook. Falling back to default generation:', err);
    }
  }

  const newDataRows = [...templateHeaderRows];

  // Agar shablon bo'sh bo'lsa yoki o'qishda xato bo'lsa, boshlang'ich sarlavha qatorlarini o'zimiz yasaymiz
  if (newDataRows.length < 3) {
    console.warn('Creating fallback basic header rows');
    newDataRows[0] = ['п.п ТТН *', 'Тип перевозки *', 'Данные по ТТН'];
    newDataRows[1] = [];
    newDataRows[2] = [
      'п.п ТТН *', 'Тип перевозки *', 'Номер ТТН *', 'Дата ТТН *', 'Номер контракта *', 'Дата контракта  *',
      'ИНН/ПИНФЛ  Грузоотправителя *', 'Код филиала', 'ИНН/ПИНФЛ Грузополучателя *', 'Код филиала',
      'ИНН/ПИНФЛ Экспедитора *', 'Код филиала', 'ИНН/ПИНФЛ Грузоперевозчика *', 'Код филиала',
      'ИНН/ПИНФЛ/ПИНФЛ/ПИНФЛ Клиента *', 'Код филиала', 'Номер контракта', 'Дата контракта',
      'ИНН/ПИНФЛ Заказчика *', 'Код филиала', 'Номер контракта', 'Дата контракта',
      'Тип транспорта *', 'Гос. номер авто. *', 'Модель авто. *', 'Транспорт принадлежит, ИНН/ПИНФЛ',
      'Гос. Номер полуприцепа', 'Модель полуприцепа', 'Гос. Номер прицепа', 'Модель прицепа',
      'Водитель, ПИНФЛ *', 'Ответственное лицо, доставляющий груз, ПИНФЛ *', 'п.п Груза *',
      'Область *', 'Район *', 'Улица, Дом *', 'Широта', 'Долгота',
      'Ответственное лицо грузоотправителя, ПИНФЛ', 'Область *', 'Район *', 'Улица, Дом *',
      'Широта', 'Долгота', 'Ответственное лицо грузополучателя, ПИНФЛ',
      'Номер доверенности', 'От', 'До', 'ID доверенности', 'п.п Товаров *', 'ИНН/ПИНФЛ комитента',
      'ИКПУ и наименование товаров (работ, услуг) *', 'Описание товаров (работ, услуг) *',
      'Ед. изм *', 'Кол-vo *', 'Цена *', 'Сумма (без НДС) *', 'Брутto *', 'Нетто *',
      'Общее расстояние *', 'Стоимость доставки за 1 км *', 'Стоимость доставки (в сумах) *'
    ];
    newDataRows[3] = [];
  }

  const senderTin = settings.senderTin || "305539899";
  const senderName = settings.senderName || "SEMENT INSHAOT SAVDO MChJ";
  const loadingAddress = settings.loadingAddress || "массив Янги Хаёт";

  // ETTN qo'shimcha qiymatlari (Sozlamalardan, standart qiymat bilan)
  const deliveryCostPerKm = parseFloat(settings.deliveryCostPerKm) || 1;     // Uchinchi tomon: 1 km narxi (so'm)
  const expeditorTin = settings.expeditorTin || senderTin;                   // Ekspeditor STIR (bo'sh -> jo'natuvchi)
  const unitCodes = settings.unitCodes || { tonna: 1629438 };                // Birlik nomi -> Didox kodi
  const DEFAULT_UNIT_CODE = 1629438; // tonna

  // PINFL (14 xonali) ni Excel da tekst formatda saqlash
  const pinflCell = (val) => {
    const str = String(val || '').trim();
    if (!str || str === '0') return '';
    return { t: 's', v: str };
  };

  // STIR (9 raqam) → raqam; PINFL (14 raqam) → tekst (scientific notation oldini olish)
  const tinCell = (val) => {
    const str = String(val || '').trim().replace(/\D/g, '');
    if (!str || str === '0') return '';
    if (str.length > 9) return { t: 's', v: str }; // PINFL — tekst
    return Number(str) || '';                        // STIR — raqam
  };

  // Tovar birligi nomidan Didox birlik kodini aniqlash
  const resolveUnitCode = (item) => {
    if (item.unitCode) return Number(item.unitCode);
    const name = String(item.unitName || '').trim().toLowerCase();
    if (name && unitCodes[name]) return Number(unitCodes[name]);
    return DEFAULT_UNIT_CODE;
  };

  // Har faktura uchun alohida tartib raqami, va fayldagi umumiy TTN hisoblagichi
  const invoiceAllocIndex = {};
  let globalTtnSeq = 0; // п.п ТТН — butun fayl bo'yicha ketma-ket integer

  // 3. Taqsimlangan yuklar asosida qatorlarni to'ldirish (Row 5 dan boshlab)
  bulkAllocations.forEach((alloc) => {
    const inv = alloc.invoice;
    const v = alloc.vehicle;
    const qty = alloc.quantityAllocated;
    const unloadingAddr = alloc.unloadingAddressObj || {};

    // Har faktura uchun: INV001-1, INV001-2, INV002-1, INV002-2 ...
    const invKey = String(inv.id || inv.invoiceNumber);
    if (!invoiceAllocIndex[invKey]) invoiceAllocIndex[invKey] = 0;
    invoiceAllocIndex[invKey]++;
    globalTtnSeq++;
    const ttnNumber = `${inv.invoiceNumber}-${invoiceAllocIndex[invKey]}`;
    
    // Faktura ichidagi tovarlarni olamiz (agar items massivi bo'lsa, aks holda fallback)
    const items = inv.items && inv.items.length > 0 ? inv.items : [{
      productName: inv.productName || 'Sement',
      productMxik: inv.productMxik || '02523002001236004',
      productBarcode: inv.productBarcode || '',
      unitName: inv.unitName || 'tonna',
      quantity: inv.quantity || qty,
      price: inv.price || 0,
      vatRate: inv.vatRate || 0,
      vatSum: inv.vatSum || 0,
      totalSum: inv.totalSum || 0
    }];

    // Har bir tovar uchun alohida qator yaratamiz
    items.forEach((item, itemIdx) => {
      // Tovar ulushi (proportional ratio)
      const ratio = inv.quantity > 0 ? (item.quantity / inv.quantity) : (1 / items.length);
      const itemQty = parseFloat((qty * ratio).toFixed(3));
      const itemPrice = item.price || 0;
      const itemSumWithoutVat = parseFloat((itemQty * itemPrice).toFixed(2));

      // 62 ta ustundan iborat qator (Array) yaratish
      const row = new Array(62).fill('');

      row[0] = globalTtnSeq; // п.п ТТН * — fayl bo'yicha ketma-ket integer
      row[1] = 2; // Тип перевозки * (2 - Sotuvchidan xaridorga)
      row[2] = ttnNumber; // Номер ТТН *
      row[3] = formatDate(inv.invoiceDate); // Дата ТТН *
      row[4] = inv.contractNumber || ''; // Номер контракта *
      row[5] = formatDate(inv.contractDate); // Дата контракта  *
      row[6] = tinCell(senderTin); // ИНН/ПИНФЛ Грузоотправителя *
      row[7] = ''; // Код филиала (gruzootpravitel)
      row[8] = tinCell(inv.buyerTin); // ИНН/ПИНФЛ  Гruzoполучателя *
      row[9] = ''; // Код филиала (gruzopoluchatel)
      row[10] = tinCell(expeditorTin) || tinCell(inv.buyerTin) || ''; // ИНН/ПИНФЛ Экспедитора *
      row[11] = ''; // Код филиала (ekspeditor)
      row[12] = tinCell(v.carrierTin) || tinCell(senderTin) || ''; // ИНН/ПИНФЛ Грузоперевозчика *
      row[13] = ''; // Код филиала (gruzoperevozchik)
      row[14] = ''; // ИНН/ПИНФЛ/ПИНФЛ Клиента
      row[15] = ''; // Код филиала
      row[16] = ''; // Номер контракта
      row[17] = ''; // Дата контракта
      row[18] = tinCell(inv.buyerTin); // ИНН/ПИНФЛ Заказчика *
      row[19] = ''; // Код филиала
      row[20] = ''; // Номер контракта
      row[21] = ''; // Дата контракта
      row[22] = 1; // Тип транспорта * (1 - avtomobil)
      row[23] = v.plateNumber || ''; // Гос. номер авто. *
      row[24] = v.vehicleModel || 'SHACMAN'; // Модель авто. *
      // Transport egasi: har mashina uchun → sozlamadagi → jo'natuvchi STIR
      const vehicleTransportOwnerTin = v.transportOwnerTin || settings.transportOwnerTin || senderTin;
      row[25] = tinCell(vehicleTransportOwnerTin); // Транспорт принадлежит, ИНН/ПИНФЛ
      row[26] = v.trailerPlate || ''; // Гос. Номер полуприцепа
      row[27] = v.trailerModel || ''; // Модель полуприцепа
      row[28] = ''; // Гос. Номер прицепа
      row[29] = ''; // Модель прицепа
      row[30] = pinflCell(v.driverPinfl); // Водитель, ПИНФЛ *
      row[31] = pinflCell(v.driverPinfl); // Ответственное лицо, доставляющий груз, ПИНФЛ *
      row[32] = invoiceAllocIndex[invKey]; // п.п Груза * (TTN tartib raqami)
      
      // Ortish manzili (Loading)
      row[33] = Number(settings.loadingOblast) || 18; // slice: loadingOblast
      row[34] = Number(settings.loadingRayon) || 13; // slice: loadingRayon
      row[35] = loadingAddress; // Улица, Дом *
      row[36] = ''; // Широта
      row[37] = ''; //  Долгота
      
      row[38] = pinflCell(settings.senderResponsiblePinfl); // Ответственное лицо грузоотправителя, ПИНФЛ
      
      // Tushirish manzili (Delivery)
      row[39] = Number(unloadingAddr.oblastCode) || 1726; // Область * (Yuk tushirish)
      row[40] = Number(unloadingAddr.rayonCode) || 1; // Район *
      row[41] = unloadingAddr.addressText || 'Mijoz manzili'; // Улица, Дом *
      row[42] = ''; // Широта
      row[43] = ''; // Долгота
      
      // Qabul qiluvchi mas'ul = haydovchi PINFL (yetkazib berishda haydovchi mas'ul)
      row[44] = pinflCell(v.driverPinfl); // Ответственное лицо грузополучателя, ПИНФЛ
      row[45] = ''; // Номер доверенности
      row[46] = ''; // От
      row[47] = ''; // До
      row[48] = ''; // ID  доверенности
      row[49] = itemIdx + 1; // п.п Товаров * (tovar qatori tartib raqami)
      row[50] = ''; // ИНН/ПИНФЛ комитента
      row[51] = item.productMxik || '02523002001236004'; // ИКПУ *
      row[52] = item.productName || 'Sement'; // Описание товаров *
      row[53] = resolveUnitCode(item); // Ед. изм * (birlik kodi — Sozlamalardagi unitCodes jadvalidan)
      row[54] = itemQty; // Кол-vo *
      row[55] = itemPrice; // Цена *
      row[56] = itemSumWithoutVat; // Сумма (без НДС) *
      row[57] = itemQty; // Брутто *
      row[58] = itemQty; // Нетто *
      // Masofa: yuklash viloyatidan tushirish viloyatigacha avtomatik
      const autoDistance = getOblastDistance(settings.loadingOblast, unloadingAddr.oblastCode);
      // Yetkazish narxi: korxona yoki mijoz mashinasi → 0; uchinchi tomon → masofa × narx
      const ownerType = v.vehicleOwnerType || 'own';
      const isThirdParty = ownerType === 'third_party';
      const calcCostPerKm = isThirdParty ? deliveryCostPerKm : 0;
      const calcCostTotal = isThirdParty ? parseFloat((autoDistance * deliveryCostPerKm).toFixed(2)) : 0;
      row[59] = autoDistance;    // Общее расстояние *
      row[60] = calcCostPerKm;   // Стоимость доставки за 1 км *
      row[61] = calcCostTotal;   // Стоимость доставки (в сумах) *

      newDataRows.push(row);
    });
  });

  // 4. Excel sahifasini yangilash
  const ws = XLSX.utils.aoa_to_sheet(newDataRows);

  if (workbook) {
    const sheetName = workbook.SheetNames[0];
    workbook.Sheets[sheetName] = ws;
  } else {
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Лист1");
  }

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

module.exports = {
  generateEttnExcel,
  generateBulkEttnExcel
};
