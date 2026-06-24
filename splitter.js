/**
 * Yukni mashinalarning yuk ko'tarish qobiliyatiga ko'ra taqsimlash algoritmlari
 */

/**
 * Bitta faktura yukini tanlangan mashinalar va ularning reyslariga taqsimlash
 */
function autoSplit(totalQuantity, vehicles) {
  if (totalQuantity <= 0 || !vehicles || vehicles.length === 0) {
    return { allocations: [], remaining: totalQuantity };
  }

  const sortedVehicles = [...vehicles].sort((a, b) => b.maxCapacity - a.maxCapacity);
  
  let remaining = totalQuantity;
  const allocations = [];

  for (const vehicle of sortedVehicles) {
    if (remaining <= 0) break;
    
    const allocated = Math.min(remaining, vehicle.maxCapacity);
    allocations.push({
      vehicle: vehicle,
      quantityAllocated: parseFloat(allocated.toFixed(3))
    });
    remaining -= allocated;
  }

  return {
    allocations,
    remaining: parseFloat(remaining.toFixed(3))
  };
}

/**
 * Ko'plab fakturalarni butun avtopark bo'yicha aqlli taqsimlash (Smart Fleet Dispatch)
 * 
 * Tizim jami yuk miqdoridan kelib chiqib, avtomatik ravishda mashinalarga reyslarni
 * teng taqsimlaydi (Round-Robin formatida). Bitta mashina zimmisiga haddan tashqari ko'p
 * yuk tushib qolishi oldini oladi.
 * 
 * @param {Array} invoices - Taqsimlanishi kerak bo'lgan fakturalar ro'yxati [{id, quantity, buyerName}]
 * @param {Array} fleet - Avtoparkdagi mashinalar ro'yxati [{id, plateNumber, maxCapacity, maxDailyTrips, isActive}]
 * @returns {Object} { allocations: Array, remainingInvoices: Array }
 */
function bulkAutoDispatch(invoices, fleet) {
  // Faqat aktiv mashinalarni olamiz
  const activeFleet = fleet.filter(v => v.isActive !== false);
  
  if (invoices.length === 0 || activeFleet.length === 0) {
    return {
      allocations: [],
      remainingInvoices: invoices.map(inv => ({ invoiceId: inv.id, remainingQty: inv.quantity }))
    };
  }

  // Jami taqsimlanishi kerak bo'lgan yuk miqdori
  const totalQuantity = invoices.reduce((sum, inv) => sum + inv.quantity, 0);

  const tripSlots = [];

  // Mashinalarni sig'imi bo'yicha kamayish tartibida saralaymiz (kattasidan boshlaymiz)
  const sortedFleet = [...activeFleet].sort((a, b) => b.maxCapacity - a.maxCapacity);

  // Har bir mashina uchun uning kunlik maksimal reyslar soni (maxDailyTrips) bo'yicha slotlar yaratamiz
  for (const vehicle of sortedFleet) {
    const maxTrips = parseInt(vehicle.maxDailyTrips) || 2;
    for (let tripIdx = 1; tripIdx <= maxTrips; tripIdx++) {
      tripSlots.push({
        vehicle: vehicle,
        tripIndex: tripIdx,
        availableCapacity: vehicle.maxCapacity,
        isUsed: false
      });
    }
  }

  // Round-Robin ko'rinishida taqsimlash uchun slotlarni saralaymiz:
  // Avval barcha mashinalarning 1-reyslari, keyin 2-reyslari va h.k.
  // Har bir reys guruhi ichida esa sig'imi kattaroq bo'lgan mashinaga ustunlik beramiz.
  tripSlots.sort((a, b) => {
    if (a.tripIndex !== b.tripIndex) {
      return a.tripIndex - b.tripIndex;
    }
    return b.vehicle.maxCapacity - a.vehicle.maxCapacity;
  });


  const allocations = [];
  const remainingInvoices = [];
  
  let slotPointer = 0;

  // Har bir fakturani navbat bilan taqsimlaymiz
  for (const inv of invoices) {
    let invoiceRemaining = inv.quantity;
    
    while (invoiceRemaining > 0 && slotPointer < tripSlots.length) {
      const slot = tripSlots[slotPointer];
      
      const allocated = Math.min(invoiceRemaining, slot.availableCapacity);
      
      allocations.push({
        invoiceId: inv.id,
        vehicleId: slot.vehicle.id,
        tripIndex: slot.tripIndex,
        quantity: parseFloat(allocated.toFixed(3))
      });

      invoiceRemaining -= allocated;
      
      // Bitta reys faqat bitta mijozga xizmat qiladi
      slot.isUsed = true;
      slotPointer++;
    }

    if (invoiceRemaining > 0) {
      remainingInvoices.push({
        invoiceId: inv.id,
        remainingQty: parseFloat(invoiceRemaining.toFixed(3))
      });
    }
  }

  return {
    allocations,
    remainingInvoices
  };
}

module.exports = {
  autoSplit,
  bulkAutoDispatch
};
