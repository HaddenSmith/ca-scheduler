import { DEFAULT_SETTINGS, SHIFT_KIND_DEFAULTS, SHIFT_TYPE_PRESETS } from "./model.js";

const workers = [
  { id: "atticus", name: "Atticus" },
  { id: "emma-w", name: "Emma W" },
  { id: "hadden", name: "Hadden" },
  { id: "kaylee", name: "Kaylee" },
  { id: "aaron", name: "Aaron" },
  { id: "sarah", name: "Sarah" },
  { id: "tanner", name: "Tanner" },
  { id: "jane", name: "Jane" },
];

function shift(id, workerId, date, startTime, endTime, label, notes = "") {
  const shiftType = inferSampleShiftType(label);
  const roveType = shiftType === "Roving" ? normalizeSampleRoveType(label) : "";
  const displayLabel = roveType || label;
  const defaults = SHIFT_KIND_DEFAULTS[label] ?? {
    name: SHIFT_TYPE_PRESETS[shiftType]?.name ?? label,
    color: SHIFT_TYPE_PRESETS[shiftType]?.color ?? "#7aa7ff",
    countsTowardHours: true,
  };

  return {
    id,
    workerId,
    date,
    startTime,
    endTime,
    name: defaults.name,
    shiftType,
    roveType,
    label: displayLabel,
    notes,
    color: defaults.color,
    countsTowardHours: defaults.countsTowardHours,
    alsoOnCall: false,
    alsoBackupOnCall: false,
  };
}

function inferSampleShiftType(label) {
  if (label === "R3" || label.startsWith("R-") || label === "CSA") {
    return "Roving";
  }

  if (label === "CO") {
    return "Check Out";
  }

  if (label === "OFF") {
    return "OFF";
  }

  if (SHIFT_TYPE_PRESETS[label]) {
    return label;
  }

  return "Other";
}

function normalizeSampleRoveType(label) {
  if (label === "R3") {
    return "R-3";
  }

  return label;
}

