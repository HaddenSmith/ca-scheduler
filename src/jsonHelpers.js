import { getWeekStartDate, getTodayIsoDate } from "./dateUtils.js";
import { DEFAULT_SETTINGS, SHIFT_TYPE_PRESETS } from "./model.js";
import { normalizeScheduleTimeInput, timeToDisplayMinutes, timeToMinutes } from "./timeUtils.js";
import { normalizeDeskCoverage, normalizeShift } from "./scheduleState.js";

export const SCHEDULE_FILE_SCHEMA_VERSION = 1;
export const SCHEDULE_FILE_APP_ID = "conference-scheduler";

const ALLOWED_SLOT_MINUTES = new Set([15, 30, 60]);

export function serializeSchedule(schedule, options = {}) {
  return JSON.stringify(createScheduleFile(schedule, options), null, 2);
}

export function createScheduleFile(schedule, {
  asPublished = false,
  scheduleVersionOverride = null,
} = {}) {
  const now = new Date().toISOString();
  const settings = normalizeSettingsForExport(schedule.settings);
  const shifts = (schedule.shifts ?? []).map((shift) => normalizeShift(shift, settings));
  const deskCoverage = (schedule.deskCoverage ?? []).map((coverage) => normalizeDeskCoverage(coverage, settings));
  const scheduleVersion = asPublished
    ? scheduleVersionOverride ?? getNextPublishedScheduleVersion(schedule)
    : normalizeScheduleVersion(schedule.scheduleVersion);
  const publishedAt = asPublished
    ? now
    : normalizePublishedAt(schedule.publishedAt);

  return {
    schemaVersion: SCHEDULE_FILE_SCHEMA_VERSION,
    app: SCHEDULE_FILE_APP_ID,
    exportedAt: now,
    lastModifiedAt: now,
    revision: schedule.revision ?? 1,
    ...(scheduleVersion !== null ? { scheduleVersion } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    data: {
      workers: schedule.workers ?? [],
      shifts,
      deskCoverage,
      onCallAssignments: (schedule.onCallAssignments ?? []).map((assignment) => ({
        date: assignment.date,
        primaryWorkerId: assignment.primaryWorkerId ?? "",
        backupWorkerId: assignment.backupWorkerId ?? "",
      })),
      settings,
      currentWeekStart: schedule.weekStartDate,
    },
  };
}

export function downloadScheduleJson(schedule) {
  const scheduleVersion = getNextPublishedScheduleVersion(schedule);
  const json = serializeSchedule(schedule, {
    asPublished: true,
    scheduleVersionOverride: scheduleVersion,
  });
  schedule.exportedScheduleVersion = scheduleVersion;
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `conference-schedule-${getTodayIsoDate()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return link.download;
}

export function getNextPublishedScheduleVersion(schedule) {
  const cachedVersion = normalizeScheduleVersion(schedule?.exportedScheduleVersion);

  if (cachedVersion !== null) {
    return cachedVersion;
  }

  const currentVersion = normalizeScheduleVersion(schedule?.scheduleVersion);
  return currentVersion === null ? 1 : currentVersion + 1;
}

export function parseScheduleJson(jsonText) {
  let parsed;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      isValid: false,
      errors: ["This file is not valid JSON."],
      schedule: null,
    };
  }

  return validateAndNormalizeScheduleFile(parsed);
}

export function validateAndNormalizeScheduleFile(file) {
  const errors = [];
  const warnings = [];

  if (!file || typeof file !== "object" || Array.isArray(file)) {
    return invalid("The JSON file must contain a schedule object.");
  }

  if (!Number.isInteger(file.schemaVersion)) {
    errors.push("schemaVersion is required.");
  } else if (file.schemaVersion !== SCHEDULE_FILE_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion ${file.schemaVersion}. This app supports version ${SCHEDULE_FILE_SCHEMA_VERSION}.`);
  }

  const data = file.data;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    errors.push("data object is required.");
  }

  if (errors.length > 0 || !data) {
    return invalid(errors);
  }

  const workers = normalizeWorkers(data.workers, errors);
  const workerIds = new Set(workers.map((worker) => worker.id));
  const settings = normalizeSettings(data.settings, warnings);
  const shifts = normalizeShifts(data.shifts, workerIds, settings, errors);
  const deskCoverage = normalizeDeskCoverageItems(data.deskCoverage ?? [], settings, errors);
  const onCallAssignments = normalizeOnCallAssignments(
    data.onCallAssignments ?? data.onCall ?? data.nightlyOnCall ?? [],
    workerIds,
    errors,
  );
  const weekStartDate = normalizeWeekStartDate(
    data.currentWeekStart ?? data.weekStartDate,
    settings,
    warnings,
  );

  if (errors.length > 0) {
    return invalid(errors);
  }

  return {
    isValid: true,
    errors: [],
    warnings,
    metadata: {
      app: file.app ?? "",
      exportedAt: file.exportedAt ?? "",
      lastModifiedAt: file.lastModifiedAt ?? "",
      revision: Number.isInteger(file.revision) ? file.revision : 1,
      scheduleVersion: normalizeScheduleVersion(file.scheduleVersion),
      publishedAt: normalizePublishedAt(file.publishedAt),
      schemaVersion: file.schemaVersion,
    },
    schedule: {
      settings,
      weekStartDate,
      workers,
      shifts,
      deskCoverage,
      onCallAssignments,
      revision: Number.isInteger(file.revision) ? file.revision : 1,
      lastModifiedAt: file.lastModifiedAt ?? file.exportedAt ?? "",
      scheduleVersion: normalizeScheduleVersion(file.scheduleVersion),
      publishedAt: normalizePublishedAt(file.publishedAt),
    },
  };
}

