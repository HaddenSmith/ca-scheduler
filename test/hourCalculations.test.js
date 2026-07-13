import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDailyTotals,
  calculateWeeklyTotals,
  calculateWeeklyTypeTotals,
} from "../src/hourCalculations.js";
import { splitShiftIntoCalendarSegments } from "../src/timeUtils.js";
import { makeShift, makeWorker } from "./fixtures.js";

const worker = makeWorker();

test("splits an overnight shift into actual calendar days", () => {
  const segments = splitShiftIntoCalendarSegments(makeShift({
    date: "2026-07-17",
    startTime: "22:30",
    endTime: "00:30",
  }));

  assert.deepEqual(segments.map(({ date, durationMinutes }) => ({ date, durationMinutes })), [
    { date: "2026-07-17", durationMinutes: 90 },
    { date: "2026-07-18", durationMinutes: 30 },
  ]);
});

test("moves the last-day after-midnight portion into the next week without double counting", () => {
  const shift = makeShift({ date: "2026-07-17", startTime: "22:30", endTime: "00:30" });
  const currentDaily = calculateDailyTotals([worker], [shift], "2026-07-11");
  const nextDaily = calculateDailyTotals([worker], [shift], "2026-07-18");
  const currentWeekly = calculateWeeklyTotals([worker], currentDaily);
  const nextWeekly = calculateWeeklyTotals([worker], nextDaily);

  assert.equal(currentDaily["2026-07-17"][worker.id], 1.5);
  assert.equal(nextDaily["2026-07-18"][worker.id], 0.5);
  assert.equal(currentWeekly[worker.id], 1.5);
  assert.equal(nextWeekly[worker.id], 0.5);
  assert.equal(currentWeekly[worker.id] + nextWeekly[worker.id], 2);
});

test("respects a custom Monday week boundary", () => {
  const shift = makeShift({ date: "2026-07-19", startTime: "23:00", endTime: "01:00" });
  const current = calculateWeeklyTotals(
    [worker],
    calculateDailyTotals([worker], [shift], "2026-07-13"),
  );
  const next = calculateWeeklyTotals(
    [worker],
    calculateDailyTotals([worker], [shift], "2026-07-20"),
  );

  assert.equal(current[worker.id], 1);
  assert.equal(next[worker.id], 1);
});

test("excludes zero-hour shifts and keeps daily, weekly, and type totals consistent", () => {
  const shifts = [
    makeShift({ id: "desk", shiftType: "Desk", startTime: "09:00", endTime: "11:00" }),
    makeShift({ id: "meeting", shiftType: "Staff Meeting", startTime: "11:00", endTime: "12:00" }),
    makeShift({ id: "class", shiftType: "Class", startTime: "12:00", endTime: "13:00", countsTowardHours: false }),
    makeShift({ id: "off", shiftType: "OFF", startTime: "13:00", endTime: "17:00", countsTowardHours: false }),
    makeShift({ id: "phone", shiftType: "On Call", startTime: "17:00", endTime: "19:00", countsTowardHours: false }),
  ];
  const daily = calculateDailyTotals([worker], shifts, "2026-07-11");
  const weekly = calculateWeeklyTotals([worker], daily);
  const byType = calculateWeeklyTypeTotals([worker], shifts, "2026-07-11")[worker.id];

  assert.equal(daily["2026-07-11"][worker.id], 3);
  assert.equal(weekly[worker.id], 3);
  assert.equal(byType.Desk, 2);
  assert.equal(byType["Staff Meeting"], 1);
  assert.equal(byType["On Call / Backup On Call"], 2);
  assert.equal(byType["Total Counted"], 3);
});