export const sampleSchedule = {
  settings: {
    ...DEFAULT_SETTINGS,
    shiftColors: { ...DEFAULT_SETTINGS.shiftColors },
  },
  weekStartDate: "2026-07-04",
  workers,
  onCallAssignments: [
    { date: "2026-07-04", primaryWorkerId: "atticus", backupWorkerId: "emma-w", notes: "" },
    { date: "2026-07-05", primaryWorkerId: "kaylee", backupWorkerId: "sarah", notes: "" },
    { date: "2026-07-06", primaryWorkerId: "tanner", backupWorkerId: "jane", notes: "" },
    { date: "2026-07-07", primaryWorkerId: "hadden", backupWorkerId: "aaron", notes: "" },
    { date: "2026-07-08", primaryWorkerId: "sarah", backupWorkerId: "tanner", notes: "" },
    { date: "2026-07-09", primaryWorkerId: "emma-w", backupWorkerId: "kaylee", notes: "" },
    { date: "2026-07-10", primaryWorkerId: "jane", backupWorkerId: "atticus", notes: "" },
  ],
  shifts: [
    shift("s-001", "atticus", "2026-07-04", "08:00", "10:15", "R3"),
    shift("s-002", "emma-w", "2026-07-04", "08:00", "12:00", "R3"),
    shift("s-003", "hadden", "2026-07-04", "10:00", "13:00", "CO"),
    shift("s-004", "kaylee", "2026-07-04", "12:30", "15:15", "Desk"),
    shift("s-005", "sarah", "2026-07-04", "09:00", "13:30", "CO"),
    shift("s-006", "tanner", "2026-07-04", "17:00", "21:30", "R3"),
    shift("s-007", "jane", "2026-07-04", "21:30", "01:00", "Desk"),

    shift("s-008", "atticus", "2026-07-05", "16:00", "20:15", "Desk"),
    shift("s-009", "emma-w", "2026-07-05", "17:30", "21:15", "Desk"),
    shift("s-010", "hadden", "2026-07-05", "12:30", "16:15", "Desk"),
    shift("s-011", "kaylee", "2026-07-05", "09:45", "12:00", "Desk"),
    shift("s-012", "aaron", "2026-07-05", "07:00", "01:00", "OFF"),
    shift("s-013", "sarah", "2026-07-05", "07:00", "10:00", "Desk"),

    shift("s-014", "atticus", "2026-07-06", "09:00", "10:00", "Class"),
    shift("s-015", "emma-w", "2026-07-06", "09:00", "12:00", "Check In"),
    shift("s-016", "hadden", "2026-07-06", "11:00", "14:00", "R3"),
    shift("s-017", "hadden", "2026-07-06", "12:00", "16:30", "CO"),
    shift("s-018", "kaylee", "2026-07-06", "14:30", "17:30", "Desk"),
    shift("s-019", "aaron", "2026-07-06", "09:30", "12:30", "Check In"),
    shift("s-020", "sarah", "2026-07-06", "11:00", "15:00", "R3"),
    shift("s-021", "tanner", "2026-07-06", "17:00", "21:00", "CO"),
    shift("s-022", "jane", "2026-07-06", "10:30", "13:15", "Check In"),

    shift("s-023", "atticus", "2026-07-07", "07:00", "08:00", "Class"),
    shift("s-024", "emma-w", "2026-07-07", "08:30", "09:30", "R3"),
    shift("s-025", "hadden", "2026-07-07", "09:15", "11:15", "Desk"),
    shift("s-026", "kaylee", "2026-07-07", "10:00", "12:30", "CO"),
    shift("s-027", "aaron", "2026-07-07", "13:00", "16:30", "Projects"),
    shift("s-028", "sarah", "2026-07-07", "13:00", "16:30", "Projects"),
    shift("s-029", "tanner", "2026-07-07", "14:00", "16:00", "Projects"),
    shift("s-030", "jane", "2026-07-07", "20:00", "23:30", "R3"),

    shift("s-031", "atticus", "2026-07-08", "07:00", "01:00", "OFF"),
    shift("s-032", "emma-w", "2026-07-08", "07:00", "01:00", "OFF"),
    shift("s-033", "hadden", "2026-07-08", "07:00", "01:00", "OFF"),
    shift("s-034", "sarah", "2026-07-08", "15:30", "18:45", "Desk"),
    shift("s-035", "tanner", "2026-07-08", "08:30", "12:30", "R3"),
    shift("s-036", "jane", "2026-07-08", "13:00", "17:00", "CO"),

    shift("s-037", "atticus", "2026-07-09", "09:00", "10:00", "Class"),
    shift("s-038", "emma-w", "2026-07-09", "10:00", "13:30", "CO"),
    shift("s-039", "hadden", "2026-07-09", "09:30", "11:30", "R3"),
    shift("s-040", "kaylee", "2026-07-09", "11:00", "14:30", "Desk"),
    shift("s-041", "aaron", "2026-07-09", "15:30", "20:00", "R3"),
    shift("s-042", "sarah", "2026-07-09", "16:00", "18:45", "R3"),
    shift("s-043", "tanner", "2026-07-09", "19:00", "22:00", "CO"),
    shift("s-044", "jane", "2026-07-09", "13:30", "17:00", "CO"),

    shift("s-045", "atticus", "2026-07-10", "09:00", "10:00", "Class"),
    shift("s-046", "emma-w", "2026-07-10", "10:00", "13:00", "CO"),
    shift("s-047", "hadden", "2026-07-10", "10:00", "13:00", "CO"),
    shift("s-048", "kaylee", "2026-07-10", "13:30", "16:00", "Projects"),
    shift("s-049", "aaron", "2026-07-10", "13:30", "16:00", "Projects"),
    shift("s-050", "sarah", "2026-07-10", "16:00", "18:30", "R3"),
    shift("s-051", "tanner", "2026-07-10", "19:30", "22:00", "Desk"),
    shift("s-052", "jane", "2026-07-10", "21:00", "00:30", "CO"),
  ],
};
