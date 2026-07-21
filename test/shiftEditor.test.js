import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowCopyPhoneWarning } from "../src/shiftEditor.js";
import { DEFAULT_SETTINGS } from "../src/model.js";
import { createDefaultShift, normalizeShift } from "../src/scheduleState.js";
import { makeSchedule, makeShift } from "./fixtures.js";

test("copy warning appears only for normal shifts with additional phone coverage", () => {
  assert.equal(shouldShowCopyPhoneWarning(makeShift({ shiftType: "Desk", alsoOnCall: true })), true);
  assert.equal(shouldShowCopyPhoneWarning(makeShift({ shiftType: "Projects", alsoBackupOnCall: true })), true);
  assert.equal(shouldShowCopyPhoneWarning(makeShift({ shiftType: "On Call", alsoOnCall: true })), false);
  assert.equal(shouldShowCopyPhoneWarning(makeShift({ shiftType: "Backup On Call", alsoBackupOnCall: true })), false);
  assert.equal(shouldShowCopyPhoneWarning(makeShift({ shiftType: "Desk" })), false);
});

test("dedicated phone shifts remain zero-hour shifts", () => {
  assert.equal(
    normalizeShift(makeShift({ shiftType: "On Call", countsTowardHours: true }), DEFAULT_SETTINGS).countsTowardHours,
    false,
  );
  assert.equal(
    normalizeShift(makeShift({ shiftType: "Backup On Call", countsTowardHours: true }), DEFAULT_SETTINGS).countsTowardHours,
    false,
  );
});

test("new roving shifts use subtype default times without changing other types", () => {
  const schedule = makeSchedule({ weekStartDate: "2026-07-24" });
  const fridayRoving = createDefaultShift(schedule, {
    shiftType: "Roving",
    roveSubtypes: ["R-J"],
    date: "2026-07-24",
  });
  const regularRoving = createDefaultShift(schedule, {
    shiftType: "Roving",
    roveSubtypes: ["CSA"],
    date: "2026-07-21",
  });
  const desk = createDefaultShift(schedule, {
    shiftType: "Desk",
    date: "2026-07-21",
  });

  assert.deepEqual(
    { startTime: fridayRoving.startTime, endTime: fridayRoving.endTime },
    { startTime: "21:30", endTime: "01:30" },
  );
  assert.deepEqual(
    { startTime: regularRoving.startTime, endTime: regularRoving.endTime },
    { startTime: "22:30", endTime: "00:30" },
  );
  assert.deepEqual(
    { startTime: desk.startTime, endTime: desk.endTime },
    { startTime: "09:00", endTime: "10:00" },
  );
});
