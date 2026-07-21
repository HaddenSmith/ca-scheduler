import {
  SHIFT_TYPE_PRESETS,
  getDefaultDeskCoverageColor,
  getDefaultShiftColor,
} from "./model.js";
import {
  buildRovingNotes,
  formatRoveSubtypesLabel,
  getRovingDefaultTimes,
  getPrimaryRoveSubtype,
  isRovingAutoLabel,
  normalizeRoveSubtype,
  normalizeRoveSubtypes,
} from "./rovingUtils.js";

export function createDefaultShift(schedule, defaults = {}) {
  const shiftType = defaults.shiftType ?? "Desk";
  const preset = getShiftTypePreset(shiftType, schedule.settings);
  const roveSubtypes = shiftType === "Roving"
    ? normalizeRoveSubtypes(defaults.roveSubtypes ?? defaults.roveType ?? "R-3")
    : [];
  const roveType = getPrimaryRoveSubtype(roveSubtypes);
  const date = defaults.date ?? schedule.weekStartDate;
  const roveDefaultTimes = shiftType === "Roving"
    ? getRovingDefaultTimes(roveSubtypes, date)
    : null;

  return normalizeShift({
    id: createShiftId(),
    workerId: defaults.workerId ?? schedule.workers[0]?.id ?? "",
    date,
    startTime: defaults.startTime ?? roveDefaultTimes?.startTime ?? (shiftType === "OFF" ? schedule.settings.startTime : "09:00"),
    endTime: defaults.endTime ?? roveDefaultTimes?.endTime ?? (shiftType === "OFF" ? schedule.settings.endTime : "10:00"),
    shiftType,
    name: preset.name,
    roveSubtypes,
    roveType,
    label: roveType || preset.label,
    notes: "",
    color: preset.color,
    countsTowardHours: preset.countsTowardHours,
    alsoOnCall: false,
    alsoBackupOnCall: false,
  }, schedule.settings);
}

export function addShift(schedule, shift) {
  return {
    ...schedule,
    shifts: [...schedule.shifts, normalizeShift(shift, schedule.settings)],
  };
}

export function addShifts(schedule, shifts) {
  if (!shifts.length) {
    return schedule;
  }

  return {
    ...schedule,
    shifts: [
      ...schedule.shifts,
      ...shifts.map((shift) => normalizeShift(shift, schedule.settings)),
    ],
  };
}

export function copyShift(schedule, shift, overrides = {}) {
  const {
    duplicatedFromShiftId,
    recurrenceRule,
    seriesId,
    ...copyableShift
  } = shift;

  return normalizeShift({
    ...copyableShift,
    ...overrides,
    id: createShiftId(),
  }, schedule.settings);
}

export function updateShift(schedule, updatedShift) {
  return {
    ...schedule,
    shifts: schedule.shifts.map((shift) => {
      if (shift.id !== updatedShift.id) {
        return shift;
      }

      return normalizeShift(updatedShift, schedule.settings);
    }),
  };
}

export function deleteShift(schedule, shiftId) {
  return {
    ...schedule,
    shifts: schedule.shifts.filter((shift) => shift.id !== shiftId),
  };
}

export function createDefaultDeskCoverage(schedule, defaults = {}) {
  return normalizeDeskCoverage({
    id: createDeskCoverageId(),
    date: defaults.date ?? schedule.weekStartDate,
    startTime: defaults.startTime ?? "09:00",
    endTime: defaults.endTime ?? "09:30",
    label: defaults.label ?? "D",
    notes: defaults.notes ?? "",
    color: defaults.color ?? getDefaultDeskCoverageColor(schedule.settings),
  }, schedule.settings);
}

export function addDeskCoverage(schedule, coverage) {
  return {
    ...schedule,
    deskCoverage: [
      ...(schedule.deskCoverage ?? []),
      normalizeDeskCoverage(coverage, schedule.settings),
    ],
  };
}

export function addDeskCoverageItems(schedule, coverageItems) {
  if (!coverageItems.length) {
    return schedule;
  }

  return {
    ...schedule,
    deskCoverage: [
      ...(schedule.deskCoverage ?? []),
      ...coverageItems.map((coverage) => normalizeDeskCoverage(coverage, schedule.settings)),
    ],
  };
}

export function copyDeskCoverage(schedule, coverage, overrides = {}) {
  return normalizeDeskCoverage({
    ...coverage,
    ...overrides,
    id: createDeskCoverageId(),
  }, schedule.settings);
}

export function updateDeskCoverage(schedule, coverage) {
  return {
    ...schedule,
    deskCoverage: (schedule.deskCoverage ?? []).map((item) => {
      if (item.id !== coverage.id) {
        return item;
      }

      return normalizeDeskCoverage(coverage, schedule.settings);
    }),
  };
}

