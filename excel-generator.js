const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

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
  if (newDataRows.length < 4) {
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
  const transportOwnerTin = settings.transportOwnerTin || senderTin;
  const receiverResponsiblePinfl = settings.receiverResponsiblePinfl || '';
  const senderName = settings.senderName || "SEMENT INSHAOT SAVDO MChJ";
  const loadingAddress = settings.loadingAddress || "массив Янги Хаёт";

  // ETTN qo'shimcha qiymatlari (Sozlamalardan, standart qiymat bilan)
  const deliveryDistance = parseFloat(settings.deliveryDistance) || 1;       // Umumiy masofa (km)
  const deliveryCostPerKm = parseFloat(settings.deliveryCostPerKm) || 1;     // 1 km narxi (so'm)
  const deliveryCostTotal = parseFloat((deliveryDistance * deliveryCostPerKm).toFixed(2)) || 1;
  const expeditorTin = settings.expeditorTin || senderTin;                   // Ekspeditor STIR (bo'sh -> jo'natuvchi)
  const unitCodes = settings.unitCodes || { tonna: 1629438 };                // Birlik nomi -> Didox kodi
  const DEFAULT_UNIT_CODE = 1629438; // tonna

  // Tovar birligi nomidan Didox birlik kodini aniqlash
  const resolveUnitCode = (item) => {
    if (item.unitCode) return Number(item.unitCode);
    const name = String(item.unitName || '').trim().toLowerCase();
    if (name && unitCodes[name]) return Number(unitCodes[name]);
    return DEFAULT_UNIT_CODE;
  };

  // Har faktura uchun alohida tartib raqami hisoblagichi
  const invoiceAllocIndex = {};

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

      row[0] = ttnNumber; // п.п ТТН *
      row[1] = 2; // Тип перевозки * (2 - Sotuvchidan xaridorga)
      row[2] = ttnNumber; // Номер ТТН *
      row[3] = formatDate(inv.invoiceDate); // Дата ТТН *
      row[4] = inv.contractNumber || ''; // Номер контракта *
      row[5] = formatDate(inv.contractDate); // Дата контракта  *
      row[6] = Number(senderTin) || ''; // ИНН/ПИНФЛ Грузоотправителя *
      row[7] = ''; // Код филиала (gruzootpravitel)
      row[8] = Number(inv.buyerTin) || ''; // ИНН/ПИНФЛ  Гruzoполучателя *
      row[9] = ''; // Код филиала (gruzopoluchatel)
      row[10] = Number(expeditorTin) || Number(inv.buyerTin) || ''; // ИНН/ПИНФЛ Экспедитора * (Sozlamalardan: bo'sh -> jo'natuvchi)
      row[11] = ''; // Код филиала (ekspeditor)
      row[12] = Number(v.carrierTin) || Number(senderTin) || ''; // ИНН/ПИНФЛ Грузоперевозчика *
      row[13] = ''; // Код филиала (gruzoperevozchik)
      row[14] = ''; // ИНН/ПИНФЛ/ПИНФЛ Клиента
      row[15] = ''; // Код филиала
      row[16] = ''; // Номер контракта
      row[17] = ''; // Дата контракта
      row[18] = Number(inv.buyerTin) || ''; // ИНН/ПИНФЛ Заказчика *
      row[19] = ''; // Код филиала
      row[20] = ''; // Номер контракта
      row[21] = ''; // Дата контракта
      row[22] = 1; // Тип транспорта * (1 - avtomobil)
      row[23] = v.plateNumber || ''; // Гос. номер авто. *
      row[24] = v.vehicleModel || 'SHACMAN'; // Модель авто. *
      row[25] = Number(transportOwnerTin) || ''; // Транспорт принадлежит, ИНН/ПИНФЛ
      row[26] = v.trailerPlate || ''; // Гос. Номер полуприцепа
      row[27] = v.trailerModel || ''; // Модель полуприцепа
      row[28] = ''; // Гос. Номер прицепа
      row[29] = ''; // Модель прицепа
      row[30] = Number(v.driverPinfl) || ''; // Водитель, ПИНФЛ *
      row[31] = Number(v.driverPinfl) || ''; // Ответственное лицо, доставляющий груз, ПИНФЛ *
      row[32] = invoiceAllocIndex[invKey]; // п.п Груза * (TTN tartib raqami)
      
      // Ortish manzili (Loading)
      row[33] = Number(settings.loadingOblast) || 18; // slice: loadingOblast
      row[34] = Number(settings.loadingRayon) || 13; // slice: loadingRayon
      row[35] = loadingAddress; // Улица, Дом *
      row[36] = ''; // Широта
      row[37] = ''; //  Долгота
      
      row[38] = Number(settings.senderResponsiblePinfl) || ''; // Ответственное лицо грузоотправителя, ПИНФЛ
      
      // Tushirish manzili (Delivery)
      row[39] = Number(unloadingAddr.oblastCode) || 1726; // Область * (Yuk tushirish)
      row[40] = Number(unloadingAddr.rayonCode) || 1; // Район *
      row[41] = unloadingAddr.addressText || 'Mijoz manzili'; // Улица, Дом *
      row[42] = ''; // Широта
      row[43] = ''; // Долгота
      
      row[44] = Number(receiverResponsiblePinfl) || ''; // Ответственное лицо грузополучателя, ПИНФЛ
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
      row[59] = deliveryDistance; // Общее расстояние * (Sozlamalardan)
      row[60] = deliveryCostPerKm; // Стоимость доставки за 1 км * (Sozlamalardan)
      row[61] = deliveryCostTotal; // Стоимость доставки (в сумах) * (masofa × 1km narxi)

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
