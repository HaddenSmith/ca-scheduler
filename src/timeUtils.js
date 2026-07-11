import { addDays, formatTimeForDisplay } from "./dateUtils.js";

export function timeToMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function getScheduleBoundaryMinutes(settings) {
  const start = timeToMinutes(settings.startTime);
  let end = timeToMinutes(settings.endTime);

  if (end <= start) {
    end += 24 * 60;
  }

  return { start, end };
}

export function timeToDisplayMinutes(time, settings) {
  const { start } = getScheduleBoundaryMinutes(settings);
  let minutes = timeToMinutes(time);

  if (minutes < start) {
    minutes += 24 * 60;
  }

  return minutes;
}

export function parseTimeInput(input) {
  const value = String(input ?? "").trim().toLowerCase();
  const match = value.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(a|am|p|pm)?$/);

  if (!match) {
    return {
      isValid: false,
      error: "Use a time like 9, 9:15, 9:15 PM, or 21:15.",
      value: "",
    };
  }

  const rawHour = Number(match[1]);
  const rawMinute = match[2] === undefined ? 0 : Number(match[2]);
  const suffix = match[3];

  if (rawMinute < 0 || rawMinute > 59) {
    return {
      isValid: false,
      error: "Minutes must be between 00 and 59.",
      value: "",
    };
  }

  if (suffix && (rawHour < 1 || rawHour > 12)) {
    return {
      isValid: false,
      error: "AM/PM times must use hours from 1 to 12.",
      value: "",
    };
  }

  if (!suffix && (rawHour < 0 || rawHour > 23)) {
    return {
      isValid: false,
      error: "24-hour times must use hours from 0 to 23.",
      value: "",
    };
  }

  let hour = rawHour;

  if (suffix === "am" || suffix === "a") {
    hour = rawHour === 12 ? 0 : rawHour;
  }

  if (suffix === "pm" || suffix === "p") {
    hour = rawHour === 12 ? 12 : rawHour + 12;
  }

  return {
    isValid: true,
    error: "",
    value: `${String(hour).padStart(2, "0")}:${String(rawMinute).padStart(2, "0")}`,
  };
}

export function normalizeScheduleTimeInput(input, settings) {
  const parsed = parseTimeInput(input);

  if (!parsed.isValid) {
    return parsed;
  }

  if (!isAllowedScheduleTime(parsed.value, settings)) {
    return {
      isValid: false,
      error: `Time must use a ${settings.slotMinutes}-minute increment between ${formatTimeForDisplay(settings.startTime)} and ${formatTimeForDisplay(settings.endTime)}.`,
      value: parsed.value,
    };
  }

  return parsed;
}

export function isAllowedScheduleTime(time, settings) {
  const { start, end } = getScheduleBoundaryMinutes(settings);
  const minutes = timeToDisplayMinutes(time, settings);

  return (
    Number.isFinite(minutes) &&
    minutes >= start &&
    minutes <= end &&
    (minutes - start) % settings.slotMinutes === 0
  );
}

export function getShiftDurationHours(shift) {
  let start = timeToMinutes(shift.startTime);
  let end = timeToMinutes(shift.endTime);

  if (end <= start) {
    end += 24 * 60;
  }

  return Math.max(0, (end - start) / 60);
}

export function splitShiftIntoCalendarSegments(shift) {
  if (!shift.date || !shift.startTime || !shift.endTime) {
    return [];
  }

  const start = timeToMinutes(shift.startTime);
  let end = timeToMinutes(shift.endTime);
  const segments = [];

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return segments;
  }

  if (end <= start) {
    end += 24 * 60;
  }

  for (let cursor = start; cursor < end;) {
    const dayOffset = Math.floor(cursor / (24 * 60));
    const dayStart = dayOffset * 24 * 60;
    const dayEnd = dayStart + 24 * 60;
    const segmentEnd = Math.min(end, dayEnd);

    segments.push({
      date: addDays(shift.date, dayOffset),
      startMinute: cursor - dayStart,
      endMinute: segmentEnd - dayStart,
      startTime: minutesToTimeValue(cursor),
      endTime: minutesToTimeValue(segmentEnd),
      durationMinutes: segmentEnd - cursor,
      shift,
    });

    cursor = segmentEnd;
  }

  return segments;
}

export function splitShiftIntoWeekSegments(shift, weekStartDate) {
  const weekDates = new Set(
    Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index)),
  );

  return splitShiftIntoCalendarSegments(shift)
    .filter((segment) => weekDates.has(segment.date))
    .map((segment) => ({
      ...segment,
      durationHours: segment.durationMinutes / 60,
    }));
}

export function buildTimeTicks(settings) {
  const { start, end } = getScheduleBoundaryMinutes(settings);
  const ticks = [];

  for (let minute = start; minute <= end; minute += 60) {
    const normalizedHour = Math.floor(minute / 60) % 24;
    const normalizedMinute = minute % 60;

    ticks.push({
      label: formatTimeForDisplay(
        `${String(normalizedHour).padStart(2, "0")}:${String(normalizedMinute).padStart(2, "0")}`,
      ),
      offsetMinutes: minute - start,
    });
  }

  return ticks;
}

export function buildTimeOptions(settings) {
  const { start, end } = getScheduleBoundaryMinutes(settings);
  const options = [];

  for (let minute = start; minute <= end; minute += settings.slotMinutes) {
    const value = minutesToTimeValue(minute);
    options.push({
      value,
      label: formatTimeForDisplay(value),
    });
  }

  return options;
}

export function buildTimeInputOptions(settings) {
  return buildTimeOptions(settings).map((option) => ({
    value: option.label,
    label: option.value,
  }));
}

export function minutesToTimeValue(totalMinutes) {
  const normalized = totalMinutes % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
