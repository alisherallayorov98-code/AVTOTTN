const firebird = require('node-firebird');
const db = require('./db');

// Realistic Mock Invoices when Firebird is not connected
const mockInvoices = [
  {
    id: "inv_1",
    invoiceNumber: "101",
    invoiceDate: "2026-05-30",
    buyerTin: "201122334",
    buyerName: "BETA BUILDING MChJ",
    contractNumber: "12-S",
    contractDate: "2026-01-15",
    quantity: 300.0,
    totalSum: 235200000.0,
    items: [
      {
        productName: "Sement PORTLAND M-400 D20",
        productMxik: "02611001001000000",
        productBarcode: "4780012345678",
        unitName: "tonna",
        quantity: 200.0,
        price: 700000.0,
        vatRate: 12,
        vatSum: 16800000.0,
        totalSum: 156800000.0
      },
      {
        productName: "Sement PORTLAND M-500",
        productMxik: "02611001002000000",
        productBarcode: "4780012345685",
        unitName: "tonna",
        quantity: 100.0,
        price: 850000.0,
        vatRate: 12,
        vatSum: 8400000.0,
        totalSum: 78400000.0
      }
    ]
  },
  {
    id: "inv_2",
    invoiceNumber: "102",
    invoiceDate: "2026-05-30",
    buyerTin: "302233445",
    buyerName: "GOLDEN HOUSE STROY MChJ",
    contractNumber: "05-GH",
    contractDate: "2026-02-10",
    quantity: 120.0,
    totalSum: 114240000.0,
    items: [
      {
        productName: "Sement PORTLAND M-500",
        productMxik: "02611001002000000",
        productBarcode: "4780012345685",
        unitName: "tonna",
        quantity: 120.0,
        price: 850000.0,
        vatRate: 12,
        vatSum: 12240000.0,
        totalSum: 114240000.0
      }
    ]
  },
  {
    id: "inv_3",
    invoiceNumber: "103",
    invoiceDate: "2026-05-29",
    buyerTin: "205678123",
    buyerName: "Toshkent Qurilish Invest MChJ",
    contractNumber: "99-TQI",
    contractDate: "2026-04-01",
    quantity: 55.0,
    totalSum: 43120000.0,
    items: [
      {
        productName: "Sement PORTLAND M-400 D20",
        productMxik: "02611001001000000",
        productBarcode: "4780012345678",
        unitName: "tonna",
        quantity: 55.0,
        price: 700000.0,
        vatRate: 12,
        vatSum: 4620000.0,
        totalSum: 43120000.0
      }
    ]
  },
  {
    id: "inv_4",
    invoiceNumber: "104",
    invoiceDate: "2026-05-28",
    buyerTin: "308129845",
    buyerName: "PARKENT SEMENT LYUKS MChJ",
    contractNumber: "CO-404",
    contractDate: "2026-05-01",
    quantity: 450.0,
    totalSum: 428400000.0,
    items: [
      {
        productName: "Sement PORTLAND M-500",
        productMxik: "02611001002000000",
        productBarcode: "4780012345685",
        unitName: "tonna",
        quantity: 450.0,
        price: 850000.0,
        vatRate: 12,
        vatSum: 45900000.0,
        totalSum: 428400000.0
      }
    ]
  }
];

