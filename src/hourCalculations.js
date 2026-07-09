import { buildWeekDates } from "./dateUtils.js";
import { getShiftDurationHours } from "./timeUtils.js";

export const WEEKLY_TYPE_COLUMNS = [
  "Check In",
  "Check Out",
  "Desk",
  "Roving",
  "Projects",
  "Staff Meeting",
  "On Call / Backup On Call",
  "Other",
  "Total Counted",
];

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

export function calculateWeeklyTypeTotals(workers, shifts, weekStartDate) {
  const weekDates = new Set(buildWeekDates(weekStartDate).map((date) => date.isoDate));
  const totals = {};

  for (const worker of workers) {
    totals[worker.id] = Object.fromEntries(WEEKLY_TYPE_COLUMNS.map((column) => [column, 0]));
  }

  for (const shift of shifts) {
    if (!weekDates.has(shift.date) || !totals[shift.workerId]) {
      continue;
    }

    const duration = getShiftDurationHours(shift);

    if (isPhoneCoverageShift(shift)) {
      totals[shift.workerId]["On Call / Backup On Call"] += duration;
    }

    if (!shift.countsTowardHours) {
      continue;
    }

    const category = getCountedShiftCategory(shift.shiftType);
    totals[shift.workerId][category] += duration;
    totals[shift.workerId]["Total Counted"] += duration;
  }

  return totals;
}

export function formatHours(hours) {
  return Number(hours).toFixed(2);
}

function getCountedShiftCategory(shiftType) {
  if (WEEKLY_TYPE_COLUMNS.includes(shiftType) && shiftType !== "On Call / Backup On Call") {
    return shiftType;
  }

  return "Other";
}

function isPhoneCoverageShift(shift) {
  return Boolean(
    shift.alsoOnCall ||
    shift.alsoBackupOnCall ||
    shift.shiftType === "On Call" ||
    shift.shiftType === "Backup On Call",
  );
}
