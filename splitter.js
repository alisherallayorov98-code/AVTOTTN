/**
 * AvtoETTN — Yuk taqsimlash algoritmlari
 *
 * Asosiy qoida: avval ko'p mashina 1 reysdan, keyin kam mashina ko'p reysdan.
 * Misol: 150t + 3x50t mashina → 3 mashina × 1 reys (1 mashina × 3 reys emas)
 */

/**
 * Bitta faktura uchun optimal taqsimlash.
 * Round-robin: avval barcha mashinalar 1-reysini bajaradi, keyin 2-reysni, h.k.
 */
function autoSplit(totalQuantity, vehicles) {
  const active = vehicles.filter(v => v.isActive !== false);
  if (totalQuantity <= 0 || active.length === 0) {
    return { allocations: [], remaining: totalQuantity };
  }

  const maxTrips = Math.max(...active.map(v => parseInt(v.maxDailyTrips) || 2));

  // Round-robin slot yaratish: avval barcha mashinalar 1-reysda, keyin 2-reysda...
  const slots = [];
  for (let trip = 1; trip <= maxTrips; trip++) {
    // Har trip davrida mashinalarni sig'imi bo'yicha kamayish tartibida saralaymiz
    const vehiclesForTrip = active
      .filter(v => (parseInt(v.maxDailyTrips) || 2) >= trip)
      .sort((a, b) => (parseFloat(b.maxCapacity) || 0) - (parseFloat(a.maxCapacity) || 0));
    for (const v of vehiclesForTrip) {
      slots.push({ vehicle: v, tripIndex: trip });
    }
  }

  let remaining = totalQuantity;
  const allocations = [];

  for (const slot of slots) {
    if (remaining <= 0.001) break;
    const allocated = Math.min(remaining, slot.vehicle.maxCapacity);
    allocations.push({
      vehicle: slot.vehicle,
      quantityAllocated: parseFloat(allocated.toFixed(3)),
      tripIndex: slot.tripIndex
    });
    remaining -= allocated;
  }

  return {
    allocations,
    remaining: parseFloat(remaining.toFixed(3))
  };
}

/**
 * Ko'plab fakturalar uchun aqlli taqsimlash (Smart Fleet Dispatch).
 *
 * Har bir fakturani taqsimlashda eng kam reys bajargan mashinaga ustunlik beriladi.
 * Bu orqali barcha mashinalar taxminan bir xil sonli reys bajaradi.
 *
 * Misol: 50 faktura, 4 mashina → har bir mashina ~12-13 reys (1 mashina 30, boshqasi 5 reys emas)
 */
function bulkAutoDispatch(invoices, fleet) {
  const active = fleet.filter(v => v.isActive !== false);

  if (invoices.length === 0 || active.length === 0) {
    return {
      allocations: [],
      remainingInvoices: invoices.map(inv => ({ invoiceId: inv.id, remainingQty: inv.quantity }))
    };
  }

  // Har bir mashina uchun bajarilgan reyslar soni
  const tripCount = {};
  for (const v of active) tripCount[v.id] = 0;

  const allocations = [];
  const remainingInvoices = [];

  for (const inv of invoices) {
    let invoiceRemaining = parseFloat(inv.quantity) || 0;

    while (invoiceRemaining > 0.001) {
      // Hali trip limiti to'lmagan mashinalar (maxDailyTrips hisobga olinadi)
      const available = active.filter(
        v => tripCount[v.id] < (parseInt(v.maxDailyTrips) || 2)
      );

      if (available.length === 0) break; // Barcha mashinalar limitni to'ldirdi

      // Eng kam reys bajargan, keyin eng ko'p sig'imli mashinani tanlaymiz
      available.sort((a, b) => {
        const diff = tripCount[a.id] - tripCount[b.id];
        if (diff !== 0) return diff;
        return (parseFloat(b.maxCapacity) || 0) - (parseFloat(a.maxCapacity) || 0);
      });

      const vehicle = available[0];
      const tripIndex = tripCount[vehicle.id] + 1;
      const allocated = Math.min(invoiceRemaining, vehicle.maxCapacity);

      allocations.push({
        invoiceId: inv.id,
        vehicleId: vehicle.id,
        tripIndex,
        quantity: parseFloat(allocated.toFixed(3))
      });

      tripCount[vehicle.id]++;
      invoiceRemaining -= allocated;
    }

    if (invoiceRemaining > 0.001) {
      remainingInvoices.push({
        invoiceId: inv.id,
        remainingQty: parseFloat(invoiceRemaining.toFixed(3))
      });
    }
  }

  return { allocations, remainingInvoices };
}

module.exports = { autoSplit, bulkAutoDispatch };
