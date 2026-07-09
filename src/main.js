import { calculateDailyTotals, calculateWeeklyTotals } from "./hourCalculations.js";
import {
  addDays,
  buildWeekDates,
  formatTimeForDisplay,
  formatWeekRange,
  getTodayIsoDate,
  getWeekStartDate,
} from "./dateUtils.js";
import { renderScheduleBoard } from "./renderSchedule.js";
import { renderWeekSummary } from "./renderTotals.js";
import { openDeskCoverageEditor } from "./deskCoverageEditor.js";
import {
  addDeskCoverage,
  addShift,
  addShifts,
  copyShift,
  createDefaultDeskCoverage,
  createDefaultShift,
  deleteDeskCoverage,
  deleteShift,
  getOnCallAssignment,
  shiftHasPhoneCoverage,
  updateDeskCoverage,
  updateShift,
  updateOnCallAssignment,
} from "./scheduleState.js";
import { downloadScheduleJson, parseScheduleJson } from "./jsonHelpers.js";
import { openOnCallEditor } from "./onCallEditor.js";
import { buildRepeatedShiftCopies } from "./repeatShifts.js";
import { sampleSchedule } from "./sampleData.js";
import { openSettingsPanel } from "./settingsPanel.js";
import { openShiftDetails } from "./shiftDetails.js";
import { openShiftEditor } from "./shiftEditor.js";
import {
  findLateNightMorningWarnings,
  findLongConsecutiveWorkWarnings,
  findPhoneCoverageOverlaps,
  findShiftOverlaps,
  findWeeklyMaxHourWarnings,
} from "./validation.js";
import { openWorkerManager } from "./workerManager.js";

let schedule = structuredClone(sampleSchedule);
const state = {
  readOnly: isViewerModeFromUrl(),
  viewMode: "detailed",
};

const scheduleBoard = document.querySelector("#schedule-board");
const weekSummary = document.querySelector("#week-summary");
const scheduleWarnings = document.querySelector("#schedule-warnings");
const weekRangeLabel = document.querySelector("#week-range-label");
const fileStatus = document.querySelector("#file-status");
const importJsonButton = document.querySelector(".import-json-button");
const exportJsonButton = document.querySelector(".export-json-button");
const importJsonInput = document.querySelector("#json-import-input");
const manageWorkersButton = document.querySelector(".manage-workers-button");
const settingsButton = document.querySelector(".settings-button");
const previousWeekButton = document.querySelector(".previous-week-button");
const currentWeekButton = document.querySelector(".current-week-button");
const nextWeekButton = document.querySelector(".next-week-button");
const viewerModeIndicator = document.querySelector("[data-viewer-mode-indicator]");
const viewModeButtons = [...document.querySelectorAll("button[data-view-mode]")];

for (const button of viewModeButtons) {
  button.addEventListener("click", () => {
    state.viewMode = button.dataset.viewMode;
    renderApp();
  });
}

importJsonButton.addEventListener("click", () => {
  if (state.readOnly) {
    return;
  }

  importJsonInput.click();
});

exportJsonButton.addEventListener("click", () => {
  if (state.readOnly) {
    return;
  }

  try {
    const fileName = downloadScheduleJson(schedule);
    showFileStatus(`Exported ${fileName}.`, "success");
  } catch {
    showFileStatus("Export failed. Please try again.", "error");
  }
});

importJsonInput.addEventListener("change", handleImportFile);

manageWorkersButton.addEventListener("click", async () => {
  if (state.readOnly) {
    return;
  }

  const result = await openWorkerManager(schedule);

  if (result.action === "save") {
    schedule = result.schedule;
    renderApp();
  }
});

settingsButton.addEventListener("click", async () => {
  if (state.readOnly) {
    return;
  }

  const result = await openSettingsPanel(schedule);

  if (result.action === "save") {
    schedule = {
      ...schedule,
      settings: result.settings,
      weekStartDate: getWeekStartDate(schedule.weekStartDate, result.settings.weekStartsOn),
    };
    renderApp();
  }
});

previousWeekButton.addEventListener("click", () => {
  schedule = {
    ...schedule,
    weekStartDate: addDays(schedule.weekStartDate, -7),
  };
  renderApp();
});

nextWeekButton.addEventListener("click", () => {
  schedule = {
    ...schedule,
    weekStartDate: addDays(schedule.weekStartDate, 7),
  };
  renderApp();
});