export function deleteDeskCoverage(schedule, coverageId) {
  return {
    ...schedule,
    deskCoverage: (schedule.deskCoverage ?? []).filter((item) => item.id !== coverageId),
  };
}

export function normalizeShift(shift, settings = {}) {
  const shiftType = inferShiftType(shift);
  const preset = getShiftTypePreset(shiftType, settings);
  let roveSubtypes = shiftType === "Roving"
    ? normalizeRoveSubtypes(
        shift.roveSubtypes ?? shift.roveSubtype ?? shift.roveType,
        shift.label,
      )
    : [];

  if (shiftType === "Roving" && roveSubtypes.length === 0) {
    roveSubtypes = ["R-3"];
  }

  const roveType = getPrimaryRoveSubtype(roveSubtypes);
  const label = getNormalizedLabel(shift, shiftType, roveSubtypes, preset);
  const notes = getNormalizedNotes(shift, shiftType, roveSubtypes);
  const isOff = shiftType === "OFF";
  const isPhoneOnly = shiftType === "On Call" || shiftType === "Backup On Call";

  return {
    ...shift,
    shiftType,
    roveSubtypes,
    roveType,
    name: shiftType === "Other" ? label || preset.name : preset.name,
    label,
    notes,
    color: shift.color || preset.color,
    startTime: isOff ? settings.startTime ?? shift.startTime : shift.startTime,
    endTime: isOff ? settings.endTime ?? shift.endTime : shift.endTime,
    countsTowardHours: isOff || isPhoneOnly
      ? false
      : Boolean(shift.countsTowardHours ?? preset.countsTowardHours),
    alsoOnCall: Boolean(shift.alsoOnCall),
    alsoBackupOnCall: Boolean(shift.alsoBackupOnCall),
  };
}

export function normalizeDeskCoverage(coverage, settings = {}) {
  const startTime = coverage.startTime ?? coverage.start ?? settings.startTime ?? "07:00";
  const endTime = coverage.endTime ?? coverage.end ?? settings.endTime ?? "02:00";

  return {
    id: coverage.id || createDeskCoverageId(),
    date: coverage.date,
    startTime,
    endTime,
    label: coverage.label?.trim() || "D",
    notes: coverage.notes?.trim() ?? "",
    color: coverage.color || getDefaultDeskCoverageColor(settings),
  };
}

export function applyColorDefaultChanges(schedule, oldSettings, newSettings) {
  return {
    ...schedule,
    shifts: schedule.shifts.map((shift) => {
      const oldDefault = getDefaultShiftColor(shift.shiftType, oldSettings);
      const newDefault = getDefaultShiftColor(shift.shiftType, newSettings);

      if (!colorsMatch(oldDefault, newDefault) && colorsMatch(shift.color, oldDefault)) {
        return {
          ...shift,
          color: newDefault,
        };
      }

      return shift;
    }),
    deskCoverage: (schedule.deskCoverage ?? []).map((coverage) => {
      const oldDefault = getDefaultDeskCoverageColor(oldSettings);
      const newDefault = getDefaultDeskCoverageColor(newSettings);

      if (!colorsMatch(oldDefault, newDefault) && colorsMatch(coverage.color, oldDefault)) {
        return {
          ...coverage,
          color: newDefault,
        };
      }

      return coverage;
    }),
  };
}

export function inferShiftType(shift) {
  if (shift.shiftType && SHIFT_TYPE_PRESETS[shift.shiftType]) {
    return shift.shiftType;
  }

  const label = shift.label?.trim().toLowerCase();
  const name = shift.name?.trim().toLowerCase();

  if (label === "off" || name === "off") {
    return "OFF";
  }

  if (isRovingLabel(label) || name === "roving") {
    return "Roving";
  }

  if (label === "co" || name === "check out") {
    return "Check Out";
  }

  if (
    label === "co/p" ||
    label === "checkout/project" ||
    label === "checkout project" ||
    name === "checkout/project" ||
    name === "checkout project"
  ) {
    return "Checkout/Project";
  }

  if (label === "check in" || name === "check in") {
    return "Check In";
  }

  if (label === "projects" || name === "projects") {
    return "Projects";
  }

  if (label === "staff meeting" || name === "staff meeting") {
    return "Staff Meeting";
  }

  if (label === "desk" || name === "desk") {
    return "Desk";
  }

  if (label === "class" || name === "class") {
    return "Class";
  }

  if (label === "on call" || label === "oc" || name === "on call") {
    return "On Call";
  }

  if (
    label === "backup on call" ||
    label === "backup oc" ||
    label === "boc" ||
    name === "backup on call"
  ) {
    return "Backup On Call";
  }

  return "Other";
}

export function getShiftTypePreset(shiftType, settings = {}) {
  const preset = SHIFT_TYPE_PRESETS[shiftType] ?? SHIFT_TYPE_PRESETS.Other;

  return {
    ...preset,
    color: getDefaultShiftColor(shiftType, settings),
  };
}

