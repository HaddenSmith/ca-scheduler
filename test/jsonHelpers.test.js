import assert from "node:assert/strict";
import test from "node:test";

import {
  createScheduleFile,
  parseScheduleJson,
  serializeSchedule,
  validateAndNormalizeScheduleFile,
} from "../src/jsonHelpers.js";
import { makeSchedule, makeShift, makeWorker } from "./fixtures.js";

test("round trips the current schema including worker order and Desk Coverage", () => {
  const schedule = makeSchedule({
    workers: [makeWorker("worker-2", "Bailey"), makeWorker()],
    shifts: [makeShift({
      workerId: "worker-1",
      shiftType: "Roving",
      label: "R-3 + CSA",
      roveSubtypes: ["R-3", "CSA"],
    })],
    deskCoverage: [{
      id: "desk-coverage-1",
      date: "2026-07-11",
      startTime: "07:00",
      endTime: "09:00",
      label: "D",
      notes: "",
      color: "#a6a6a6",
    }],
    settings: {
      ...makeSchedule().settings,
      viewerWarningsEnabled: false,
    },
  });
  const parsed = parseScheduleJson(serializeSchedule(schedule));

  assert.equal(parsed.isValid, true);
  assert.deepEqual(parsed.schedule.workers.map((worker) => worker.id), ["worker-2", "worker-1"]);
  assert.deepEqual(parsed.schedule.shifts[0].roveSubtypes, ["R-3", "CSA"]);
  assert.equal(parsed.schedule.deskCoverage.length, 1);
  assert.equal(parsed.schedule.settings.viewerWarningsEnabled, false);
});

test("fills older optional fields and migrates roveSubtype", () => {
  const schedule = makeSchedule({
    shifts: [makeShift({
      shiftType: "Roving",
      roveSubtype: "R3",
      roveSubtypes: undefined,
      label: "R3",
    })],
  });
  const file = createScheduleFile(schedule);
  delete file.data.settings.viewerWarningsEnabled;
  delete file.data.settings.shiftColors["Checkout/Project"];
  delete file.data.deskCoverage;
  delete file.data.onCallAssignments;
  delete file.data.shifts[0].roveSubtypes;
  file.data.shifts[0].roveSubtype = "R3";
  const result = validateAndNormalizeScheduleFile(file);

  assert.equal(result.isValid, true);
  assert.deepEqual(result.schedule.shifts[0].roveSubtypes, ["R-3"]);
  assert.equal(result.schedule.settings.viewerWarningsEnabled, true);
  assert.equal(
    result.schedule.settings.shiftColors["Checkout/Project"],
    result.schedule.settings.shiftColors["Check Out"],
  );
  assert.deepEqual(result.schedule.deskCoverage, []);
  assert.deepEqual(result.schedule.onCallAssignments, []);
});

test("rejects invalid worker references without returning partial schedule state", () => {
  const file = createScheduleFile(makeSchedule({ shifts: [makeShift()] }));
  file.data.shifts[0].workerId = "missing-worker";
  const result = validateAndNormalizeScheduleFile(file);

  assert.equal(result.isValid, false);
  assert.equal(result.schedule, null);
  assert.ok(result.errors.some((error) => error.includes("unknown worker")));
});

test("rejects malformed JSON safely", () => {
  const result = parseScheduleJson("{not valid JSON");

  assert.equal(result.isValid, false);
  assert.equal(result.schedule, null);
});

test("older settings enable missing-night coverage warnings by default", () => {
  const file = createScheduleFile(makeSchedule());
  delete file.data.settings.missingNightPhoneCoverageWarningEnabled;
  const result = validateAndNormalizeScheduleFile(file);

  assert.equal(result.isValid, true);
  assert.equal(result.schedule.settings.missingNightPhoneCoverageWarningEnabled, true);
});

test("legacy nightly notes import safely and normalize away without affecting shift notes", () => {
  const file = createScheduleFile(makeSchedule({
    shifts: [makeShift({ notes: "Keep this normal shift note." })],
    onCallAssignments: [{
      date: "2026-07-11",
      primaryWorkerId: "worker-1",
      backupWorkerId: "worker-1",
      notes: "Legacy nightly note",
    }],
  }));
  file.data.onCallAssignments[0].notes = "Legacy nightly note";
  const imported = validateAndNormalizeScheduleFile(file);

  assert.equal(imported.isValid, true);
  assert.equal(imported.schedule.shifts[0].notes, "Keep this normal shift note.");
  assert.equal(Object.hasOwn(imported.schedule.onCallAssignments[0], "notes"), false);

  const exportedAgain = createScheduleFile(imported.schedule);
  assert.equal(Object.hasOwn(exportedAgain.data.onCallAssignments[0], "notes"), false);
});
