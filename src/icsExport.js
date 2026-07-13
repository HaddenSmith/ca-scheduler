import {
  addDays,
  buildWeekDates,
  formatWeekRange,
  getWeekStartDate,
} from "./dateUtils.js";
import { timeToMinutes } from "./timeUtils.js";

const CALENDAR_TIME_ZONE = "America/Denver";
const EXCLUDED_SHIFT_TYPES = new Set(["Class", "OFF", "Desk Coverage"]);
const PHONE_COVERAGE_TYPES = new Set(["On Call", "Backup On Call"]);
const REMINDER_START_TIME = "23:30";
const REMINDER_END_TIME = "23:45";

let dialogElements;
let activeSchedule;
let activeResolve;

export function openIcsExportDialog(schedule) {
  dialogElements = dialogElements ?? createDialogElements();

  if (activeResolve) {
    closeDialog({ action: "cancel" });
  }

  activeSchedule = schedule;
  populateDialog();
  dialogElements.backdrop.classList.remove("is-hidden");
  dialogElements.worker.focus();

  return new Promise((resolve) => {
    activeResolve = resolve;
  });
}

export function buildWorkerCalendar(schedule, options) {
  const weekStartDate = getWeekStartDate(
    options.weekDate || schedule.weekStartDate,
    schedule.settings.weekStartsOn,
  );
  const weekDates = new Set(buildWeekDates(weekStartDate).map((date) => date.isoDate));
  const worker = schedule.workers.find((item) => item.id === options.workerId);

  if (!worker) {
    throw new Error("Choose a worker before downloading the calendar file.");
  }

  const shifts = schedule.shifts.filter((shift) => {
    return shift.workerId === worker.id &&
      weekDates.has(shift.date) &&
      isShiftIncludedInCalendar(shift);
  });
  const reminders = options.includeNightlyReminder === false
    ? []
    : getNightlyPhoneReminders(schedule, worker.id, weekDates);
  const stamp = formatUtcTimestamp(options.now ?? new Date());
  const calendarLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Conference Assistant Scheduler//Worker Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(`${worker.name} CA Work Schedule`)}`,
    `X-WR-TIMEZONE:${CALENDAR_TIME_ZONE}`,
    ...buildTimeZoneLines(),
  ];

  for (const shift of shifts) {
    calendarLines.push(...buildEventLines(shift, worker, stamp));
  }

  for (const reminder of reminders) {
    calendarLines.push(...buildReminderEventLines(reminder, worker, stamp));
  }

  calendarLines.push("END:VCALENDAR");

  return {
    content: `${calendarLines.map(foldIcsLine).join("\r\n")}\r\n`,
    eventCount: shifts.length + reminders.length,
    fileName: `ca-work-schedule-${slugify(worker.name)}-${weekStartDate}.ics`,
    reminderEventCount: reminders.length,
    weekStartDate,
    workEventCount: shifts.length,
  };
}

export function downloadWorkerCalendar(schedule, options) {
  const calendar = buildWorkerCalendar(schedule, options);

  if (calendar.workEventCount === 0) {
    throw new Error("No work shifts were found for this worker during the selected week.");
  }

  const blob = new Blob([calendar.content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = calendar.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return calendar;
}

function createDialogElements() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop is-hidden";
  backdrop.innerHTML = `
    <section class="shift-editor compact-editor ics-export-dialog" role="dialog" aria-modal="true" aria-labelledby="ics-export-title">
      <header class="shift-editor-header">
        <div>
          <p class="eyebrow">Viewer Calendar</p>
          <h2 id="ics-export-title">Download Calendar File</h2>
        </div>
        <button type="button" class="icon-button" data-ics-action="cancel" aria-label="Close calendar download">x</button>
      </header>

      <form class="shift-editor-form" novalidate>
        <div class="form-errors" aria-live="polite" hidden></div>

        <label>
          <span>Worker</span>
          <select name="workerId" required></select>
        </label>

        <label>
          <span>Week of</span>
          <input name="weekDate" type="date" required />
        </label>
        <p class="field-help ics-week-range"></p>

        <label class="checkbox-row">
          <input name="includeNightlyReminder" type="checkbox" />
          <span>Include an 11:30 PM On Call/Backup On Call reminder, if applicable</span>
        </label>

        <p class="ics-snapshot-note">
          This downloads a snapshot .ics file. Import it into Google Calendar, Apple Calendar, Outlook, or another calendar app. It will not auto-update if the schedule changes later.
        </p>

        <footer class="shift-editor-actions align-end">
          <div>
            <button type="button" class="secondary-button" data-ics-action="cancel">Cancel</button>
            <button type="submit" class="primary-button">Download .ics</button>
          </div>
        </footer>
      </form>
    </section>
  `;

  const form = backdrop.querySelector("form");
  const weekDate = form.elements.weekDate;

  form.addEventListener("submit", handleSubmit);
  weekDate.addEventListener("change", updateWeekRange);

  for (const button of backdrop.querySelectorAll('[data-ics-action="cancel"]')) {
    button.addEventListener("click", () => closeDialog({ action: "cancel" }));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.classList.contains("is-hidden")) {
      closeDialog({ action: "cancel" });
    }
  });

  document.body.append(backdrop);

  return {
    backdrop,
    errors: backdrop.querySelector(".form-errors"),
    form,
    weekDate,
    weekRange: backdrop.querySelector(".ics-week-range"),
    worker: form.elements.workerId,
  };
}

