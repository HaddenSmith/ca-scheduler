import { buildWeekDates } from "./dateUtils.js";
import { getShiftDurationHours, splitShiftIntoWeekSegments } from "./timeUtils.js";

export const WEEKLY_TYPE_COLUMNS = [
  "Check In",
  "Check Out",
  "Checkout/Project",
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

export function calculateDailyTotals(workers, shifts, weekStartDate, settings = {}) {
  const weekDates = buildWeekDates(weekStartDate);
  const totals = {};

  for (const date of weekDates) {
    totals[date.isoDate] = {};

    for (const worker of workers) {
      totals[date.isoDate][worker.id] = 0;
    }
  }

  for (const shift of shifts) {
    if (!shift.countsTowardHours) {
      continue;
    }

    for (const segment of splitShiftIntoWeekSegments(shift, weekStartDate, settings)) {
      if (!totals[segment.date] || totals[segment.date][shift.workerId] === undefined) {
        continue;
      }

      totals[segment.date][shift.workerId] += segment.durationHours;
    }
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
  const totals = {};

  for (const worker of workers) {
    totals[worker.id] = Object.fromEntries(WEEKLY_TYPE_COLUMNS.map((column) => [column, 0]));
  }

  for (const shift of shifts) {
    if (!totals[shift.workerId]) {
      continue;
    }

    const weekSegments = splitShiftIntoWeekSegments(shift, weekStartDate);

    if (weekSegments.length === 0) {
      continue;
    }

    if (isPhoneCoverageShift(shift)) {
      totals[shift.workerId]["On Call / Backup On Call"] += sumSegmentHours(weekSegments);
    }

    if (!shift.countsTowardHours) {
      continue;
    }

    const category = getCountedShiftCategory(shift.shiftType);
    const countedHours = sumSegmentHours(weekSegments);

    totals[shift.workerId][category] += countedHours;
    totals[shift.workerId]["Total Counted"] += countedHours;
  }

  return totals;
}

function sumSegmentHours(segments) {
  return segments.reduce((total, segment) => total + segment.durationHours, 0);
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
