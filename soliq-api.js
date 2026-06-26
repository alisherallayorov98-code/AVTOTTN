/**
 * Soliq API — STIR/PINFL bo'yicha kompaniya ma'lumotlarini olish.
 * DB saqlamaydi — bu ipc-handlers.ts'ning ishi (network-aware).
 */

async function searchCompanyByTin(tin, settings) {
  const tinStr = String(tin || '').trim().replace(/\D/g, '');

  if (!tinStr || !/^\d{9,14}$/.test(tinStr)) {
    throw new Error("STIR/PINFL 9 yoki 14 ta raqamdan iborat bo'lishi kerak.");
  }

  // 1. Haqiqiy Soliq API
  if (settings?.soliqApiUrl && settings?.soliqApiKey && !String(settings.soliqApiKey).startsWith('demo-')) {
    try {
      console.log(`Soliq API: STIR ${tinStr} qidirilmoqda...`);

      let urlString = settings.soliqApiUrl;
      if (urlString.includes('%s')) {
        urlString = urlString.replace('%s', tinStr);
      } else if (urlString.includes('%25s')) {
        urlString = urlString.replace('%25s', tinStr);
      } else {
        const urlObj = new URL(urlString);
        urlObj.searchParams.set('tin', tinStr);
        urlString = urlObj.toString();
      }

      const response = await fetch(urlString, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.soliqApiKey}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        let raw = await response.json();
        let data = raw;
        if (raw?.data) data = raw.data;
        else if (raw?.result) data = raw.result;

        const name = data.name || data.shortName || data.companyName || data.name_uz || data.name_ru || data.nameUz || data.nameRu;
        const address = data.address || data.legalAddress || data.value || data.address_uz || data.address_ru || data.addressUz;
        const oblastCode = String(data.oblastCode || data.regionCode || data.oblast || '1726');
        const rayonCode = String(data.rayonCode || data.districtCode || data.rayon || '1');

        if (name) {
          console.log(`Soliq API: topildi — ${name}`);
          return { tin: tinStr, name, address: address || null, oblastCode, rayonCode, source: 'api' };
        }
        console.warn(`Soliq API: nom topilmadi. Javob:`, JSON.stringify(data).slice(0, 200));
      } else {
        console.warn(`Soliq API javob xatosi: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      if (err.name !== 'TimeoutError') {
        console.warn(`Soliq API xatolik: ${err.message}`);
      }
    }
  }

  // 2. API sozlanmagan yoki javob bermadi — null qaytaramiz
  return null;
}

module.exports = { searchCompanyByTin };