export function compareScheduleVersions(localSchedule, publishedSchedule) {
  const localVersion = getComparableScheduleVersion(localSchedule);
  const publishedVersion = getComparableScheduleVersion(publishedSchedule);

  if (!localVersion || !publishedVersion || localVersion.kind !== publishedVersion.kind) {
    return null;
  }

  return publishedVersion.value === localVersion.value
    ? 0
    : publishedVersion.value > localVersion.value ? 1 : -1;
}

function getComparableScheduleVersion(schedule) {
  const version = normalizeScheduleVersion(schedule?.scheduleVersion);

  if (version !== null) {
    return { kind: "number", value: version };
  }

  const publishedAt = normalizePublishedAt(schedule?.publishedAt);

  return publishedAt ? { kind: "date", value: Date.parse(publishedAt) } : null;
}

function normalizeScheduleVersion(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const version = Number(value);
  return Number.isFinite(version) && version >= 0 ? version : null;
}

function normalizePublishedAt(value) {
  if (typeof value !== "string" || !value || Number.isNaN(Date.parse(value))) {
    return "";
  }

  return value;
}

function normalizeWorkers(value, errors) {
  if (!Array.isArray(value)) {
    errors.push("data.workers must be an array.");
    return [];
  }

  const workers = [];
  const seenIds = new Set();

  value.forEach((worker, index) => {
    if (!worker || typeof worker !== "object" || Array.isArray(worker)) {
      errors.push(`Worker ${index + 1} must be an object.`);
      return;
    }

    const id = String(worker.id ?? "").trim();
    const name = String(worker.name ?? "").trim();

    if (!id) {
      errors.push(`Worker ${index + 1} is missing an id.`);
    }

    if (!name) {
      errors.push(`Worker ${index + 1} is missing a name.`);
    }

    if (id && seenIds.has(id)) {
      errors.push(`Worker id "${id}" is duplicated.`);
    }

    if (id && name && !seenIds.has(id)) {
      workers.push({
        ...worker,
        id,
        name,
      });
      seenIds.add(id);
    }
  });

  return workers;
}