currentWeekButton.addEventListener("click", () => {
  schedule = {
    ...schedule,
    weekStartDate: getWeekStartDate(getTodayIsoDate(), schedule.settings.weekStartsOn),
  };
  renderApp();
});

function renderApp() {
  const dailyTotals = calculateDailyTotals(
    schedule.workers,
    schedule.shifts,
    schedule.weekStartDate,
  );
  const weeklyTotals = calculateWeeklyTotals(schedule.workers, dailyTotals);

  syncModeControls();
  document.body.dataset.viewMode = state.viewMode;
  weekRangeLabel.textContent = formatWeekRange(schedule.weekStartDate);

  for (const button of viewModeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.viewMode === state.viewMode));
  }

  renderScheduleWarnings(scheduleWarnings, schedule, weeklyTotals);
  renderScheduleBoard(scheduleBoard, schedule, dailyTotals, {
    onAddDeskCoverage: handleAddDeskCoverage,
    onAddShift: handleAddShift,
    onChangeShift: handleChangeShift,
    onDuplicateShift: handleDuplicateShift,
    onEditDeskCoverage: handleEditDeskCoverage,
    onEditOnCall: handleEditOnCall,
    onEditShift: handleEditShift,
    onViewDeskCoverage: handleViewDeskCoverage,
    onViewShift: handleViewShift,
    readOnly: state.readOnly,
    viewMode: state.viewMode,
  });
  renderWeekSummary(weekSummary, schedule, dailyTotals, weeklyTotals);
}

async function handleEditOnCall({ date }) {
  if (state.readOnly) {
    return;
  }

  const result = await openOnCallEditor({
    schedule,
    assignment: getOnCallAssignment(schedule, date),
  });

  if (result.action === "save") {
    schedule = updateOnCallAssignment(schedule, result.assignment);
    renderApp();
  }
}

async function handleAddShift(defaults = {}) {
  if (state.readOnly) {
    return;
  }

  const draftShift = createDefaultShift(schedule, defaults);
  const result = await openShiftEditor({
    mode: "create",
    schedule,
    shift: draftShift,
  });

  if (result.action === "save") {
    const repeatedShifts = buildRepeatedShiftCopies(schedule, result.shift, result.repeat);
    const copiedShifts = buildWorkerCopies(result.shift, result.copy);
    schedule = addShifts(addShift(schedule, result.shift), [
      ...repeatedShifts,
      ...copiedShifts,
    ]);
    renderApp();
  }
}

async function handleAddDeskCoverage(defaults = {}) {
  if (state.readOnly) {
    return;
  }

  const draftCoverage = createDefaultDeskCoverage(schedule, defaults);
  const result = await openDeskCoverageEditor({
    mode: "create",
    schedule,
    coverage: draftCoverage,
  });

  if (result.action === "save") {
    schedule = addDeskCoverage(schedule, result.coverage);
    renderApp();
  }
}

async function handleEditShift(shiftId) {
  if (state.readOnly) {
    return;
  }

  const shift = schedule.shifts.find((item) => item.id === shiftId);

  if (!shift) {
    return;
  }

  const result = await openShiftEditor({
    mode: "edit",
    schedule,
    shift,
  });

  if (result.action === "save") {
    schedule = updateShift(schedule, result.shift);
    schedule = addShifts(
      schedule,
      [
        ...buildRepeatedShiftCopies(schedule, result.shift, result.repeat),
        ...buildWorkerCopies(result.shift, result.copy),
      ],
    );
    renderApp();
  }

  if (result.action === "copy") {
    schedule = addShifts(schedule, buildWorkerCopies(result.shift, result.copy));
    renderApp();
  }

  if (result.action === "delete") {
    schedule = deleteShift(schedule, result.shiftId);
    renderApp();
  }
}

async function handleEditDeskCoverage(coverageId) {
  if (state.readOnly) {
    return;
  }

  const coverage = (schedule.deskCoverage ?? []).find((item) => item.id === coverageId);

  if (!coverage) {
    return;
  }

  const result = await openDeskCoverageEditor({
    mode: "edit",
    schedule,
    coverage,
  });

  if (result.action === "save") {
    schedule = updateDeskCoverage(schedule, result.coverage);
    renderApp();
  }

  if (result.action === "delete") {
    schedule = deleteDeskCoverage(schedule, result.coverageId);
    renderApp();
  }
}

async function handleViewShift(shiftId) {
  const shift = schedule.shifts.find((item) => item.id === shiftId);

  if (!shift) {
    return;
  }

  await openShiftDetails({ schedule, shift });
}

