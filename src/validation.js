import { addDays } from "./dateUtils.js";
import { normalizeRoveSubtypes } from "./rovingUtils.js";
import {
  isAllowedScheduleTime,
  minutesToTimeValue,
  normalizeScheduleTimeInput,
  timeToMinutes,
  timeToDisplayMinutes,
} from "./timeUtils.js";

export const WEEKLY_HOUR_LIMIT = 40;
export const DAILY_HOUR_LIMIT = 10;

export function getDailyHourWarning(totalHours, settings = {}) {
  const limit = Number(settings.maxDailyHours ?? DAILY_HOUR_LIMIT);

  if (settings.dailyMaxHoursWarningEnabled === false || totalHours <= limit) {
    return null;
  }

  return `Over ${limit} hours`;
}

export function getWeeklyHourWarning(totalHours, settings = {}) {
  const limit = Number(settings.maxWeeklyHours ?? WEEKLY_HOUR_LIMIT);

  if (settings.weeklyMaxHoursWarningEnabled === false || totalHours <= limit) {
    return null;
  }

  return `Over ${limit} hours`;
}

export function findDailyMaxHourWarnings(workers, dailyTotals, weekDates, settings = {}) {
  const limit = Number(settings.maxDailyHours ?? DAILY_HOUR_LIMIT);

  if (settings.dailyMaxHoursWarningEnabled === false) {
    return [];
  }

  const warnings = [];

  for (const date of weekDates) {
    const totalsForDate = dailyTotals[date.isoDate] ?? {};

    for (const worker of workers) {
      const hours = totalsForDate[worker.id] ?? 0;

      if (hours > limit) {
        warnings.push({
          workerId: worker.id,
          workerName: worker.name,
          date: date.isoDate,
          hours,
          limit,
        });
      }
    }
  }

  return warnings;
}

export function findWeeklyMaxHourWarnings(workers, weeklyTotals, settings = {}) {
  const limit = Number(settings.maxWeeklyHours ?? WEEKLY_HOUR_LIMIT);

  if (settings.weeklyMaxHoursWarningEnabled === false) {
    return [];
  }

  return workers
    .map((worker) => ({
      workerId: worker.id,
      workerName: worker.name,
      hours: weeklyTotals[worker.id] ?? 0,
      limit,
    }))
    .filter((warning) => warning.hours > limit);
}

export function validateShift(shift, schedule) {
  const errors = [];
  const startResult = shift.startTime
    ? normalizeScheduleTimeInput(shift.startTime, schedule.settings)
    : null;
  const endResult = shift.endTime
    ? normalizeScheduleTimeInput(shift.endTime, schedule.settings)
    : null;

  if (!shift.workerId) {
    errors.push("Worker is required.");
  } else if (!schedule.workers.some((worker) => worker.id === shift.workerId)) {
    errors.push("Choose a valid worker.");
  }

  if (!shift.date) {
    errors.push("Date is required.");
  }

  if (!shift.startTime) {
    errors.push("Start time is required.");
  }

  if (!shift.endTime) {
    errors.push("End time is required.");
  }

  if (!shift.label?.trim() && !shift.shiftType?.trim() && !shift.name?.trim()) {
    errors.push("Label or shift type is required.");
  }

  if (shift.shiftType === "Roving" && normalizeRoveSubtypes(shift.roveSubtypes ?? shift.roveSubtype ?? shift.roveType, shift.label).length === 0) {
    errors.push("Choose at least one roving subtype.");
  }

  if (startResult && !startResult.isValid) {
    errors.push(`Start time: ${startResult.error}`);
  }

  if (endResult && !endResult.isValid) {
    errors.push(`End time: ${endResult.error}`);
  }

  if (
    startResult?.isValid &&
    endResult?.isValid
  ) {
    const start = timeToDisplayMinutes(startResult.value, schedule.settings);
    const end = timeToDisplayMinutes(endResult.value, schedule.settings);

    if (end <= start) {
      errors.push("End time must be after start time.");
    }
  }

  return errors;
}