function normalizeSettings(value, warnings) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rawShiftColors = raw.shiftColors && typeof raw.shiftColors === "object" && !Array.isArray(raw.shiftColors)
    ? raw.shiftColors
    : {};

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    warnings.push("Settings were missing or invalid, so defaults were used.");
  }

  const settings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    shiftColors: {
      ...DEFAULT_SETTINGS.shiftColors,
      ...rawShiftColors,
    },
  };

  if (!Object.prototype.hasOwnProperty.call(rawShiftColors, "Checkout/Project")) {
    settings.shiftColors["Checkout/Project"] = settings.shiftColors["Check Out"];
  }

  if (!ALLOWED_SLOT_MINUTES.has(Number(settings.slotMinutes))) {
    warnings.push("Invalid time increment was replaced with 15 minutes.");
    settings.slotMinutes = DEFAULT_SETTINGS.slotMinutes;
  } else {
    settings.slotMinutes = Number(settings.slotMinutes);
  }

  if (!Number.isInteger(Number(settings.weekStartsOn)) || Number(settings.weekStartsOn) < 0 || Number(settings.weekStartsOn) > 6) {
    warnings.push("Invalid week start day was replaced with Saturday.");
    settings.weekStartsOn = DEFAULT_SETTINGS.weekStartsOn;
  } else {
    settings.weekStartsOn = Number(settings.weekStartsOn);
  }

  if (!isClockTime(settings.startTime)) {
    warnings.push("Invalid visible day start time was replaced with 7:00 AM.");
    settings.startTime = DEFAULT_SETTINGS.startTime;
  }

  if (!isClockTime(settings.endTime)) {
    warnings.push("Invalid visible day end time was replaced with 2:00 AM.");
    settings.endTime = DEFAULT_SETTINGS.endTime;
  }

  if (timeToMinutes(settings.startTime) === timeToMinutes(settings.endTime)) {
    warnings.push("Visible day start and end matched, so default visible hours were used.");
    settings.startTime = DEFAULT_SETTINGS.startTime;
    settings.endTime = DEFAULT_SETTINGS.endTime;
  }

  settings.longShiftWarningEnabled = settings.longShiftWarningEnabled !== false;
  settings.lateNightWarningEnabled = settings.lateNightWarningEnabled !== false;
  settings.weeklyMaxHoursWarningEnabled = settings.weeklyMaxHoursWarningEnabled !== false;
  settings.dailyMaxHoursWarningEnabled = settings.dailyMaxHoursWarningEnabled !== false;
  settings.deskCoverageGapWarningEnabled = settings.deskCoverageGapWarningEnabled !== false;
  settings.missingNightPhoneCoverageWarningEnabled = settings.missingNightPhoneCoverageWarningEnabled !== false;
  settings.viewerWarningsEnabled = settings.viewerWarningsEnabled !== false;

  if (!isPositiveNumber(settings.maxWeeklyHours)) {
    warnings.push("Invalid max weekly hours was replaced with 40.");
    settings.maxWeeklyHours = DEFAULT_SETTINGS.maxWeeklyHours;
  } else {
    settings.maxWeeklyHours = Number(settings.maxWeeklyHours);
  }

  if (!isPositiveNumber(settings.maxDailyHours)) {
    warnings.push("Invalid max daily hours was replaced with 10.");
    settings.maxDailyHours = DEFAULT_SETTINGS.maxDailyHours;
  } else {
    settings.maxDailyHours = Number(settings.maxDailyHours);
  }

  if (!isPositiveNumber(settings.maxConsecutiveWorkHours)) {
    warnings.push("Invalid max consecutive work hours was replaced with 5.");
    settings.maxConsecutiveWorkHours = DEFAULT_SETTINGS.maxConsecutiveWorkHours;
  } else {
    settings.maxConsecutiveWorkHours = Number(settings.maxConsecutiveWorkHours);
  }

  if (!isNonNegativeNumber(settings.requiredBreakMinutes)) {
    warnings.push("Invalid required break length was replaced with 30 minutes.");
    settings.requiredBreakMinutes = DEFAULT_SETTINGS.requiredBreakMinutes;
  } else {
    settings.requiredBreakMinutes = Number(settings.requiredBreakMinutes);
  }

  if (!isClockTime(settings.lateNightThreshold)) {
    warnings.push("Invalid late-night threshold was replaced with 11:00 PM.");
    settings.lateNightThreshold = DEFAULT_SETTINGS.lateNightThreshold;
  }

  if (!isClockTime(settings.earlyMorningThreshold)) {
    warnings.push("Invalid early-morning threshold was replaced with 8:00 AM.");
    settings.earlyMorningThreshold = DEFAULT_SETTINGS.earlyMorningThreshold;
  }

  if (!isClockTime(settings.deskCoverageRequiredStartTime)) {
    warnings.push("Invalid required desk coverage start time was replaced with 7:00 AM.");
    settings.deskCoverageRequiredStartTime = DEFAULT_SETTINGS.deskCoverageRequiredStartTime;
  }

  if (!isClockTime(settings.deskCoverageRequiredEndTime)) {
    warnings.push("Invalid required desk coverage end time was replaced with 12:00 AM.");
    settings.deskCoverageRequiredEndTime = DEFAULT_SETTINGS.deskCoverageRequiredEndTime;
  }

  if (timeToMinutes(settings.deskCoverageRequiredStartTime) === timeToMinutes(settings.deskCoverageRequiredEndTime)) {
    warnings.push("Required desk coverage start and end matched, so default desk coverage hours were used.");
    settings.deskCoverageRequiredStartTime = DEFAULT_SETTINGS.deskCoverageRequiredStartTime;
    settings.deskCoverageRequiredEndTime = DEFAULT_SETTINGS.deskCoverageRequiredEndTime;
  }

  return settings;
}

