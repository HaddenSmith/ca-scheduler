import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECK_IN_BUILDINGS,
  getCheckInLabel,
  normalizeCheckInBuilding,
} from "../src/checkInUtils.js";
import { createDefaultShift, normalizeShift } from "../src/scheduleState.js";
import { DEFAULT_SETTINGS } from "../src/model.js";
import { parseScheduleJson, serializeSchedule } from "../src/jsonHelpers.js";
import { makeSchedule, makeShift } from "./fixtures.js";

test("check-in buildings preserve the required order and generate CI labels", () => {
  assert.deepEqual(CHECK_IN_BUILDINGS.map(({ name }) => name), [
    "Cannon Center", "Hinckley", "Chipman", "David John", "Taylor",
    "Stover", "Budge", "Merrill", "May", "Building 9",
  ]);
  assert.equal(getCheckInLabel("Cannon Center"), "CI-CANC");
  assert.equal(getCheckInLabel("May"), "CI-I");
  assert.equal(getCheckInLabel("Budge"), "CI-G");
  assert.equal(getCheckInLabel("Building 9"), "CI-J");
});

test("check-in building metadata normalizes by name or code", () => {
  const normalized = normalizeShift(makeShift({
    shiftType: "Check In",
    label: "Check In",
    checkInBuilding: "May",
  }), DEFAULT_SETTINGS);

  assert.equal(normalized.checkInBuilding, "May");
  assert.equal(normalized.checkInCode, "I");
  assert.equal(normalized.label, "CI-I");

  const byCode = normalizeShift(makeShift({
    shiftType: "Check In",
    label: "Check In",
    checkInCode: "G",
  }), DEFAULT_SETTINGS);
  assert.equal(byCode.checkInBuilding, "Budge");
  assert.equal(byCode.label, "CI-G");
});

test("check-in records without building data remain compatible and custom labels stay custom", () => {
  const legacy = normalizeShift(makeShift({ shiftType: "Check In", label: "Check In" }), DEFAULT_SETTINGS);
  const custom = normalizeShift(makeShift({
    shiftType: "Check In",
    label: "CI-Gate",
    checkInBuilding: "May",
  }), DEFAULT_SETTINGS);

  assert.equal(legacy.checkInBuilding, "");
  assert.equal(legacy.checkInCode, "");
  assert.equal(legacy.label, "Check In");
  assert.equal(custom.label, "CI-Gate");
});

test("new check-in shifts store the selected building and generated label", () => {
  const shift = createDefaultShift(makeSchedule(), {
    shiftType: "Check In",
    date: "2026-07-13",
    checkInBuilding: "May",
  });

  assert.equal(shift.checkInBuilding, "May");
  assert.equal(shift.checkInCode, "I");
  assert.equal(shift.label, "CI-I");
});

test("check-in building metadata survives JSON round trip", () => {
  const schedule = makeSchedule({
    shifts: [makeShift({
      shiftType: "Check In",
      label: "Check In",
      checkInBuilding: "Building 9",
    })],
  });
  const parsed = parseScheduleJson(serializeSchedule(schedule));

  assert.equal(parsed.isValid, true);
  assert.equal(parsed.schedule.shifts[0].checkInBuilding, "Building 9");
  assert.equal(parsed.schedule.shifts[0].checkInCode, "J");
  assert.equal(parsed.schedule.shifts[0].label, "CI-J");
});
