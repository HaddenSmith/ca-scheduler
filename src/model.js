/**
 * @typedef {Object} Worker
 * @property {string} id
 * @property {string} name
 * @property {string=} role
 */

/**
 * @typedef {Object} Shift
 * @property {string} id
 * @property {string} workerId
 * @property {string} date ISO date in YYYY-MM-DD format.
 * @property {string} startTime HH:mm, local schedule time.
 * @property {string} endTime HH:mm, local schedule time. Values before startTime are treated as next-day times.
 * @property {string} name
 * @property {string=} shiftType
 * @property {string[]=} roveSubtypes
 * @property {string=} roveType Backward-compatible first roving subtype.
 * @property {string} label
 * @property {string} notes
 * @property {string} color
 * @property {boolean} countsTowardHours
 * @property {boolean=} alsoOnCall Primary phone coverage during this shift's time range.
 * @property {boolean=} alsoBackupOnCall Backup phone coverage during this shift's time range.
 * @property {string=} seriesId Future grouping id for recurring or duplicated shifts.
 * @property {string=} recurrenceRule Future recurrence rule metadata, if this shift becomes part of a recurring series.
 * @property {string=} duplicatedFromShiftId Future provenance for manually duplicated shifts.
 */

/**
 * @typedef {Object} OnCallAssignment Nightly on-call assignment for one date.
 * @property {string} date ISO date in YYYY-MM-DD format.
 * @property {string} primaryWorkerId
 * @property {string} backupWorkerId
 * @property {string} notes
 */

/**
 * @typedef {Object} ScheduleSettings
 * @property {string} startTime
 * @property {string} endTime
 * @property {number} slotMinutes
 * @property {number} weekStartsOn 0 Sunday, 6 Saturday.
 * @property {boolean} longShiftWarningEnabled
 * @property {number} maxConsecutiveWorkHours
 * @property {number} requiredBreakMinutes
 * @property {boolean} lateNightWarningEnabled
 * @property {string} lateNightThreshold
 * @property {string} earlyMorningThreshold
 */

export const DEFAULT_SETTINGS = {
  startTime: "07:00",
  endTime: "01:00",
  slotMinutes: 15,
  weekStartsOn: 6,
  longShiftWarningEnabled: true,
  maxConsecutiveWorkHours: 5,
  requiredBreakMinutes: 30,
  lateNightWarningEnabled: true,
  lateNightThreshold: "23:00",
  earlyMorningThreshold: "08:00",
  shiftColors: {
    "Check In": "#91cf50",
    "Check Out": "#fed866",
    Roving: "#b52c43",
    Projects: "#c964fb",
    "Staff Meeting": "#c964fb",
    Desk: "#2bcaca",
    Class: "#a6a6a6",
    "On Call": "#c56829",
    "Backup On Call": "#c56829",
    OFF: "#a6a6a6",
    Other: "#7aa7ff",
  },
};

export const DEFAULT_SHIFT_COLORS = DEFAULT_SETTINGS.shiftColors;

export const EDITABLE_SHIFT_COLOR_KEYS = [
  "Check In",
  "Check Out",
  "Roving",
  "Projects",
  "Staff Meeting",
  "Desk",
  "Class",
  "On Call",
  "OFF",
];

export const WEEK_DAYS = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

export const ROVING_SUBTYPES = [
  "R-1",
  "R-2",
  "R-3",
  "R-4",
  "R-5",
  "R-6",
  "R-7",
  "R-8",
  "R-9",
  "R-10",
  "R-B",
  "R-J",
  "CSA",
];

export const ROVING_SUBTYPE_NOTES = {
  "R-1": "Check-In Roving. Rove around Helaman to assist with check-ins. You will field many calls and assist guests with finding the correct buildings. Stay with your roving partner due to the Minor Protection Policy. You will also pick up everyone's sack lunches from the Cannon Commons and deliver them to HAs and CAs doing check-ins in the buildings.",
  "R-2": "Check-In Assistance at the Front Desk. Stay at the front desk and assist with counselor check-ins and guest questions.",
  "R-3": "General Mealtime Rove. Rove around the inside and outside of the Cannon Center to ensure guests are safe and that doors are not being blocked. If campers leave bags blocking the mailroom door, ask campers to move them or move them yourself. Rove around the outdoor area to assist lost or locked-out guests.",
  "R-4": "Set Up Laundry. Set up wire racks with bags, and put up laundry signs in the lobby and hallways.",
  "R-5": "Monitor Laundry. Check laundry hampers as they get full, sort laundry, and replace bags as needed.",
  "R-6": "Take Down Laundry. Complete sorting, take down the racks, and return signs, including hallway signs, to the office.",
  "R-7": "Towel Exchange. Set up tables in the lobby and put fresh towels on the tables.",
  "R-8": "Check Toilet Paper.",
  "R-9": "Sign Take Down.",
  "R-10": "Ask an HA or Manager.",
  "R-B": "Student building RA rove in Hinckley. Do an opening rove of both student buildings with the person working in the other building. Do a closing rove of both buildings with the person of the same gender assigned to CSA. When visiting hours end, ensure that those of the opposite sex are out of the building. Carry the building phone overnight and return it to the building office in the morning by 10:00 AM.",
  "R-J": "Student building RA rove in Building 9. Do an opening rove of both student buildings with the person working in the other building. Do a closing rove of both buildings with the person of the same gender assigned to CSA. When visiting hours end, ensure that those of the opposite sex are out of the building. Carry the building phone overnight and return it to the building office in the morning by 10:00 AM.",
  CSA: "Area-wide security rove. Ensure all doors are locked. Make notes of problems such as broken lights or sprinklers. Count out the desk attendant at 11:45 PM. You will be on-call until the following morning.",
};