export function findShiftOverlaps(shifts, settings) {
  const overlaps = [];
  const groups = new Map();

  for (const shift of shifts) {
    const key = `${shift.workerId}|${shift.date}`;
    const group = groups.get(key) ?? [];
    group.push(shift);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const sorted = group.filter((shift) => {
      return (
        isAllowedScheduleTime(shift.startTime, settings) &&
        isAllowedScheduleTime(shift.endTime, settings)
      );
    }).map((shift) => {
      const start = timeToDisplayMinutes(shift.startTime, settings);
      const end = timeToDisplayMinutes(shift.endTime, settings);

      return {
        shift,
        start,
        end,
      };
    }).sort((a, b) => a.start - b.start);

    for (let index = 0; index < sorted.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < sorted.length; nextIndex += 1) {
        const current = sorted[index];
        const next = sorted[nextIndex];

        if (next.start >= current.end) {
          break;
        }

        overlaps.push({
          workerId: current.shift.workerId,
          date: current.shift.date,
          shiftIds: [current.shift.id, next.shift.id],
        });
      }
    }
  }

  return overlaps;
}

export function findPhoneCoverageOverlaps(shifts, settings) {
  const roleConfigs = [
    {
      role: "primary",
      includes: (shift) => shift.alsoOnCall || shift.shiftType === "On Call",
    },
    {
      role: "backup",
      includes: (shift) => shift.alsoBackupOnCall || shift.shiftType === "Backup On Call",
    },
  ];
  const overlaps = [];

  for (const config of roleConfigs) {
    const groups = new Map();

    for (const shift of shifts) {
      if (!config.includes(shift)) {
        continue;
      }

      const group = groups.get(shift.date) ?? [];
      group.push(shift);
      groups.set(shift.date, group);
    }

    for (const group of groups.values()) {
      const sorted = group.filter((shift) => {
        return (
          isAllowedScheduleTime(shift.startTime, settings) &&
          isAllowedScheduleTime(shift.endTime, settings)
        );
      }).map((shift) => {
        let start = timeToDisplayMinutes(shift.startTime, settings);
        let end = timeToDisplayMinutes(shift.endTime, settings);

        if (end <= start) {
          end += 24 * 60;
        }

        return {
          shift,
          start,
          end,
        };
      }).sort((a, b) => a.start - b.start);

      for (let index = 0; index < sorted.length; index += 1) {
        for (let nextIndex = index + 1; nextIndex < sorted.length; nextIndex += 1) {
          const current = sorted[index];
          const next = sorted[nextIndex];

          if (next.start >= current.end) {
            break;
          }

          if (current.shift.workerId === next.shift.workerId) {
            continue;
          }

          overlaps.push({
            role: config.role,
            date: current.shift.date,
            workerIds: [current.shift.workerId, next.shift.workerId],
            shiftIds: [current.shift.id, next.shift.id],
            startTime: minutesToTimeValue(Math.max(current.start, next.start)),
            endTime: minutesToTimeValue(Math.min(current.end, next.end)),
          });
        }
      }
    }
  }

  return overlaps;
}