export function addWorker(schedule, name) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { schedule, worker: null };
  }

  const worker = {
    id: createWorkerId(trimmedName, schedule.workers),
    name: trimmedName,
  };

  return {
    schedule: {
      ...schedule,
      workers: [...schedule.workers, worker],
    },
    worker,
  };
}

export function renameWorker(schedule, workerId, name) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return schedule;
  }

  return {
    ...schedule,
    workers: schedule.workers.map((worker) => {
      if (worker.id !== workerId) {
        return worker;
      }

      return { ...worker, name: trimmedName };
    }),
  };
}

export function reorderWorker(schedule, workerId, targetWorkerId, position = "before") {
  if (workerId === targetWorkerId) {
    return schedule;
  }

  const workers = [...schedule.workers];
  const fromIndex = workers.findIndex((worker) => worker.id === workerId);
  const targetIndex = workers.findIndex((worker) => worker.id === targetWorkerId);

  if (fromIndex === -1 || targetIndex === -1) {
    return schedule;
  }

  const [movedWorker] = workers.splice(fromIndex, 1);
  const updatedTargetIndex = workers.findIndex((worker) => worker.id === targetWorkerId);
  const insertIndex = position === "after" ? updatedTargetIndex + 1 : updatedTargetIndex;

  workers.splice(insertIndex, 0, movedWorker);

  return {
    ...schedule,
    workers,
  };
}

export function removeWorker(schedule, workerId) {
  if (schedule.shifts.some((shift) => shift.workerId === workerId)) {
    return {
      removed: false,
      schedule,
      error: "This worker has shifts. Reassign or delete those shifts before removing the worker.",
    };
  }

  return {
    removed: true,
    schedule: {
      ...schedule,
      workers: schedule.workers.filter((worker) => worker.id !== workerId),
      onCallAssignments: (schedule.onCallAssignments ?? []).map((assignment) => ({
        ...assignment,
        primaryWorkerId: assignment.primaryWorkerId === workerId ? "" : assignment.primaryWorkerId,
        backupWorkerId: assignment.backupWorkerId === workerId ? "" : assignment.backupWorkerId,
      })),
    },
    error: "",
  };
}

export function getOnCallAssignment(schedule, date) {
  return (
    (schedule.onCallAssignments ?? []).find((assignment) => assignment.date === date) ??
    createDefaultOnCallAssignment(date)
  );
}

export function updateOnCallAssignment(schedule, assignment) {
  const normalizedAssignment = {
    date: assignment.date,
    primaryWorkerId: assignment.primaryWorkerId ?? "",
    backupWorkerId: assignment.backupWorkerId ?? "",
  };
  const hasExisting = (schedule.onCallAssignments ?? []).some((item) => {
    return item.date === normalizedAssignment.date;
  });

  return {
    ...schedule,
    onCallAssignments: hasExisting
      ? schedule.onCallAssignments.map((item) => {
          if (item.date !== normalizedAssignment.date) {
            return item;
          }

          return normalizedAssignment;
        })
      : [...(schedule.onCallAssignments ?? []), normalizedAssignment],
  };
}

export function createDefaultOnCallAssignment(date) {
  return {
    date,
    primaryWorkerId: "",
    backupWorkerId: "",
  };
}

export function shiftHasPhoneCoverage(shift) {
  return Boolean(
    shift.alsoOnCall ||
    shift.alsoBackupOnCall ||
    shift.shiftType === "On Call" ||
    shift.shiftType === "Backup On Call",
  );
}

function getNormalizedLabel(shift, shiftType, roveSubtypes, preset) {
  if (shiftType === "OFF") {
    return "OFF";
  }

  if (shiftType === "Roving") {
    const label = shift.label?.trim() ?? "";
    const autoLabel = formatRoveSubtypesLabel(roveSubtypes) || preset.label;

    return !label || isRovingAutoLabel(label) ? autoLabel : label;
  }

  return shift.label?.trim() || preset.label || shiftType;
}

function getNormalizedNotes(shift, shiftType, roveSubtypes) {
  const notes = shift.notes?.trim() ?? "";

  if (notes || shiftType !== "Roving" || roveSubtypes.length === 0) {
    return notes;
  }

  return buildRovingNotes(roveSubtypes);
}

function isRovingLabel(value) {
  if (!value) {
    return false;
  }

  return normalizeRoveSubtype(value) !== "";
}

function createShiftId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `shift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDeskCoverageId() {
  if (globalThis.crypto?.randomUUID) {
    return `desk-${globalThis.crypto.randomUUID()}`;
  }

  return `desk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createWorkerId(name, workers) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "worker";
  let candidate = base;
  let suffix = 2;
  const existingIds = new Set(workers.map((worker) => worker.id));

  while (existingIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function colorsMatch(left, right) {
  return normalizeColor(left) === normalizeColor(right);
}

function normalizeColor(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}