function populateDialog() {
  dialogElements.errors.replaceChildren();
  dialogElements.errors.hidden = true;
  dialogElements.worker.replaceChildren();

  for (const worker of getCalendarWorkerOptions(activeSchedule)) {
    const option = document.createElement("option");
    option.value = worker.id;
    option.textContent = worker.name;
    dialogElements.worker.append(option);
  }

  dialogElements.weekDate.value = activeSchedule.weekStartDate;
  dialogElements.form.elements.includeNightlyReminder.checked = true;
  updateWeekRange();
}

function handleSubmit(event) {
  event.preventDefault();

  try {
    const calendar = downloadWorkerCalendar(activeSchedule, {
      workerId: dialogElements.worker.value,
      weekDate: dialogElements.weekDate.value,
      includeNightlyReminder: dialogElements.form.elements.includeNightlyReminder.checked,
    });

    closeDialog({
      action: "download",
      eventCount: calendar.eventCount,
      fileName: calendar.fileName,
    });
  } catch (error) {
    const message = document.createElement("p");
    message.textContent = error instanceof Error ? error.message : "Calendar download failed.";
    dialogElements.errors.replaceChildren(message);
    dialogElements.errors.hidden = false;
  }
}

function updateWeekRange() {
  const value = dialogElements.weekDate.value;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    dialogElements.weekRange.textContent = "";
    return;
  }

  const weekStartDate = getWeekStartDate(value, activeSchedule.settings.weekStartsOn);
  dialogElements.weekRange.textContent = `Downloads ${formatWeekRange(weekStartDate)}.`;
}

function closeDialog(result) {
  dialogElements.backdrop.classList.add("is-hidden");
  activeSchedule = null;

  const resolve = activeResolve;
  activeResolve = null;

  resolve?.(result);
}

