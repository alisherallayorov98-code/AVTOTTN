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
const { vehicleFits, packagingGroups } = require('./cargo-type');
const cap = (v) => { const c = parseFloat(v.maxCapacity); return c > 0 ? c : 0; };
const { localDate } = require('./local-date');
const round3 = (n) => parseFloat(n.toFixed(3));

// Mashina bugun ishlay oladimi: faol va "ta'mirda" (pausedUntil) muddati o'tgan
function isAvailable(v, today) {
  if (v.isActive === false) return false;
  const day = today || localDate();
  return !(v.pausedUntil && String(v.pausedUntil) >= day);
}

function autoSplit(totalQuantity, vehicles, packaging = 'any') {
  const active = vehicles.filter(v => isAvailable(v) && cap(v) > 0 && vehicleFits(v, packaging));
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
      .sort((a, b) => cap(b) - cap(a));
    for (const v of vehiclesForTrip) {
      slots.push({ vehicle: v, tripIndex: trip });
    }
  }

  let remaining = totalQuantity;
  const allocations = [];

  for (const slot of slots) {
    if (remaining <= 0.001) break;
    const allocated = Math.min(remaining, cap(slot.vehicle));
    allocations.push({
      vehicle: slot.vehicle,
      packaging,
      quantityAllocated: parseFloat(allocated.toFixed(3)),
      tripIndex: slot.tripIndex
    });
    remaining = round3(remaining - allocated);
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
function bulkAutoDispatch(invoices, fleet, initialTrips = {}, today) {
  const active = fleet.filter(v => isAvailable(v, today) && cap(v) > 0);

  if (invoices.length === 0 || active.length === 0) {
    return {
      allocations: [],
      remainingInvoices: invoices.map(inv => ({ invoiceId: inv.id, remainingQty: inv.quantity }))
    };
  }

  // Har bir mashina uchun bajarilgan reyslar soni
  const tripCount = {};
  // Bugun allaqachon bajarilgan reyslar hisobga olinadi (limit kun bo'yicha)
  for (const v of active) tripCount[v.id] = parseInt(initialTrips[v.id]) || 0;

  const allocations = [];
  const remainingInvoices = [];

  for (const inv of invoices) {
    // Xaridorning o'z mashinasi bo'lsa — faqat shulardan foydalanish
    const buyerVehicles = active.filter(v => v.customerTin && String(v.customerTin) === String(inv.buyerTin));
    const baseFleet = buyerVehicles.length > 0 ? buyerVehicles : active.filter(v => !v.customerTin);

    // Qopli va sochma sement alohida taqsimlanadi (sochma faqat sementovozda)
    for (const group of packagingGroups(inv)) {
      const packaging = group.packaging;
      const eligibleFleet = baseFleet.filter(v => vehicleFits(v, packaging));
      let groupRemaining = group.quantity;

      while (groupRemaining > 0.001) {
        // Hali trip limiti to'lmagan mashinalar (maxDailyTrips hisobga olinadi)
        const available = eligibleFleet.filter(
          v => tripCount[v.id] < (parseInt(v.maxDailyTrips) || 2)
        );
        if (available.length === 0) break; // mos mashina yo'q yoki limit to'ldi

        // Eng kam reys bajargan, keyin eng ko'p sig'imli mashinani tanlaymiz
        available.sort((a, b) => {
          const diff = tripCount[a.id] - tripCount[b.id];
          if (diff !== 0) return diff;
          return cap(b) - cap(a);
        });

        const vehicle = available[0];
        const tripIndex = tripCount[vehicle.id] + 1;
        const allocated = Math.min(groupRemaining, cap(vehicle));

        allocations.push({
          invoiceId: inv.id,
          vehicleId: vehicle.id,
          packaging,
          tripIndex,
          quantity: parseFloat(allocated.toFixed(3))
        });

        tripCount[vehicle.id]++;
        groupRemaining = round3(groupRemaining - allocated);
      }

      if (groupRemaining > 0.001) {
        remainingInvoices.push({
          invoiceId: inv.id,
          packaging,
          remainingQty: parseFloat(groupRemaining.toFixed(3)),
          reason: eligibleFleet.length === 0 ? 'no_vehicle' : 'trip_limit'
        });
      }
    }
  }

  return { allocations, remainingInvoices };
}

module.exports = { autoSplit, bulkAutoDispatch, isAvailable };
