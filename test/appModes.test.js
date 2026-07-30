import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_MODES,
  getAppMode,
  getModeScheduleUrl,
  isReadOnlyMode,
} from "../src/appModes.js";

test("recognizes editor, viewer, and Hall Advisor review modes", () => {
  assert.equal(getAppMode("edit"), APP_MODES.EDITOR);
  assert.equal(getAppMode("view"), APP_MODES.VIEWER);
  assert.equal(getAppMode("ha-review"), APP_MODES.HA_REVIEW);
  assert.equal(getAppMode("unknown"), APP_MODES.EDITOR);
  assert.equal(isReadOnlyMode(APP_MODES.VIEWER), true);
  assert.equal(isReadOnlyMode(APP_MODES.HA_REVIEW), true);
  assert.equal(isReadOnlyMode(APP_MODES.EDITOR), false);
});

test("Hall Advisor review mode uses its dedicated static schedule file", () => {
  assert.equal(getModeScheduleUrl(APP_MODES.HA_REVIEW), "./data/ha-review-schedule.json");
  assert.equal(getModeScheduleUrl(APP_MODES.VIEWER), "./data/published-schedule.json");
});
