/**
 * Soliq API — STIR/PINFL bo'yicha kompaniya ma'lumotlarini olish.
 * DB ga tegmaydi — saqlash ipc-handlers.ts ning ishi (network-aware).
 */

// Nested javobdan asosiy data'ni topish
function unwrap(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  if (Array.isArray(raw)) return raw[0] || null;
  // Ko'p API'lar javobni nested qiladi
  for (const key of ['data', 'result', 'body', 'response', 'payload', 'object', 'company', 'firm']) {
    if (raw[key] && typeof raw[key] === 'object') {
      const inner = Array.isArray(raw[key]) ? raw[key][0] : raw[key];
      if (inner && typeof inner === 'object') return inner;
    }
  }
  return raw;
}

// Ko'p variatsiyali maydon nomlaridan birinchi topilganini olish
function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

async function searchCompanyByTin(tin, settings) {
  const tinStr = String(tin || '').trim().replace(/\D/g, '');

  if (!tinStr || !/^\d{9,14}$/.test(tinStr)) {
    throw new Error('STIR/PINFL 9 yoki 14 ta raqamdan iborat bo\'lishi kerak.');
  }

  if (!settings?.soliqApiUrl || !settings?.soliqApiKey) {
    console.warn(`Soliq API sozlanmagan: URL="${settings?.soliqApiUrl}", KEY yoq`);
    return null;
  }
  if (String(settings.soliqApiKey).startsWith('demo-')) {
    console.warn('Soliq API demo-kalit bilan ishlaydi — real so\'rov yuborilmayapti');
    return null;
  }

  try {
    let urlString = settings.soliqApiUrl.trim();

    // URL ichidagi STIR placeholder'ni almashtirish
    if (urlString.includes('{tin}')) {
      urlString = urlString.replace('{tin}', tinStr);
    } else if (urlString.includes('%s')) {
      urlString = urlString.replace('%s', tinStr);
    } else if (urlString.includes('%25s')) {
      urlString = urlString.replace('%25s', tinStr);
    } else if (urlString.includes('{inn}')) {
      urlString = urlString.replace('{inn}', tinStr);
    } else {
      // Parametr sifatida qo'shamiz — ?tin= yoki &tin=
      const urlObj = new URL(urlString);
      if (!urlObj.searchParams.has('tin') && !urlObj.searchParams.has('inn')) {
        urlObj.searchParams.set('tin', tinStr);
      }
      urlString = urlObj.toString();
    }

    console.log(`Soliq API so'rov: ${urlString}`);

    const headers = { Accept: 'application/json' };
    const key = String(settings.soliqApiKey).trim();
    if (key) {
      // Ko'p API'lar turli auth usuli ishlatadi
      if (key.length > 20) {
        headers['Authorization'] = `Bearer ${key}`;
      } else {
        headers['X-Api-Key'] = key;
        headers['Authorization'] = `Bearer ${key}`;
      }
    }

    const response = await fetch(urlString, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000)
    });

    const responseText = await response.text();
    console.log(`Soliq API status: ${response.status}, javob uzunligi: ${responseText.length} bayt`);

    if (!response.ok) {
      console.warn(`Soliq API xato: HTTP ${response.status} — ${responseText.slice(0, 300)}`);
      return null;
    }

    let raw;
    try {
      raw = JSON.parse(responseText);
    } catch {
      console.warn('Soliq API JSON parse xatoligi:', responseText.slice(0, 200));
      return null;
    }

    const data = unwrap(raw);
    if (!data || typeof data !== 'object') {
      console.warn('Soliq API: data topilmadi. Raw:', JSON.stringify(raw).slice(0, 300));
      return null;
    }

    console.log('Soliq API data kalitlari:', Object.keys(data).join(', '));

    const name = pick(data,
      'name', 'shortName', 'companyName', 'orgName',
      'name_uz', 'name_ru', 'nameUz', 'nameRu',
      'full_name', 'fullName', 'title', 'label'
    );

    if (!name) {
      console.warn('Soliq API: kompaniya nomi topilmadi. Data:', JSON.stringify(data).slice(0, 300));
      return null;
    }

    // Manzil — ko'p variatsiyali
    const address = pick(data,
      'address', 'legalAddress', 'legal_address', 'regAddress',
      'address_uz', 'address_ru', 'addressUz', 'addressRu',
      'location', 'addr', 'value', 'fullAddress', 'full_address',
      'streetAddress', 'street_address', 'adres', 'manzil'
    );

    // Viloyat kodi
    const oblastCode = pick(data,
      'oblastCode', 'regionCode', 'region_code', 'oblast_code',
      'oblast', 'region', 'regionId', 'region_id',
      'soato', 'soato_code', 'obl'
    ) || '1726';

    // Tuman kodi
    const rayonCode = pick(data,
      'rayonCode', 'districtCode', 'district_code', 'rayon_code',
      'rayon', 'district', 'districtId', 'district_id',
      'tuman', 'tuman_code'
    ) || '1';

    console.log(`Soliq API topildi: "${name}", manzil: "${address || 'yo\'q'}"`);

    return {
      tin: tinStr,
      name,
      address: address || null,
      oblastCode: String(oblastCode),
      rayonCode: String(rayonCode),
      source: 'api'
    };

  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      console.warn(`Soliq API timeout (10 soniya): ${tinStr}`);
    } else {
      console.warn(`Soliq API xatolik: ${err.message}`);
    }
    return null;
  }
}

// Sozlamalarni sinash uchun (to'liq raw javobni qaytaradi)
async function testConnection(tin, settings) {
  const tinStr = String(tin || '').trim().replace(/\D/g, '') || '123456789';

  try {
    if (!settings?.soliqApiUrl) return { ok: false, error: 'API URL kiritilmagan' };

    let urlString = settings.soliqApiUrl.trim();
    for (const [ph, val] of [
      ['{tin}', tinStr], ['%s', tinStr], ['%25s', tinStr], ['{inn}', tinStr]
    ]) {
      if (urlString.includes(ph)) { urlString = urlString.replace(ph, val); break; }
    }
    if (!urlString.includes(tinStr)) {
      const u = new URL(urlString);
      u.searchParams.set('tin', tinStr);
      urlString = u.toString();
    }

    const key = String(settings.soliqApiKey || '').trim();
    const headers = { Accept: 'application/json' };
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
      headers['X-Api-Key'] = key;
    }

    const response = await fetch(urlString, {
      method: 'GET', headers,
      signal: AbortSignal.timeout(8000)
    });

    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    return {
      ok: response.ok,
      status: response.status,
      url: urlString,
      rawText: text.slice(0, 1000),
      json: json ? JSON.stringify(json, null, 2).slice(0, 1500) : null,
      parsed: json ? unwrap(json) : null
    };
  } catch (err) {
    return { ok: false, error: err.message, url: settings.soliqApiUrl };
  }
}

module.exports = { searchCompanyByTin, testConnection };