export function findLongConsecutiveWorkWarnings(shifts, settings) {
  if (settings.longShiftWarningEnabled === false) {
    return [];
  }

  const maxMinutes = Number(settings.maxConsecutiveWorkHours ?? 5) * 60;
  const requiredBreakMinutes = Number(settings.requiredBreakMinutes ?? 30);
  const groups = new Map();
  const warnings = [];

  for (const shift of shifts) {
    if (!isCountedWorkShift(shift, settings)) {
      continue;
    }

    const key = `${shift.workerId}|${shift.date}`;
    const group = groups.get(key) ?? [];
    let start = timeToDisplayMinutes(shift.startTime, settings);
    let end = timeToDisplayMinutes(shift.endTime, settings);

    if (end <= start) {
      end += 24 * 60;
    }

    group.push({ shift, start, end });
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const sorted = group.sort((a, b) => a.start - b.start);
    let blockStart = null;
    let blockEnd = null;
    let blockShiftIds = [];
    let blockWorkerId = "";
    let blockDate = "";

    for (const item of sorted) {
      if (blockStart === null) {
        blockStart = item.start;
        blockEnd = item.end;
        blockShiftIds = [item.shift.id];
        blockWorkerId = item.shift.workerId;
        blockDate = item.shift.date;
        continue;
      }

      const breakMinutes = item.start - blockEnd;

      if (breakMinutes < requiredBreakMinutes) {
        blockEnd = Math.max(blockEnd, item.end);
        blockShiftIds.push(item.shift.id);
      } else {
        addLongShiftWarning(warnings, {
          blockDate,
          blockEnd,
          blockShiftIds,
          blockStart,
          blockWorkerId,
          maxMinutes,
        });
        blockStart = item.start;
        blockEnd = item.end;
        blockShiftIds = [item.shift.id];
        blockWorkerId = item.shift.workerId;
        blockDate = item.shift.date;
      }
    }

    addLongShiftWarning(warnings, {
      blockDate,
      blockEnd,
      blockShiftIds,
      blockStart,
      blockWorkerId,
      maxMinutes,
    });
  }

  return warnings;
}

export function findLateNightMorningWarnings(shifts, settings) {
  if (settings.lateNightWarningEnabled === false) {
    return [];
  }

  const lateThreshold = timeToDisplayMinutes(settings.lateNightThreshold ?? "23:00", settings);
  const earlyThreshold = timeToMinutes(settings.earlyMorningThreshold ?? "08:00");
  const workingShifts = shifts.filter((shift) => isCountedWorkShift(shift, settings));
  const lateShifts = [];
  const earlyByWorkerDate = new Map();

  for (const shift of workingShifts) {
    const start = timeToDisplayMinutes(shift.startTime, settings);
    let end = timeToDisplayMinutes(shift.endTime, settings);

    if (end <= start) {
      end += 24 * 60;
    }

    if (end > lateThreshold) {
      lateShifts.push({ shift, end });
    }

    if (timeToMinutes(shift.startTime) < earlyThreshold) {
      const key = `${shift.workerId}|${shift.date}`;
      const group = earlyByWorkerDate.get(key) ?? [];
      group.push({ shift, start: timeToMinutes(shift.startTime) });
      earlyByWorkerDate.set(key, group);
    }
  }

  const warnings = [];

  for (const late of lateShifts) {
    const nextDate = addDays(late.shift.date, 1);
    const earlyGroup = earlyByWorkerDate.get(`${late.shift.workerId}|${nextDate}`) ?? [];

    for (const early of earlyGroup) {
      warnings.push({
        workerId: late.shift.workerId,
        lateDate: late.shift.date,
        nextDate,
        lateShiftId: late.shift.id,
        earlyShiftId: early.shift.id,
        lateEndTime: minutesToTimeValue(late.end),
        earlyStartTime: early.shift.startTime,
      });
    }
  }

  return warnings;
}

function addLongShiftWarning(warnings, {
  blockDate,
  blockEnd,
  blockShiftIds,
  blockStart,
  blockWorkerId,
  maxMinutes,
}) {
  if (blockStart === null || blockEnd === null || blockEnd - blockStart <= maxMinutes) {
    return;
  }

  warnings.push({
    workerId: blockWorkerId,
    date: blockDate,
    shiftIds: blockShiftIds,
    startTime: minutesToTimeValue(blockStart),
    endTime: minutesToTimeValue(blockEnd),
    hours: (blockEnd - blockStart) / 60,
  });
}

function isCountedWorkShift(shift, settings) {
  return (
    shift.countsTowardHours &&
    isAllowedScheduleTime(shift.startTime, settings) &&
    isAllowedScheduleTime(shift.endTime, settings)
  );
}