export const SHIFT_TYPE_PRESETS = {
  "Check In": {
    name: "Check In",
    label: "Check In",
    color: DEFAULT_SHIFT_COLORS["Check In"],
    countsTowardHours: true,
  },
  "Check Out": {
    name: "Check Out",
    label: "Check Out",
    color: DEFAULT_SHIFT_COLORS["Check Out"],
    countsTowardHours: true,
  },
  Roving: {
    name: "Roving",
    label: "R-3",
    color: DEFAULT_SHIFT_COLORS.Roving,
    countsTowardHours: true,
  },
  Projects: {
    name: "Projects",
    label: "Projects",
    color: DEFAULT_SHIFT_COLORS.Projects,
    countsTowardHours: true,
  },
  "Staff Meeting": {
    name: "Staff Meeting",
    label: "Staff Meeting",
    color: DEFAULT_SHIFT_COLORS["Staff Meeting"],
    countsTowardHours: true,
  },
  Desk: {
    name: "Desk",
    label: "Desk",
    color: DEFAULT_SHIFT_COLORS.Desk,
    countsTowardHours: true,
  },
  Class: {
    name: "Class",
    label: "Class",
    color: DEFAULT_SHIFT_COLORS.Class,
    countsTowardHours: false,
  },
  "On Call": {
    name: "On Call",
    label: "On Call",
    color: DEFAULT_SHIFT_COLORS["On Call"],
    countsTowardHours: false,
  },
  "Backup On Call": {
    name: "Backup On Call",
    label: "Backup On Call",
    color: DEFAULT_SHIFT_COLORS["Backup On Call"],
    countsTowardHours: false,
  },
  OFF: {
    name: "Off",
    label: "OFF",
    color: DEFAULT_SHIFT_COLORS.OFF,
    countsTowardHours: false,
  },
  Other: {
    name: "Other",
    label: "Other",
    color: DEFAULT_SHIFT_COLORS.Other,
    countsTowardHours: true,
  },
};

export const SHIFT_KIND_DEFAULTS = {
  R3: {
    name: "Roving",
    color: DEFAULT_SHIFT_COLORS.Roving,
    countsTowardHours: true,
  },
  CO: {
    name: "Check Out",
    color: DEFAULT_SHIFT_COLORS["Check Out"],
    countsTowardHours: true,
  },
  "Check In": {
    name: "Check In",
    color: DEFAULT_SHIFT_COLORS["Check In"],
    countsTowardHours: true,
  },
  "Check Out": {
    name: "Check Out",
    color: DEFAULT_SHIFT_COLORS["Check Out"],
    countsTowardHours: true,
  },
  Roving: {
    name: "Roving",
    color: DEFAULT_SHIFT_COLORS.Roving,
    countsTowardHours: true,
  },
  Projects: {
    name: "Projects",
    color: DEFAULT_SHIFT_COLORS.Projects,
    countsTowardHours: true,
  },
  "Staff Meeting": {
    name: "Staff Meeting",
    color: DEFAULT_SHIFT_COLORS["Staff Meeting"],
    countsTowardHours: true,
  },
  Desk: {
    name: "Desk",
    color: DEFAULT_SHIFT_COLORS.Desk,
    countsTowardHours: true,
  },
  Class: {
    name: "Class",
    color: DEFAULT_SHIFT_COLORS.Class,
    countsTowardHours: false,
  },
  "On Call": {
    name: "On Call",
    color: DEFAULT_SHIFT_COLORS["On Call"],
    countsTowardHours: false,
  },
  "Backup On Call": {
    name: "Backup On Call",
    color: DEFAULT_SHIFT_COLORS["Backup On Call"],
    countsTowardHours: false,
  },
  OFF: {
    name: "Off",
    color: DEFAULT_SHIFT_COLORS.OFF,
    countsTowardHours: false,
  },
};

export function getDefaultShiftColor(shiftType, settings = {}) {
  return (
    settings.shiftColors?.[shiftType] ??
    DEFAULT_SHIFT_COLORS[shiftType] ??
    DEFAULT_SHIFT_COLORS.Other
  );
}
