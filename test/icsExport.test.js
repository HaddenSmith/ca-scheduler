import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildWorkerCalendar,
  getCalendarWorkerOptions,
  isShiftIncludedInCalendar,
} from "../src/icsExport.js";
import { parseScheduleJson } from "../src/jsonHelpers.js";
import { makeSchedule, makeShift, makeWorker } from "./fixtures.js";

const FIXED_NOW = new Date("2026-07-01T12:00:00Z");

function build(schedule, options = {}) {
  return buildWorkerCalendar(schedule, {
    workerId: "worker-1",
    weekDate: "2026-07-11",
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

  assert.match(result.content, /SUMMARY:OC \/ BOC \/ Desk/);
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

test("prefixes the final exported shift for an overnight primary assignment", () => {
  const schedule = makeSchedule({
    shifts: [
      makeShift({ id: "early", label: "Projects", startTime: "09:00", endTime: "10:00" }),
      makeShift({ id: "final", label: "CSA", startTime: "22:00", endTime: "23:00" }),
    ],
    onCallAssignments: [{
      date: "2026-07-11",
      primaryWorkerId: "worker-1",
      backupWorkerId: "",
    }],
  });
  const result = build(schedule);

  assert.match(result.content, /SUMMARY:Projects/);
  assert.match(result.content, /SUMMARY:OC \/ CSA/);
  assert.doesNotMatch(result.content, /TRANSP:TRANSPARENT/);
});

test("prefixes the final exported shift for an overnight backup assignment", () => {
  const schedule = makeSchedule({
    shifts: [makeShift({ label: "Desk", startTime: "08:00", endTime: "09:00" })],
    onCallAssignments: [
      { date: "2026-07-11", primaryWorkerId: "", backupWorkerId: "worker-1" },
    ],
  });
  const result = build(schedule);

  assert.match(result.content, /SUMMARY:BOC \/ Desk/);
  assert.doesNotMatch(result.content, /TRANSP:TRANSPARENT/);
});

test("does not prefix or add an event when no exported shift exists for the assigned night", () => {
  const result = build(makeSchedule({
    shifts: [makeShift({ date: "2026-07-12" })],
    onCallAssignments: [{ date: "2026-07-11", primaryWorkerId: "worker-1", backupWorkerId: "" }],
  }));

  assert.equal(result.eventCount, 1);
  assert.doesNotMatch(result.content, /TRANSP:TRANSPARENT/);
});

test("matches Hadden's published July 25-31 nightly assignments exactly", () => {
  const fileText = readFileSync(new URL("../data/published-schedule.json", import.meta.url), "utf8");
  const parsed = parseScheduleJson(fileText);
  assert.equal(parsed.isValid, true);

  const result = buildWorkerCalendar(parsed.schedule, {
    workerId: "hadden",
    weekDate: "2026-07-25",
    now: FIXED_NOW,
  });

  assert.equal(result.eventCount, result.workEventCount);
  assert.equal((result.content.match(/SUMMARY:OC \/ CSA/g) ?? []).length, 2);
  assert.equal((result.content.match(/SUMMARY:BOC \//g) ?? []).length, 0);
  assert.doesNotMatch(result.content, /TRANSP:TRANSPARENT/);
});

test("does not prefix a CSA roving label without an assignment", () => {
  const schedule = makeSchedule({
    shifts: [makeShift({ shiftType: "Roving", label: "CSA", roveSubtypes: ["CSA"] })],
  });
  const result = build(schedule);

  assert.doesNotMatch(result.content, /SUMMARY:OC \/|SUMMARY:BOC \//);
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
