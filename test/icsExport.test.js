import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkerCalendar,
  getCalendarWorkerOptions,
  isShiftIncludedInCalendar,
} from "../src/icsExport.js";
import { makeSchedule, makeShift, makeWorker } from "./fixtures.js";

const FIXED_NOW = new Date("2026-07-01T12:00:00Z");

function build(schedule, options = {}) {
  return buildWorkerCalendar(schedule, {
    workerId: "worker-1",
    weekDate: "2026-07-11",
    includeNightlyReminder: false,
    now: FIXED_NOW,
    ...options,
  });
}

function unfoldIcs(content) {
  return content.replace(/\r\n[ \t]/g, "");
}

test("builds a valid one-worker calendar and filters by selected week", () => {
  const schedule = makeSchedule({
    shifts: [
      makeShift(),
      makeShift({ id: "shift-other-week", date: "2026-07-18" }),
      makeShift({ id: "shift-other-worker", workerId: "worker-2" }),
    ],
    workers: [makeWorker(), makeWorker("worker-2", "Bailey")],
  });
  const result = build(schedule);

  assert.match(result.content, /^BEGIN:VCALENDAR\r\n/);
  assert.match(result.content, /END:VCALENDAR\r\n$/);
  assert.equal(result.workEventCount, 1);
  assert.match(result.content, /X-WR-CALNAME:Alex CA Work Schedule/);
  assert.doesNotMatch(result.content, /shift-other-week/);
  assert.doesNotMatch(result.content, /shift-other-worker/);
});

test("uses canonical inclusion rules and excludes Class, OFF, and Desk Coverage", () => {
  assert.equal(isShiftIncludedInCalendar(makeShift()), true);
  assert.equal(isShiftIncludedInCalendar(makeShift({ shiftType: "Staff Meeting", countsTowardHours: false })), true);
  assert.equal(isShiftIncludedInCalendar(makeShift({ shiftType: "On Call", countsTowardHours: false })), true);
  assert.equal(isShiftIncludedInCalendar(makeShift({ shiftType: "Backup On Call", countsTowardHours: false })), true);
  assert.equal(isShiftIncludedInCalendar(makeShift({ shiftType: "Class", countsTowardHours: true })), false);
  assert.equal(isShiftIncludedInCalendar(makeShift({ shiftType: "OFF", countsTowardHours: true })), false);
  assert.equal(isShiftIncludedInCalendar(makeShift({ shiftType: "Desk Coverage", countsTowardHours: true })), false);
  assert.equal(isShiftIncludedInCalendar(makeShift({ shiftType: "Other", countsTowardHours: false })), false);
});

test("includes notes and additional phone coverage in summary and description", () => {
  const schedule = makeSchedule({
    shifts: [makeShift({
      notes: "Call manager, then document follow-up.",
      alsoOnCall: true,
      alsoBackupOnCall: true,
    })],
  });
  const result = build(schedule);

  assert.match(result.content, /SUMMARY:Desk \(On Call \+ Backup On Call\)/);
  const unfolded = unfoldIcs(result.content);

  assert.match(unfolded, /Phone coverage: On Call and Backup On Call/);
  assert.match(unfolded, /Call manager\\, then document follow-up\./);
});

test("handles overnight end dates and America/Denver timezone rules", () => {
  const result = build(makeSchedule({
    shifts: [makeShift({ startTime: "22:30", endTime: "00:30" })],
  }));

  assert.match(result.content, /TZID:America\/Denver/);
  assert.match(result.content, /DTSTART;TZID=America\/Denver:20260711T223000/);
  assert.match(result.content, /DTEND;TZID=America\/Denver:20260712T003000/);
  assert.match(result.content, /RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU/);
});

test("escapes ICS text, keeps ordinary slashes, and folds physical lines to 75 octets", () => {
  const notes = `Comma, semicolon; slash/ backslash\\\n${"long unicode note ".repeat(12)}end`;
  const result = build(makeSchedule({ shifts: [makeShift({ notes })] }));
  const physicalLines = result.content.split("\r\n").filter(Boolean);
  const encoder = new TextEncoder();

  assert.match(unfoldIcs(result.content), /Comma\\, semicolon\\; slash\/ backslash\\\\\\n/);
  assert.ok(physicalLines.some((line) => line.startsWith(" ")));
  assert.ok(physicalLines.every((line) => encoder.encode(line).length <= 75));
});