async function handleViewDeskCoverage(coverageId) {
  const coverage = (schedule.deskCoverage ?? []).find((item) => item.id === coverageId);

  if (!coverage) {
    return;
  }

  await openDeskCoverageEditor({
    mode: "view",
    schedule,
    coverage,
  });
}

function handleChangeShift({ shiftId, changes }) {
  if (state.readOnly) {
    return;
  }

  const shift = schedule.shifts.find((item) => item.id === shiftId);

  if (!shift) {
    return;
  }

  schedule = updateShift(schedule, {
    ...shift,
    ...changes,
  });
  renderApp();
}

function handleDuplicateShift({ shiftId, changes }) {
  if (state.readOnly) {
    return;
  }

  const shift = schedule.shifts.find((item) => item.id === shiftId);

  if (!shift) {
    return;
  }

  if (shiftHasPhoneCoverage(shift)) {
    const confirmed = globalThis.confirm(
      "This will duplicate on-call phone coverage with the shift. Continue?",
    );

    if (!confirmed) {
      return;
    }
  }

  schedule = addShift(schedule, copyShift(schedule, shift, changes));
  renderApp();
}

function buildWorkerCopies(sourceShift, copyOptions) {
  if (!copyOptions?.workerIds?.length) {
    return [];
  }

  return copyOptions.workerIds.map((workerId) => {
    return copyShift(schedule, sourceShift, {
      date: copyOptions.date,
      workerId,
    });
  });
}

async function handleImportFile() {
  const file = importJsonInput.files?.[0];

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const result = parseScheduleJson(text);

    if (!result.isValid) {
      showFileStatus(`Import failed: ${result.errors.slice(0, 4).join(" ")}`, "error");
      return;
    }

    const confirmed = globalThis.confirm(
      "Importing this file will replace the current in-memory schedule. Continue?",
    );

    if (!confirmed) {
      showFileStatus("Import canceled. Current schedule was not changed.", "info");
      return;
    }

    schedule = result.schedule;
    renderApp();

    const warnings = result.warnings?.length ? ` ${result.warnings.join(" ")}` : "";
    showFileStatus(`Imported ${file.name}.${warnings}`, "success");
  } catch {
    showFileStatus("Import failed. Please choose a valid schedule JSON file.", "error");
  } finally {
    importJsonInput.value = "";
  }
}

function syncModeControls() {
  document.body.dataset.appMode = state.readOnly ? "viewer" : "editor";
  viewerModeIndicator.hidden = !state.readOnly;

  for (const control of [
    importJsonButton,
    exportJsonButton,
    manageWorkersButton,
    settingsButton,
  ]) {
    control.hidden = state.readOnly;
    control.disabled = state.readOnly;
  }
}

function showFileStatus(message, tone = "info") {
  fileStatus.textContent = message;
  fileStatus.dataset.tone = tone;
  fileStatus.hidden = false;
}

function isViewerModeFromUrl() {
  const mode = new URLSearchParams(window.location.search).get("mode")?.toLowerCase();

  return ["view", "viewer", "readonly", "read-only"].includes(mode);
}

