import assert from "node:assert/strict";
import test from "node:test";

import { getShiftLabelWithPhoneCoverage } from "../src/shiftLabels.js";
import { makeShift } from "./fixtures.js";

test("adds the OC display prefix without changing the stored label", () => {
  const shift = makeShift({ label: "Projects", alsoOnCall: true });

  assert.equal(getShiftLabelWithPhoneCoverage(shift), "OC / Projects");
  assert.equal(shift.label, "Projects");
});

test("adds the BOC display prefix", () => {
  assert.equal(
    getShiftLabelWithPhoneCoverage(makeShift({ label: "Desk", alsoBackupOnCall: true })),
    "BOC / Desk",
  );
});

test("removes the display prefix when the Boolean flag is removed", () => {
  const shift = makeShift({ label: "Custom Label", alsoOnCall: false, alsoBackupOnCall: false });

  assert.equal(getShiftLabelWithPhoneCoverage(shift), "Custom Label");
});

test("preserves custom labels while both phone flags are active", () => {
  assert.equal(
    getShiftLabelWithPhoneCoverage(makeShift({
      label: "Meet manager at west entrance",
      alsoOnCall: true,
      alsoBackupOnCall: true,
    })),
    "OC / BOC / Meet manager at west entrance",
  );
});