test("creates unique event UIDs for multiple shifts", () => {
  const result = build(makeSchedule({
    shifts: [makeShift(), makeShift({ id: "shift-2", startTime: "10:00", endTime: "11:00" })],
  }));
  const uids = [...result.content.matchAll(/^UID:(.+)$/gm)].map((match) => match[1].trim());

  assert.equal(result.workEventCount, 2);
  assert.equal(new Set(uids).size, uids.length);
});

test("keeps a shift UID stable when the shift date changes", () => {
  const first = build(makeSchedule({ shifts: [makeShift()] })).content.match(/^UID:(.+)$/m)[1];
  const moved = build(
    makeSchedule({ shifts: [makeShift({ date: "2026-07-12" })] }),
    { weekDate: "2026-07-12" },
  ).content.match(/^UID:(.+)$/m)[1];

  assert.equal(first, moved);
});

test("deduplicates nightly reminders across shifts and nightly assignments", () => {
  const schedule = makeSchedule({
    shifts: [
      makeShift({ shiftType: "On Call", countsTowardHours: false, alsoOnCall: true }),
      makeShift({ id: "shift-2", startTime: "20:00", endTime: "21:00", alsoOnCall: true }),
      makeShift({ id: "shift-3", startTime: "21:00", endTime: "22:00", alsoBackupOnCall: true }),
    ],
    onCallAssignments: [{
      date: "2026-07-11",
      primaryWorkerId: "worker-1",
      backupWorkerId: "worker-1",
      notes: "",
    }],
  });
  const result = build(schedule, { includeNightlyReminder: true });

  assert.equal(result.reminderEventCount, 2);
  assert.equal((result.content.match(/SUMMARY:On Call Tonight/g) ?? []).length, 1);
  assert.equal((result.content.match(/SUMMARY:Backup On Call Tonight/g) ?? []).length, 1);
  assert.equal((result.content.match(/TRANSP:TRANSPARENT/g) ?? []).length, 2);
  assert.match(result.content, /DTSTART;TZID=America\/Denver:20260711T233000/);
  assert.match(result.content, /DTEND;TZID=America\/Denver:20260711T234500/);
});

test("does not infer reminders from a CSA roving label", () => {
  const schedule = makeSchedule({
    shifts: [makeShift({ shiftType: "Roving", label: "CSA", roveSubtypes: ["CSA"] })],
  });
  const result = build(schedule, { includeNightlyReminder: true });

  assert.equal(result.reminderEventCount, 0);
  assert.doesNotMatch(result.content, /On Call Tonight/);
});

test("reports zero work events for a worker with only excluded records", () => {
  const result = build(makeSchedule({
    shifts: [
      makeShift({ shiftType: "Class", countsTowardHours: false }),
      makeShift({ id: "off", shiftType: "OFF", countsTowardHours: false }),
    ],
    deskCoverage: [{ id: "desk-1", date: "2026-07-11", startTime: "07:00", endTime: "08:00", label: "D" }],
  }));

  assert.equal(result.workEventCount, 0);
  assert.equal(result.eventCount, 0);
});

test("worker choices always follow the current workers array and order", () => {
  const first = makeSchedule({ workers: [makeWorker(), makeWorker("worker-2", "Bailey")] });
  const changed = makeSchedule({ workers: [makeWorker("worker-2", "Bailey Renamed"), makeWorker("worker-3", "Casey")] });

  assert.deepEqual(getCalendarWorkerOptions(first), [
    { id: "worker-1", name: "Alex" },
    { id: "worker-2", name: "Bailey" },
  ]);
  assert.deepEqual(getCalendarWorkerOptions(changed), [
    { id: "worker-2", name: "Bailey Renamed" },
    { id: "worker-3", name: "Casey" },
  ]);
});
