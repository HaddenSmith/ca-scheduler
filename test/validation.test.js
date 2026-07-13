import assert from "node:assert/strict";
import test from "node:test";

import { buildWeekDates } from "../src/dateUtils.js";
import {
  findDailyMaxHourWarnings,
  findDeskCoverageGapWarnings,
  findLateNightMorningWarnings,
  findLongConsecutiveWorkWarnings,
  findPhoneCoverageOverlaps,
  findShiftOverlaps,
  findWeeklyMaxHourWarnings,
} from "../src/validation.js";
import { makeSchedule, makeShift, makeWorker } from "./fixtures.js";

const settings = makeSchedule().settings;

test("finds normal and phone coverage overlaps", () => {
  const shifts = [
    makeShift({ id: "a", workerId: "worker-1", startTime: "09:00", endTime: "11:00", alsoOnCall: true }),
    makeShift({ id: "b", workerId: "worker-1", startTime: "10:00", endTime: "12:00" }),
    makeShift({ id: "c", workerId: "worker-2", startTime: "10:30", endTime: "11:30", alsoOnCall: true }),
  ];

  assert.equal(findShiftOverlaps(shifts, settings).length, 1);
  assert.equal(findPhoneCoverageOverlaps(shifts, settings).length, 1);
});

test("finds normal and phone overlaps across midnight calendar segments", () => {
  const shifts = [
    makeShift({ id: "late", workerId: "worker-1", date: "2026-07-11", startTime: "23:00", endTime: "00:30", alsoOnCall: true }),
    makeShift({ id: "after-midnight", workerId: "worker-1", date: "2026-07-12", startTime: "00:00", endTime: "01:00" }),
    makeShift({ id: "other-phone", workerId: "worker-2", date: "2026-07-12", startTime: "00:15", endTime: "01:00", alsoOnCall: true }),
  ];

  assert.equal(findShiftOverlaps(shifts, settings).length, 1);
  assert.equal(findPhoneCoverageOverlaps(shifts, settings).length, 1);
});

test("daily and weekly maximum warnings obey settings", () => {
  const workers = [makeWorker()];
  const weekDates = buildWeekDates("2026-07-11");
  const dailyTotals = Object.fromEntries(weekDates.map(({ isoDate }) => [isoDate, { "worker-1": 0 }]));
  dailyTotals["2026-07-11"]["worker-1"] = 10.5;

  assert.equal(findDailyMaxHourWarnings(workers, dailyTotals, weekDates, settings).length, 1);
  assert.equal(findDailyMaxHourWarnings(workers, dailyTotals, weekDates, { ...settings, dailyMaxHoursWarningEnabled: false }).length, 0);
  assert.equal(findWeeklyMaxHourWarnings(workers, { "worker-1": 41 }, settings).length, 1);
  assert.equal(findWeeklyMaxHourWarnings(workers, { "worker-1": 41 }, { ...settings, weeklyMaxHoursWarningEnabled: false }).length, 0);
});

test("finds long consecutive work but resets after the required break", () => {
  const longBlock = [
    makeShift({ id: "a", startTime: "09:00", endTime: "12:00" }),
    makeShift({ id: "b", startTime: "12:15", endTime: "15:00" }),
  ];
  const brokenBlock = [
    makeShift({ id: "a", startTime: "09:00", endTime: "12:00" }),
    makeShift({ id: "b", startTime: "12:30", endTime: "15:00" }),
  ];

  assert.equal(findLongConsecutiveWorkWarnings(longBlock, settings).length, 1);
  assert.equal(findLongConsecutiveWorkWarnings(brokenBlock, settings).length, 0);
  assert.equal(findLongConsecutiveWorkWarnings(longBlock, { ...settings, longShiftWarningEnabled: false }).length, 0);
});

test("finds late-night into early-morning turnaround and obeys disabled setting", () => {
  const shifts = [
    makeShift({ id: "late", date: "2026-07-11", startTime: "21:00", endTime: "00:30" }),
    makeShift({ id: "early", date: "2026-07-12", startTime: "07:30", endTime: "09:00" }),
  ];

  assert.equal(findLateNightMorningWarnings(shifts, settings).length, 1);
  assert.equal(findLateNightMorningWarnings(shifts, { ...settings, lateNightWarningEnabled: false }).length, 0);
});

test("desk gap warnings combine worker Desk shifts with Desk Coverage and can be disabled", () => {
  const oneDay = buildWeekDates("2026-07-11").slice(0, 1);
  const focusedSettings = {
    ...settings,
    deskCoverageRequiredStartTime: "07:00",
    deskCoverageRequiredEndTime: "12:00",
  };
  const deskShift = makeShift({ startTime: "09:00", endTime: "12:00", shiftType: "Desk" });
  const coverage = [{ id: "coverage", date: "2026-07-11", startTime: "07:00", endTime: "09:00" }];

  assert.deepEqual(findDeskCoverageGapWarnings([deskShift], coverage, oneDay, focusedSettings), []);
  assert.equal(findDeskCoverageGapWarnings([], coverage, oneDay, focusedSettings).length, 1);
  assert.equal(findDeskCoverageGapWarnings([deskShift], [], oneDay, focusedSettings).length, 1);
  assert.equal(findDeskCoverageGapWarnings([], [], oneDay, { ...focusedSettings, deskCoverageGapWarningEnabled: false }).length, 0);
});
