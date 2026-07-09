import {
  ROVING_SUBTYPE_NOTES,
  ROVING_SUBTYPES,
  SHIFT_TYPE_PRESETS,
  getDefaultShiftColor,
} from "./model.js";

export function createDefaultShift(schedule, defaults = {}) {
  const shiftType = defaults.shiftType ?? "Desk";
  const preset = getShiftTypePreset(shiftType, schedule.settings);
  const roveType = defaults.roveType ?? (shiftType === "Roving" ? "R-3" : "");

  return normalizeShift({
    id: createShiftId(),
    workerId: defaults.workerId ?? schedule.workers[0]?.id ?? "",
    date: defaults.date ?? schedule.weekStartDate,
    startTime: defaults.startTime ?? (shiftType === "OFF" ? schedule.settings.startTime : "09:00"),
    endTime: defaults.endTime ?? (shiftType === "OFF" ? schedule.settings.endTime : "10:00"),
    shiftType,
    name: preset.name,
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

export function normalizeShift(shift, settings = {}) {
  const shiftType = inferShiftType(shift);
  const preset = getShiftTypePreset(shiftType, settings);
  const roveType = shiftType === "Roving" ? normalizeRoveType(shift.roveType || shift.label) : "";
  const label = getNormalizedLabel(shift, shiftType, roveType, preset);
  const notes = getNormalizedNotes(shift, shiftType, roveType);
  const isOff = shiftType === "OFF";
  const isPhoneOnly = shiftType === "On Call" || shiftType === "Backup On Call";

  return {
    ...shift,
    shiftType,
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
    notes: assignment.notes?.trim() ?? "",
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
    notes: "",
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

function normalizeRoveType(value) {
  if (!value) {
    return "R-3";
  }

  const normalized = value.trim().toUpperCase().replace(/^R(\d+)$/, "R-$1");

  if (normalized === "R3") {
    return "R-3";
  }

  return ROVING_SUBTYPES.includes(normalized) ? normalized : "R-3";
}

function getNormalizedLabel(shift, shiftType, roveType, preset) {
  if (shiftType === "OFF") {
    return "OFF";
  }

  if (shiftType === "Roving") {
    return shift.label?.trim() || roveType;
  }

  return shift.label?.trim() || preset.label || shiftType;
}

function getNormalizedNotes(shift, shiftType, roveType) {
  const notes = shift.notes?.trim() ?? "";

  if (notes || shiftType !== "Roving" || !roveType) {
    return notes;
  }

  return ROVING_SUBTYPE_NOTES[roveType] ?? "";
}

function isRovingLabel(value) {
  if (!value) {
    return false;
  }

  return value === "r3" || /^r-\d+$/.test(value) || value === "r-b" || value === "r-j" || value === "csa";
}

function createShiftId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `shift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
