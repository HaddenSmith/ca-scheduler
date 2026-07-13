import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_REPEAT_OCCURRENCES,
  buildRepeatedShiftCopies,
  getRepeatOccurrenceDates,
} from "../src/repeatShifts.js";
import { copyShift } from "../src/scheduleState.js";
import { makeSchedule, makeShift, makeWorker } from "./fixtures.js";

test("creates daily and weekly occurrence dates", () => {
  assert.deepEqual(getRepeatOccurrenceDates({
    frequency: "daily",
    startDate: "2026-07-11",
    untilDate: "2026-07-13",
  }).dates, ["2026-07-11", "2026-07-12", "2026-07-13"]);

  assert.deepEqual(getRepeatOccurrenceDates({
    frequency: "weekly",
    startDate: "2026-07-11",
    untilDate: "2026-07-25",
    weekdays: [6],
  }).dates, ["2026-07-11", "2026-07-18", "2026-07-25"]);
});

test("flags repeat requests beyond the occurrence cap", () => {
  const result = getRepeatOccurrenceDates({
    frequency: "daily",
    maxOccurrences: 2,
    startDate: "2026-07-11",
    untilDate: "2026-07-20",
  });

  assert.equal(result.exceedsLimit, true);
  assert.equal(result.dates.length, 3);
  assert.ok(MAX_REPEAT_OCCURRENCES >= 100);
});

test("copies shifts with unique IDs and independent records", () => {
  const schedule = makeSchedule({ workers: [makeWorker(), makeWorker("worker-2", "Bailey")] });
  const source = makeShift({ notes: "Keep this note" });
  const first = copyShift(schedule, source, { workerId: "worker-2" });
  const second = copyShift(schedule, source, { workerId: "worker-2" });

  assert.notEqual(first.id, source.id);
  assert.notEqual(first.id, second.id);
  assert.equal(first.workerId, "worker-2");
  first.notes = "Changed copy";
  assert.equal(source.notes, "Keep this note");
});

test("builds independent repeated copies without copying the starting date", () => {
  const schedule = makeSchedule();
  const source = makeShift();
  const copies = buildRepeatedShiftCopies(schedule, source, {
    frequency: "daily",
    untilDate: "2026-07-13",
    weekdays: [],
  });

  assert.deepEqual(copies.map((shift) => shift.date), ["2026-07-12", "2026-07-13"]);
  assert.equal(new Set(copies.map((shift) => shift.id)).size, 2);
});
