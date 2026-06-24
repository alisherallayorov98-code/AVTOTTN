const db = require('./db');

// Mock data for search fallback
const mockCompanies = {
  "201122334": {
    tin: "201122334",
    name: "BETA BUILDING MChJ",
    address: "Toshkent sh., Yunusobod tumani, Bog'ishamol ko'chasi, 12-uy",
    oblastCode: "1726",
    rayonCode: "11",
    director: "Karimov A.B."
  },
  "202448305": {
    tin: "202448305",
    name: "BETA BUILDING MChJ",
    address: "АЛЛАБЕРГАНОВА КУЧАСИ 1 УЙ",
    oblastCode: "1726",
    rayonCode: "5",
    director: "Karimov A.B."
  },
  "302233445": {
    tin: "302233445",
    name: "GOLDEN HOUSE STROY MChJ",
    address: "массив Янги Хаёт, 12-uy",
    oblastCode: "1726",
    rayonCode: "13",
    director: "Sodiqov J.R."
  },
  "205678123": {
    tin: "205678123",
    name: "Toshkent Qurilish Invest MChJ",
    address: "Toshkent sh., Chilonzor tumani, Bunyodkor ko'chasi, 10-uy",
    oblastCode: "1726",
    rayonCode: "3",
    director: "Alimov F.M."
  },
  "308129845": {
    tin: "308129845",
    name: "PARKENT SEMENT LYUKS MChJ",
    address: "Toshkent viloyati, Parkent tumani, So'qoq QFY",
    oblastCode: "1718",
    rayonCode: "8",
    director: "Rustamov D.S."
  }
};

async function searchCompanyByTin(tin) {
  const settings = db.getSettings();
  
  if (!tin || !/^\d{9}$/.test(String(tin))) {
    throw new Error("STIR (TIN) 9 ta raqamdan iborat bo'lishi kerak.");
  }

  // 1. Agar Sozlamalarda Soliq API ko'rsatilgan bo'lsa, global fetch() orqali so'rov yuborish
  if (settings.soliqApiUrl && settings.soliqApiKey && !settings.soliqApiKey.startsWith('demo-')) {
    try {
      console.log(`Soliq API orqali STIR ${tin} qidirilmoqda...`);
      
      let urlString = settings.soliqApiUrl;
      if (urlString.includes('%s')) {
        urlString = urlString.replace('%s', tin);
      } else if (urlString.includes('%25s')) {
        urlString = urlString.replace('%25s', tin);
      } else {
        const urlObj = new URL(urlString);
        urlObj.searchParams.append('tin', tin);
        urlString = urlObj.toString();
      }
      
      console.log(`Soliq API so'rov yuborilmoqda: ${urlString}`);
      
      const response = await fetch(urlString, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.soliqApiKey}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        let rawData = await response.json();
        
        // Response modelini robust tarzda parse qilish (nested data yoki result bo'lsa)
        let data = rawData;
        if (rawData && rawData.data) {
          data = rawData.data;
        } else if (rawData && rawData.result) {
          data = rawData.result;
        }
        
        const companyName = data.name || data.shortName || data.companyName || data.name_uz || data.name_ru || data.nameUz || data.nameRu;
        const companyAddress = data.address || data.legalAddress || data.value || data.address_uz || data.address_ru || data.addressUz || data.addressRu;
        const oblast = data.oblastCode || data.regionCode || data.oblast || data.region || "1726";
        const rayon = data.rayonCode || data.districtCode || data.rayon || data.district || "1";
        
        if (companyName) {
          const result = {
            tin: tin,
            name: companyName,
            address: companyAddress || "Manzil ko'rsatilmagan",
            oblastCode: String(oblast),
            rayonCode: String(rayon),
            source: 'api'
          };
          
          saveToLocalCustomers(result);
          return result;
        }
      } else {
        console.warn(`Soliq API so'rovi muvaffaqiyatsiz bo'ldi. Status: ${response.status}`);
      }
    } catch (err) {
      console.warn(`Soliq API so'rovida xatolik: ${err.message}. Mock ma'lumot ishlatiladi.`);
    }
  }

  // 2. Fallback: Agar API bo'lmasa yoki xato bersa, mock ma'lumotlardan qidirish
  console.log(`Mock ma'lumotlar bazasidan STIR ${tin} qidirilmoqda...`);
  const mockCompany = mockCompanies[tin];
  if (mockCompany) {
    const result = {
      ...mockCompany,
      source: 'mock'
    };
    saveToLocalCustomers(result);
    return result;
  }

  // 3. Agar umuman topilmasa, test uchun dinamik kompaniya yaratish
  const defaultResult = {
    tin: tin,
    name: `Yangi Tashkilot (STIR: ${tin})`,
    address: "Toshkent shahri, ETTN yetkazib berish manzili",
    oblastCode: "1726",
    rayonCode: "1",
    source: 'generated'
  };
  saveToLocalCustomers(defaultResult);
  return defaultResult;
}

function saveToLocalCustomers(comp) {
  const customers = db.getCustomers();
  const existing = customers.find(c => c.tin === comp.tin);
  
  if (existing) {
    if (comp.address && !existing.addresses.some(a => a.addressText === comp.address)) {
      existing.addresses.push({
        addressText: comp.address,
        oblastCode: comp.oblastCode || "1726",
        rayonCode: comp.rayonCode || "1"
      });
      db.saveCustomer(existing);
    }
  } else {
    db.saveCustomer({
      tin: comp.tin,
      name: comp.name,
      addresses: [{
        addressText: comp.address || "Toshkent sh.",
        oblastCode: comp.oblastCode || "1726",
        rayonCode: comp.rayonCode || "1"
      }]
    });
  }
}

module.exports = {
  searchCompanyByTin
};