function renderScheduleWarnings(container, currentSchedule, weeklyTotals = {}) {
  const weekDates = buildWeekDates(currentSchedule.weekStartDate);
  const visibleDates = new Set(weekDates.map((date) => date.isoDate));
  const nextDateAfterWeek = addDays(weekDates.at(-1).isoDate, 1);
  const visibleShifts = currentSchedule.shifts.filter((shift) => visibleDates.has(shift.date));
  const scheduleWarningShifts = currentSchedule.shifts.filter((shift) => {
    return visibleDates.has(shift.date) || shift.date === nextDateAfterWeek;
  });
  const overlaps = findShiftOverlaps(visibleShifts, currentSchedule.settings);
  const phoneOverlaps = findPhoneCoverageOverlaps(
    visibleShifts,
    currentSchedule.settings,
  );
  const longWorkWarnings = findLongConsecutiveWorkWarnings(
    visibleShifts,
    currentSchedule.settings,
  );
  const lateMorningWarnings = findLateNightMorningWarnings(
    scheduleWarningShifts,
    currentSchedule.settings,
  );
  const weeklyMaxWarnings = findWeeklyMaxHourWarnings(
    currentSchedule.workers,
    weeklyTotals,
    currentSchedule.settings,
  );

  container.replaceChildren();
  container.hidden =
    overlaps.length === 0 &&
    phoneOverlaps.length === 0 &&
    longWorkWarnings.length === 0 &&
    lateMorningWarnings.length === 0 &&
    weeklyMaxWarnings.length === 0;

  if (container.hidden) {
    return;
  }

  const workerNames = new Map(
    currentSchedule.workers.map((worker) => [worker.id, worker.name]),
  );
  const dateLabels = new Map(
    weekDates.map((date) => [
      date.isoDate,
      `${date.dayName}, ${date.displayDate}`,
    ]),
  );

  if (overlaps.length > 0) {
    const visibleOverlaps = overlaps.slice(0, 3).map((overlap) => {
      return `${workerNames.get(overlap.workerId) ?? "Unknown worker"} on ${dateLabels.get(overlap.date) ?? overlap.date}`;
    });
    const warning = document.createElement("p");

    warning.textContent = `${overlaps.length} shift overlap warning${overlaps.length === 1 ? "" : "s"}: ${visibleOverlaps.join("; ")}${overlaps.length > visibleOverlaps.length ? "; more" : ""}.`;
    container.append(warning);
  }

  if (weeklyMaxWarnings.length > 0) {
    const visibleWeeklyWarnings = weeklyMaxWarnings.slice(0, 3).map((warning) => {
      return `${warning.workerName} is scheduled for ${warning.hours.toFixed(2)} hours this week, which exceeds the ${warning.limit} hour limit`;
    });
    const warning = document.createElement("p");

    warning.textContent = `${weeklyMaxWarnings.length} weekly hours warning${weeklyMaxWarnings.length === 1 ? "" : "s"}: ${visibleWeeklyWarnings.join("; ")}${weeklyMaxWarnings.length > visibleWeeklyWarnings.length ? "; more" : ""}.`;
    container.append(warning);
  }

  if (phoneOverlaps.length > 0) {
    const visiblePhoneOverlaps = phoneOverlaps.slice(0, 3).map((overlap) => {
      const workerLabel = overlap.workerIds.map((workerId) => {
        return workerNames.get(workerId) ?? "Unknown worker";
      }).join(" and ");
      const roleLabel = overlap.role === "primary" ? "Primary on-call" : "Backup on-call";

      return `${roleLabel} overlaps on ${dateLabels.get(overlap.date) ?? overlap.date} (${workerLabel}, ${formatTimeForDisplay(overlap.startTime)}-${formatTimeForDisplay(overlap.endTime)})`;
    });
    const warning = document.createElement("p");

    warning.textContent = `${phoneOverlaps.length} phone coverage warning${phoneOverlaps.length === 1 ? "" : "s"}: ${visiblePhoneOverlaps.join("; ")}${phoneOverlaps.length > visiblePhoneOverlaps.length ? "; more" : ""}.`;
    container.append(warning);
  }

  if (longWorkWarnings.length > 0) {
    const visibleLongWarnings = longWorkWarnings.slice(0, 3).map((warning) => {
      return `${workerNames.get(warning.workerId) ?? "Unknown worker"} on ${dateLabels.get(warning.date) ?? warning.date} (${formatTimeForDisplay(warning.startTime)}-${formatTimeForDisplay(warning.endTime)}, ${warning.hours.toFixed(2)} hours)`;
    });
    const warning = document.createElement("p");

    warning.textContent = `${longWorkWarnings.length} long consecutive work warning${longWorkWarnings.length === 1 ? "" : "s"}: ${visibleLongWarnings.join("; ")}${longWorkWarnings.length > visibleLongWarnings.length ? "; more" : ""}.`;
    container.append(warning);
  }

  if (lateMorningWarnings.length > 0) {
    const visibleLateWarnings = lateMorningWarnings.slice(0, 3).map((warning) => {
      return `${workerNames.get(warning.workerId) ?? "Unknown worker"} works late on ${dateLabels.get(warning.lateDate) ?? warning.lateDate} until ${formatTimeForDisplay(warning.lateEndTime)} and starts again ${dateLabels.get(warning.nextDate) ?? warning.nextDate} at ${formatTimeForDisplay(warning.earlyStartTime)}`;
    });
    const warning = document.createElement("p");

    warning.textContent = `${lateMorningWarnings.length} late-night/morning warning${lateMorningWarnings.length === 1 ? "" : "s"}: ${visibleLateWarnings.join("; ")}${lateMorningWarnings.length > visibleLateWarnings.length ? "; more" : ""}.`;
    container.append(warning);
  }
}

renderApp();
