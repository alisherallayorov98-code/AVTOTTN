const db1Uz = require('./dist/1uz-db');
const dbMethods = require('./dist/db');
async function run() {
  try {
    const data = await db1Uz.getInvoices();
    console.log('Invoices length:', data.invoices?.length);
    console.log('Mock?', data.isMock);
    
    const manual = dbMethods.getManualInvoices();
    console.log('Manual length:', manual?.length);
  } catch (e) {
    console.error('Error in run:', e);
  }
}
run();
