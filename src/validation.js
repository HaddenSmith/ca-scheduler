import {
  isAllowedScheduleTime,
  minutesToTimeValue,
  normalizeScheduleTimeInput,
  timeToDisplayMinutes,
} from "./timeUtils.js";

export const WEEKLY_HOUR_LIMIT = 40;

export function getWeeklyHourWarning(totalHours) {
  if (totalHours <= WEEKLY_HOUR_LIMIT) {
    return null;
  }

  return `Over ${WEEKLY_HOUR_LIMIT} hours`;
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