function buildEventLines(shift, worker, stamp) {
  const endDate = timeToMinutes(shift.endTime) <= timeToMinutes(shift.startTime)
    ? addDays(shift.date, 1)
    : shift.date;
  const phoneCoverage = getPhoneCoverageLabels(shift);
  const summarySuffix = phoneCoverage.length && !["On Call", "Backup On Call"].includes(shift.shiftType)
    ? ` (${phoneCoverage.join(" + ")})`
    : "";
  const summary = `${shift.label || shift.shiftType || "Shift"}${summarySuffix}`;
  const descriptionParts = [];

  descriptionParts.push(`Worker: ${worker.name}`);
  descriptionParts.push(`Shift type: ${shift.shiftType || shift.name || "Other"}`);

  if (phoneCoverage.length) {
    descriptionParts.push(`Phone coverage: ${phoneCoverage.join(" and ")}`);
  }

  if (shift.notes?.trim()) {
    descriptionParts.push("", shift.notes.trim());
  }

  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(`${shift.id}@conference-assistant-scheduler`)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${CALENDAR_TIME_ZONE}:${formatLocalDateTime(shift.date, shift.startTime)}`,
    `DTEND;TZID=${CALENDAR_TIME_ZONE}:${formatLocalDateTime(endDate, shift.endTime)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
  ];

  if (descriptionParts.length) {
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`);
  }

  lines.push("END:VEVENT");
  return lines;
}

export function getCalendarWorkerOptions(schedule) {
  return (schedule.workers ?? []).map((worker) => ({
    id: worker.id,
    name: worker.name,
  }));
}

export function isShiftIncludedInCalendar(shift) {
  const shiftType = shift.shiftType;

  if (EXCLUDED_SHIFT_TYPES.has(shiftType)) {
    return false;
  }

  return shift.countsTowardHours === true ||
    shiftType === "Staff Meeting" ||
    PHONE_COVERAGE_TYPES.has(shiftType);
}

function getNightlyPhoneReminders(schedule, workerId, weekDates) {
  const reminders = new Map();

  for (const shift of schedule.shifts ?? []) {
    if (shift.workerId !== workerId || !weekDates.has(shift.date)) {
      continue;
    }

    if (shift.shiftType === "On Call" || shift.alsoOnCall === true) {
      addNightlyReminder(reminders, shift.date, "primary");
    }

    if (shift.shiftType === "Backup On Call" || shift.alsoBackupOnCall === true) {
      addNightlyReminder(reminders, shift.date, "backup");
    }
  }

  for (const assignment of schedule.onCallAssignments ?? []) {
    if (!weekDates.has(assignment.date)) {
      continue;
    }

    if (assignment.primaryWorkerId === workerId) {
      addNightlyReminder(reminders, assignment.date, "primary");
    }

    if (assignment.backupWorkerId === workerId) {
      addNightlyReminder(reminders, assignment.date, "backup");
    }
  }

  return [...reminders.values()].sort((left, right) => {
    return left.date.localeCompare(right.date) || left.role.localeCompare(right.role);
  });
}

function addNightlyReminder(reminders, date, role) {
  const key = `${date}:${role}`;

  if (!reminders.has(key)) {
    reminders.set(key, { date, role });
  }
}

function buildReminderEventLines(reminder, worker, stamp) {
  const isBackup = reminder.role === "backup";
  const title = isBackup ? "Backup On Call Tonight" : "On Call Tonight";
  const role = isBackup ? "Backup On Call" : "On Call";

  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(`phone-reminder-${reminder.role}-${worker.id}-${reminder.date}@conference-assistant-scheduler`)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${CALENDAR_TIME_ZONE}:${formatLocalDateTime(reminder.date, REMINDER_START_TIME)}`,
    `DTEND;TZID=${CALENDAR_TIME_ZONE}:${formatLocalDateTime(reminder.date, REMINDER_END_TIME)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(`${worker.name} is assigned ${role} tonight.`)}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

function getPhoneCoverageLabels(shift) {
  const labels = [];

  if (shift.shiftType === "On Call" || shift.alsoOnCall) {
    labels.push("On Call");
  }

  if (shift.shiftType === "Backup On Call" || shift.alsoBackupOnCall) {
    labels.push("Backup On Call");
  }

  return labels;
}

function buildTimeZoneLines() {
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${CALENDAR_TIME_ZONE}`,
    `X-LIC-LOCATION:${CALENDAR_TIME_ZONE}`,
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0700",
    "TZOFFSETTO:-0600",
    "TZNAME:MDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0600",
    "TZOFFSETTO:-0700",
    "TZNAME:MST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
}

function formatLocalDateTime(date, time) {
  return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
}

function formatUtcTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

function foldIcsLine(line) {
  const encoder = new TextEncoder();
  const parts = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;

  for (const character of line) {
    const characterBytes = encoder.encode(character).length;

    if (current && currentBytes + characterBytes > limit) {
      parts.push(parts.length === 0 ? current : ` ${current}`);
      current = character;
      currentBytes = characterBytes;
      limit = 74;
    } else {
      current += character;
      currentBytes += characterBytes;
    }
  }

  if (current || parts.length === 0) {
    parts.push(parts.length === 0 ? current : ` ${current}`);
  }

  return parts.join("\r\n");
}

function slugify(value) {
  return String(value ?? "worker")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "worker";
}
