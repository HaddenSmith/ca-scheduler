import { buildWeekDates } from "./dateUtils.js";
import { getShiftDurationHours } from "./timeUtils.js";

export function getShiftHours(shift) {
  if (!shift.countsTowardHours) {
    return 0;
  }

  return getShiftDurationHours(shift);
}

export function calculateDailyTotals(workers, shifts, weekStartDate) {
  const weekDates = buildWeekDates(weekStartDate);
  const totals = {};

  for (const date of weekDates) {
    totals[date.isoDate] = {};

    for (const worker of workers) {
      totals[date.isoDate][worker.id] = 0;
    }
  }

  for (const shift of shifts) {
    if (!totals[shift.date] || totals[shift.date][shift.workerId] === undefined) {
      continue;
    }

    totals[shift.date][shift.workerId] += getShiftHours(shift);
  }

  return totals;
}

export function calculateWeeklyTotals(workers, dailyTotals) {
  return workers.reduce((totals, worker) => {
    totals[worker.id] = Object.values(dailyTotals).reduce((sum, dayTotals) => {
      return sum + (dayTotals[worker.id] ?? 0);
    }, 0);

    return totals;
  }, {});
}

export function formatHours(hours) {
  return Number(hours).toFixed(2);
}