function normalizeShifts(value, workerIds, settings, errors) {
  if (!Array.isArray(value)) {
    errors.push("data.shifts must be an array.");
    return [];
  }

  const shifts = [];
  const seenIds = new Set();

  value.forEach((shift, index) => {
    if (!shift || typeof shift !== "object" || Array.isArray(shift)) {
      errors.push(`Shift ${index + 1} must be an object.`);
      return;
    }

    const id = String(shift.id ?? "").trim();
    const workerId = String(shift.workerId ?? "").trim();
    const date = String(shift.date ?? "").trim();
    const startTime = String(shift.startTime ?? shift.start ?? "").trim();
    const endTime = String(shift.endTime ?? shift.end ?? "").trim();
    const shiftType = String(shift.shiftType ?? shift.type ?? "").trim();
    const label = String(shift.label ?? "").trim();

    if (!id) {
      errors.push(`Shift ${index + 1} is missing an id.`);
    } else if (seenIds.has(id)) {
      errors.push(`Shift id "${id}" is duplicated.`);
    }

    if (!workerId) {
      errors.push(`Shift ${id || index + 1} is missing a workerId.`);
    } else if (!workerIds.has(workerId)) {
      errors.push(`Shift ${id || index + 1} references unknown worker "${workerId}".`);
    }

    if (!isIsoDate(date)) {
      errors.push(`Shift ${id || index + 1} has an invalid date.`);
    }

    if (!startTime) {
      errors.push(`Shift ${id || index + 1} is missing a start time.`);
    }

    if (!endTime) {
      errors.push(`Shift ${id || index + 1} is missing an end time.`);
    }

    if (!shiftType || !SHIFT_TYPE_PRESETS[shiftType]) {
      errors.push(`Shift ${id || index + 1} has an unknown shift type.`);
    }

    if (!label) {
      errors.push(`Shift ${id || index + 1} is missing a label.`);
    }

    const startResult = startTime ? normalizeScheduleTimeInput(startTime, settings) : null;
    const endResult = endTime ? normalizeScheduleTimeInput(endTime, settings) : null;

    if (startResult && !startResult.isValid) {
      errors.push(`Shift ${id || index + 1} start time: ${startResult.error}`);
    }

    if (endResult && !endResult.isValid) {
      errors.push(`Shift ${id || index + 1} end time: ${endResult.error}`);
    }

    if (startResult?.isValid && endResult?.isValid) {
      const start = timeToDisplayMinutes(startResult.value, settings);
      const end = timeToDisplayMinutes(endResult.value, settings);

      if (end <= start) {
        errors.push(`Shift ${id || index + 1} end time must be after start time.`);
      }
    }

    if (
      id &&
      workerId &&
      workerIds.has(workerId) &&
      isIsoDate(date) &&
      startResult?.isValid &&
      endResult?.isValid &&
      shiftType &&
      SHIFT_TYPE_PRESETS[shiftType] &&
      label &&
      !seenIds.has(id)
    ) {
      shifts.push(normalizeShift({
        ...shift,
        id,
        workerId,
        date,
        startTime: startResult.value,
        endTime: endResult.value,
        shiftType,
        label,
        notes: String(shift.notes ?? ""),
        color: String(shift.color ?? ""),
      }, settings));
      seenIds.add(id);
    }
  });

  return shifts;
}

