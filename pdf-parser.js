const pdf = require('pdf-parse');

function parseRowValues(rowText) {
  const vatMatch = rowText.match(/(\d{1,2})%/);
  if (!vatMatch) return null;
  const vatRate = parseInt(vatMatch[1]);
  const parts = rowText.split(vatMatch[0]);
  const left = parts[0];
  const right = parts[1];
  
  const unitMatch = left.match(/^[a-zA-Zа-яА-ЯёЁ³²¹\s`'·\/]+/);
  const unitName = unitMatch ? unitMatch[0].trim() : 'tonna';
  const leftNoUnit = left.substring(unitName.length);
  
  const qtyMatch = leftNoUnit.match(/^(\d+\.\d{6})/);
  if (!qtyMatch) return null;
  const quantity = parseFloat(qtyMatch[1]);
  const leftNumbers = leftNoUnit.substring(qtyMatch[1].length);
  
  const cleanLeftNumbers = leftNumbers.replace(/\s/g, '');
  const leftNumsArray = cleanLeftNumbers.match(/\d+\.\d{2}/g);
  if (!leftNumsArray || leftNumsArray.length < 2) return null;
  const price = parseFloat(leftNumsArray[0]);
  const sum = parseFloat(leftNumsArray[1]);
  
  const cleanRight = right.replace(/\s/g, '');
  const rightNumsArray = cleanRight.match(/\d+\.\d{2}/g);
  if (!rightNumsArray || rightNumsArray.length < 2) return null;
  const vatSum = parseFloat(rightNumsArray[0]);
  const totalSum = parseFloat(rightNumsArray[1]);
  
  return {
    unitName,
    quantity,
    price,
    sum,
    vatRate,
    vatSum,
    totalSum
  };
}

async function parseInvoicePdf(buffer) {
  const data = await pdf(buffer);
  
  // Replace non-breaking spaces with normal spaces
  const text = data.text.replace(/\u00a0/g, ' ').replace(/\xa0/g, ' ');
  
  // Invoice details
  let invoiceDate = '';
  let invoiceNumber = '';
  const invoiceMatch = text.match(/(\d{2}\.\d{2}\.\d{4})\s*даги\s*(\d+)-сонли\s*\n\s*Ҳисобварақ-фактура/i);
  if (invoiceMatch) {
    invoiceDate = invoiceMatch[1].split('.').reverse().join('-');
    invoiceNumber = invoiceMatch[2];
  } else {
    const fb2 = text.match(/(\d{2}\.\d{2}\.\d{4})\s*даги\s*(\d+)-сонли/i);
    if (fb2) {
      invoiceNumber = fb2[2];
      invoiceDate = fb2[1].split('.').reverse().join('-');
    }
  }
  
  // Buyer details
  const buyerTinMatch = text.match(/Сотиб олувчининг СТИР[\s\S]*?(\d{9})/i);
  const buyerTin = buyerTinMatch ? buyerTinMatch[1] : '';
  
  const buyerNameMatch = text.match(/Сотиб олувчи\s*:\s*"?([^"\n\r]+)"?/i);
  const buyerName = buyerNameMatch ? buyerNameMatch[1].trim() : '';
  
  // Contract details
  const contractMatch = text.match(/(\d{2}\.\d{2}\.\d{4})\s*даги\s*(\S+)-сонли\s*шартномага/i);
  let contractDate = '';
  let contractNumber = '';
  if (contractMatch) {
    contractDate = contractMatch[1].split('.').reverse().join('-');
    contractNumber = contractMatch[2];
  }
  
  // Items
  const lines = text.split('\n');
  const items = [];
  let totalQuantity = 0;
  let totalSum = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const mxikMatch = line.match(/(\d{17})/);
    if (mxikMatch) {
      const mxik = mxikMatch[1];
      let productName = line.replace(mxik, '').replace(/^\s*-\s*/, '').trim();
      
      let valueRow = null;
      let j = i + 1;
      for (; j < Math.min(i + 10, lines.length); j++) {
        const nextLine = lines[j].trim();
        const nextLineLower = nextLine.toLowerCase();
        const hasUnit = nextLineLower.includes('тонна') || nextLineLower.includes('tonna') ||
          nextLineLower.includes('тн') || nextLineLower.includes('tn') ||
          nextLineLower.includes('кг') || nextLineLower.includes('kg') ||
          nextLineLower.includes('шт') || nextLineLower.includes('dona') ||
          nextLineLower.includes('м³') || nextLineLower.includes('м3') ||
          nextLineLower.includes('литр') || nextLineLower.includes('litr') ||
          nextLineLower.includes('метр') || nextLineLower.includes('metr') ||
          nextLineLower.includes('дона') || nextLineLower.includes('сони');
        
        if (nextLine.includes('%') && hasUnit) {
          valueRow = nextLine;
          break;
        } else {
          if (!nextLine.match(/\b\d{17}\b/) && !nextLine.includes('Жами') && !nextLine.includes('Рахбар')) {
            productName += ' ' + nextLine;
          }
        }
      }
      
      if (valueRow) {
        const values = parseRowValues(valueRow);
        if (values) {
          items.push({
            productName: productName.replace(/\s+/g, ' ').trim(),
            productMxik: mxik,
            unitName: values.unitName,
            quantity: values.quantity,
            price: values.price,
            vatRate: values.vatRate,
            vatSum: values.vatSum,
            totalSum: values.totalSum
          });
          totalQuantity += values.quantity;
          totalSum += values.totalSum;
          i = j;
        }
      }
    }
  }
  
  return {
    invoiceNumber,
    invoiceDate,
    buyerTin,
    buyerName,
    contractNumber,
    contractDate,
    quantity: parseFloat(totalQuantity.toFixed(3)),
    totalSum: parseFloat(totalSum.toFixed(2)),
    items
  };
}

module.exports = {
  parseInvoicePdf
};