function getInvoicesFromFirebird(settings) {
  return new Promise((resolve, reject) => {
    const options = {
      host: settings.firebirdHost || '127.0.0.1',
      port: parseInt(settings.firebirdPort) || 3050,
      database: settings.firebirdDatabase,
      user: settings.firebirdUser || 'SYSDBA',
      password: settings.firebirdPassword || 'masterkey',
      lowercase_keys: true,
      role: null,
      pageSize: 4096
    };

    firebird.attach(options, function(err, dbConn) {
      if (err) {
        return reject(err);
      }
      
      const query = `
        SELECT 
          d.ID as id,
          d.DOC_NUM as invoiceNumber,
          d.DOC_DATE as invoiceDate,
          c.TIN as buyerTin,
          c.NAME as buyerName,
          d.CONTRACT_NUM as contractNumber,
          d.CONTRACT_DATE as contractDate,
          i.NAME as productName,
          i.MXIK as productMxik,
          i.BARCODE as productBarcode,
          i.UNIT as unitName,
          di.QTY as quantity,
          di.PRICE as price,
          di.VAT_RATE as vatRate,
          di.VAT_SUM as vatSum,
          di.TOTAL_SUM as totalSum
        FROM DOCUMENTS d
        JOIN CONTACTS c ON d.CONTACT_ID = c.ID
        JOIN DOCUMENT_ITEMS di ON di.DOCUMENT_ID = d.ID
        JOIN ITEMS i ON di.ITEM_ID = i.ID
        WHERE d.DOC_TYPE = 'INVOICE' AND d.DOC_DATE >= '2026-01-01'
        ORDER BY d.DOC_DATE DESC, d.DOC_NUM DESC
      `;

      dbConn.query(query, function(err, result) {
        dbConn.detach();
        if (err) {
          return reject(err);
        }
        
        // Group raw SQL rows by Document ID
        const invoicesMap = {};
        for (const row of result) {
          const docId = row.id || row.ID;
          const invoiceNumber = row.invoicenumber || row.invoiceNumber || row.DOC_NUM;
          const invoiceDate = row.invoicedate || row.invoiceDate || row.DOC_DATE;
          const buyerTin = row.buyertin || row.buyerTin || row.TIN;
          const buyerName = row.buyername || row.buyerName || row.NAME;
          const contractNumber = row.contractnumber || row.contractNumber || row.CONTRACT_NUM;
          const contractDate = row.contractdate || row.contractDate || row.CONTRACT_DATE;
          
          if (!invoicesMap[docId]) {
            invoicesMap[docId] = {
              id: String(docId),
              invoiceNumber: String(invoiceNumber),
              invoiceDate: invoiceDate ? String(invoiceDate).split(' ')[0] : '', // format as YYYY-MM-DD
              buyerTin: String(buyerTin),
              buyerName: String(buyerName),
              contractNumber: contractNumber ? String(contractNumber) : '',
              contractDate: contractDate ? String(contractDate).split(' ')[0] : '',
              quantity: 0,
              totalSum: 0,
              items: []
            };
          }
          
          const itemQty = parseFloat(row.quantity) || 0;
          const itemTotalSum = parseFloat(row.totalsum) || parseFloat(row.total_sum) || 0;
          
          invoicesMap[docId].quantity += itemQty;
          invoicesMap[docId].totalSum += itemTotalSum;
          
          invoicesMap[docId].items.push({
            productName: row.productname || row.productName || '',
            productMxik: row.productmxik || row.productMxik || '',
            productBarcode: row.productbarcode || row.productBarcode || '',
            unitName: row.unitname || row.unitName || 'tonna',
            quantity: itemQty,
            price: parseFloat(row.price) || 0,
            vatRate: parseFloat(row.vatrate) || parseFloat(row.vat_rate) || 0,
            vatSum: parseFloat(row.vatsum) || parseFloat(row.vat_sum) || 0,
            totalSum: itemTotalSum
          });
        }
        
        // Convert to array and round values
        const invoices = Object.values(invoicesMap).map(inv => {
          inv.quantity = parseFloat(inv.quantity.toFixed(3));
          inv.totalSum = parseFloat(inv.totalSum.toFixed(2));
          
          if (inv.items && inv.items.length > 0) {
            inv.productName = inv.items.length === 1 
              ? inv.items[0].productName 
              : `${inv.items[0].productName} va boshqalar (${inv.items.length} xil)`;
            inv.unitName = inv.items[0].unitName || 'tonna';
          }
          return inv;
        });

        resolve(invoices);
      });
    });
  });
}

// Yordamchi funksiya mock va real fakturalarni summary maydonlar bilan to'ldirish uchun
function ensureInvoiceSummaryFields(invoicesList) {
  return invoicesList.map(inv => {
    // Agar items bo'lsa va summary maydonlar yo'l bo'lsa, ularni to'ldiramiz
    if (inv.items && inv.items.length > 0) {
      if (!inv.productName) {
        inv.productName = inv.items.length === 1 
          ? inv.items[0].productName 
          : `${inv.items[0].productName} va boshqalar (${inv.items.length} xil)`;
      }
      if (!inv.unitName) {
        inv.unitName = inv.items[0].unitName || 'tonna';
      }
    }
    return inv;
  });
}

async function getInvoices() {
  const settings = db.getSettings();
  
  if (!settings.firebirdDatabase) {
    console.warn("1Uz Firebird database path is not configured. Using Mock Data.");
    return { invoices: ensureInvoiceSummaryFields(mockInvoices), isMock: true };
  }

  try {
    const result = await getInvoicesFromFirebird(settings);
    console.log(`Successfully fetched ${result.length} invoices from 1Uz Database.`);
    return { invoices: result, isMock: false };
  } catch (err) {
    console.warn("Failed to connect to 1Uz Database, falling back to Mock Data. Error:", err.message);
    return { invoices: ensureInvoiceSummaryFields(mockInvoices), isMock: true, error: err.message };
  }
}

module.exports = {
  getInvoices,
  getMockInvoices: () => mockInvoices
};