function normalizeDeskCoverageItems(value, settings, errors) {
  if (!Array.isArray(value)) {
    errors.push("data.deskCoverage must be an array when provided.");
    return [];
  }

  const items = [];
  const seenIds = new Set();

  value.forEach((coverage, index) => {
    if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) {
      errors.push(`Desk coverage ${index + 1} must be an object.`);
      return;
    }

    const id = String(coverage.id ?? "").trim();
    const date = String(coverage.date ?? "").trim();
    const startTime = String(coverage.startTime ?? coverage.start ?? "").trim();
    const endTime = String(coverage.endTime ?? coverage.end ?? "").trim();

    if (!id) {
      errors.push(`Desk coverage ${index + 1} is missing an id.`);
    } else if (seenIds.has(id)) {
      errors.push(`Desk coverage id "${id}" is duplicated.`);
    }

    if (!isIsoDate(date)) {
      errors.push(`Desk coverage ${id || index + 1} has an invalid date.`);
    }

    if (!startTime) {
      errors.push(`Desk coverage ${id || index + 1} is missing a start time.`);
    }

    if (!endTime) {
      errors.push(`Desk coverage ${id || index + 1} is missing an end time.`);
    }

    const startResult = startTime ? normalizeScheduleTimeInput(startTime, settings) : null;
    const endResult = endTime ? normalizeScheduleTimeInput(endTime, settings) : null;

    if (startResult && !startResult.isValid) {
      errors.push(`Desk coverage ${id || index + 1} start time: ${startResult.error}`);
    }

    if (endResult && !endResult.isValid) {
      errors.push(`Desk coverage ${id || index + 1} end time: ${endResult.error}`);
    }

    if (startResult?.isValid && endResult?.isValid) {
      const start = timeToDisplayMinutes(startResult.value, settings);
      const end = timeToDisplayMinutes(endResult.value, settings);

      if (end <= start) {
        errors.push(`Desk coverage ${id || index + 1} end time must be after start time.`);
      }
    }

    if (
      id &&
      !seenIds.has(id) &&
      isIsoDate(date) &&
      startResult?.isValid &&
      endResult?.isValid
    ) {
      items.push(normalizeDeskCoverage({
        ...coverage,
        id,
        date,
        startTime: startResult.value,
        endTime: endResult.value,
        label: String(coverage.label ?? "D"),
        notes: String(coverage.notes ?? ""),
        color: String(coverage.color ?? ""),
      }, settings));
      seenIds.add(id);
    }
  });

  return items;
}

function normalizeOnCallAssignments(value, workerIds, errors) {
  if (!Array.isArray(value)) {
    errors.push("data.onCallAssignments must be an array when provided.");
    return [];
  }

  const assignments = [];
  const seenDates = new Set();

  value.forEach((assignment, index) => {
    if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) {
      errors.push(`Nightly on-call assignment ${index + 1} must be an object.`);
      return;
    }

    const date = String(assignment.date ?? "").trim();
    const primaryWorkerId = String(assignment.primaryWorkerId ?? "").trim();
    const backupWorkerId = String(assignment.backupWorkerId ?? "").trim();

    if (!isIsoDate(date)) {
      errors.push(`Nightly on-call assignment ${index + 1} has an invalid date.`);
      return;
    }

    if (seenDates.has(date)) {
      errors.push(`Nightly on-call assignment for ${date} is duplicated.`);
      return;
    }

    if (primaryWorkerId && !workerIds.has(primaryWorkerId)) {
      errors.push(`Nightly on-call assignment for ${date} references unknown primary worker "${primaryWorkerId}".`);
    }

    if (backupWorkerId && !workerIds.has(backupWorkerId)) {
      errors.push(`Nightly on-call assignment for ${date} references unknown backup worker "${backupWorkerId}".`);
    }

    assignments.push({
      date,
      primaryWorkerId,
      backupWorkerId,
    });
    seenDates.add(date);
  });

  return assignments;
}

function normalizeWeekStartDate(value, settings, warnings) {
  if (isIsoDate(value)) {
    return getWeekStartDate(value, settings.weekStartsOn);
  }

  warnings.push("Current week start was missing or invalid, so the current week is shown.");
  return getWeekStartDate(getTodayIsoDate(), settings.weekStartsOn);
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isClockTime(value) {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return false;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function normalizeSettingsForExport(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rawShiftColors = raw.shiftColors && typeof raw.shiftColors === "object" && !Array.isArray(raw.shiftColors)
    ? raw.shiftColors
    : {};

  const settings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    shiftColors: {
      ...DEFAULT_SETTINGS.shiftColors,
      ...rawShiftColors,
    },
  };

  if (!Object.prototype.hasOwnProperty.call(rawShiftColors, "Checkout/Project")) {
    settings.shiftColors["Checkout/Project"] = settings.shiftColors["Check Out"];
  }

  return settings;
}

function isPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function isNonNegativeNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function invalid(errors) {
  return {
    isValid: false,
    errors: Array.isArray(errors) ? errors : [errors],
    schedule: null,
  };
}
