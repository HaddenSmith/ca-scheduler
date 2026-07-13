import { DEFAULT_SETTINGS } from "../src/model.js";

export function makeWorker(id = "worker-1", name = "Alex") {
  return { id, name };
}

export function makeShift(overrides = {}) {
  return {
    id: "shift-1",
    workerId: "worker-1",
    date: "2026-07-11",
    startTime: "09:00",
    endTime: "10:00",
    name: "Desk",
    shiftType: "Desk",
    roveSubtype: "",
    roveSubtypes: [],
    label: "Desk",
    notes: "",
    color: "#2bcaca",
    countsTowardHours: true,
    alsoOnCall: false,
    alsoBackupOnCall: false,
    ...overrides,
  };
}

export function makeSchedule(overrides = {}) {
  return {
    workers: [makeWorker()],
    shifts: [],
    deskCoverage: [],
    onCallAssignments: [],
    settings: {
      ...DEFAULT_SETTINGS,
      shiftColors: { ...DEFAULT_SETTINGS.shiftColors },
    },
    weekStartDate: "2026-07-11",
    ...overrides,
  };
}
