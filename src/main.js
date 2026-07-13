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
  addDeskCoverageItems,
  addShift,
  addShifts,
  copyDeskCoverage,
  copyShift,
  createDefaultDeskCoverage,
  createDefaultShift,
  deleteDeskCoverage,
  deleteShift,
  getOnCallAssignment,
  shiftHasPhoneCoverage,
  applyColorDefaultChanges,
  updateDeskCoverage,
  updateShift,
  updateOnCallAssignment,
} from "./scheduleState.js";
import { downloadScheduleJson, parseScheduleJson } from "./jsonHelpers.js";
import { openIcsExportDialog } from "./icsExport.js";
import {
  clearLocalAutosave,
  loadLocalAutosave,
  markLocalAutosaveExported,
  saveLocalAutosave,
} from "./localStorageAutosave.js";
import { openOnCallEditor } from "./onCallEditor.js";
import { buildRepeatedDeskCoverageCopies, buildRepeatedShiftCopies } from "./repeatShifts.js";
import { sampleSchedule } from "./sampleData.js";
import { openSettingsPanel } from "./settingsPanel.js";
import { openShiftDetails } from "./shiftDetails.js";
import { openShiftEditor } from "./shiftEditor.js";
import {
  findDailyMaxHourWarnings,
  findDeskCoverageGapWarnings,
  findLateNightMorningWarnings,
  findLongConsecutiveWorkWarnings,
  findPhoneCoverageOverlaps,
  findShiftOverlaps,
  findWeeklyMaxHourWarnings,
} from "./validation.js";
import { openWorkerManager } from "./workerManager.js";

const PUBLISHED_SCHEDULE_URL = "./data/published-schedule.json";
const DEFAULT_SCHEDULE_URL = "./data/default-schedule.json";
const STATUS_AUTO_DISMISS_MS = 15000;
const AUTO_DISMISS_STATUS_TONES = new Set(["success", "info"]);

let schedule = structuredClone(sampleSchedule);
let fileStatusTimer = null;
const state = {
  hasLocalAutosave: false,
  hasUnexportedChanges: false,
  localSaveError: "",
  localSavedAt: "",
  localStorageAvailable: true,
  readOnly: isViewerModeFromUrl(),
  startupSource: "sample",
  viewMode: "detailed",
};

const scheduleBoard = getRequiredElement("#schedule-board");
const weekSummary = getRequiredElement("#week-summary");
const scheduleWarnings = getRequiredElement("#schedule-warnings");
const weekRangeLabel = getRequiredElement("#week-range-label");
const fileStatus = getRequiredElement("#file-status");
const importJsonInput = getOptionalElement("#json-import-input");
const settingsButton = getOptionalElement(".settings-button");
const autosaveStatus = getRequiredElement("#autosave-status");
const exportReminder = getRequiredElement("#export-reminder");
const localSaveNote = getOptionalElement(".local-save-note");
const adminActionsGroup = getOptionalElement(".admin-actions");
const viewerActionsGroup = getOptionalElement(".viewer-actions");
const calendarDownloadButton = getOptionalElement(".calendar-download-button");
const previousWeekButton = getRequiredElement(".previous-week-button");
const currentWeekButton = getRequiredElement(".current-week-button");
const dateJumpButton = getOptionalElement(".date-jump-button");
const dateJumpInput = getOptionalElement("#date-jump-input");
const nextWeekButton = getRequiredElement(".next-week-button");
const viewerModeIndicator = getOptionalElement("[data-viewer-mode-indicator]");
const viewModeButtons = getRequiredElements("button[data-view-mode]");

for (const button of viewModeButtons) {
  button.addEventListener("click", () => {
    state.viewMode = button.dataset.viewMode;
    renderApp({ preserveScroll: true });
  });
}

addOptionalListener(importJsonInput, "change", handleImportFile);

addOptionalListener(settingsButton, "click", handleSettingsAction);
addOptionalListener(calendarDownloadButton, "click", handleCalendarDownload);
addOptionalListener(dateJumpButton, "click", handleDateJumpRequest);
addOptionalListener(dateJumpInput, "change", handleDateJumpChange);

async function handleSettingsAction() {
  if (state.readOnly) {
    return;
  }

  const result = await openSettingsPanel(schedule);

  if (result.action === "save") {
    const scheduleWithSettings = {
      ...schedule,
      settings: result.settings,
      weekStartDate: getWeekStartDate(schedule.weekStartDate, result.settings.weekStartsOn),
    };

    commitScheduleChange(
      applyColorDefaultChanges(scheduleWithSettings, schedule.settings, result.settings),
      { preserveScroll: true },
    );
    return;
  }

  if (result.action === "manage-workers") {
    await handleManageWorkers();
    return;
  }

  if (result.action === "import-json") {
    if (!importJsonInput) {
      showFileStatus("Import is unavailable because the file input is missing from the page.", "error");
      return;
    }

    importJsonInput.click();
    return;
  }

  if (result.action === "export-json") {
    handleExportJson();
    return;
  }

  if (result.action === "clear-autosave") {
    handleClearLocalAutosave();
    return;
  }

  if (result.action === "load-default") {
    await handleLoadDefaultSchedule();
  }
}

async function handleCalendarDownload() {
  if (!state.readOnly) {
    return;
  }

  const result = await openIcsExportDialog(schedule);

  if (result.action === "download") {
    const eventLabel = result.eventCount === 1 ? "event" : "events";
    showFileStatus(`Downloaded ${result.fileName} with ${result.eventCount} ${eventLabel}.`, "success");
  }
}

async function handleManageWorkers() {
  if (state.readOnly) {
    return;
  }

  const result = await openWorkerManager(schedule);

  if (result.action === "save") {
    commitScheduleChange(result.schedule, { preserveScroll: true });
  }
}

function handleExportJson() {
  if (state.readOnly) {
    return;
  }

  try {
    const fileName = downloadScheduleJson(schedule);
    markScheduleExported();
    showFileStatus(`Exported ${fileName}.`, "success");
  } catch {
    showFileStatus("Export failed. Please try again.", "error");
  }
}

function handleClearLocalAutosave() {
  if (state.readOnly) {
    return;
  }

  const confirmed = globalThis.confirm(
    "Clear the locally autosaved browser copy? The current open schedule will stay on screen until you refresh or load another file.",
  );

  if (!confirmed) {
    return;
  }

  clearLocalAutosave();
  state.hasLocalAutosave = false;
  state.hasUnexportedChanges = true;
  state.localSavedAt = "";
  state.localSaveError = "";
  updatePersistenceStatus();
  showFileStatus("Local autosave cleared. Export JSON if you need a backup of the current schedule.", "info");
}

previousWeekButton.addEventListener("click", () => {
  commitScheduleState({
    ...schedule,
    weekStartDate: addDays(schedule.weekStartDate, -7),
  }, { preserveScroll: false });
});

nextWeekButton.addEventListener("click", () => {
  commitScheduleState({
    ...schedule,
    weekStartDate: addDays(schedule.weekStartDate, 7),
  }, { preserveScroll: false });
});

currentWeekButton.addEventListener("click", () => {
  const today = getTodayIsoDate();

  commitScheduleState({
    ...schedule,
    weekStartDate: getWeekStartDate(today, schedule.settings.weekStartsOn),
  }, {
    preserveScroll: false,
    scrollToDate: state.viewMode === "detailed" ? today : "",
  });
});

function handleDateJumpRequest() {
  if (!dateJumpInput) {
    return;
  }

  dateJumpInput.value ||= getTodayIsoDate();

  if (typeof dateJumpInput.showPicker === "function") {
    try {
      dateJumpInput.showPicker();
      return;
    } catch {
      // Fall back to focus/click below if the browser refuses showPicker.
    }
  }

  dateJumpInput.focus();
  dateJumpInput.click();
}

function handleDateJumpChange() {
  const selectedDate = dateJumpInput?.value;

  if (!isIsoDateValue(selectedDate)) {
    return;
  }

  commitScheduleState({
    ...schedule,
    weekStartDate: getWeekStartDate(selectedDate, schedule.settings.weekStartsOn),
  }, {
    preserveScroll: false,
    scrollToDate: state.viewMode === "detailed" ? selectedDate : "",
  });
}

window.addEventListener("beforeunload", (event) => {
  if (!state.readOnly && state.hasUnexportedChanges) {
    event.preventDefault();
    event.returnValue = "";
  }
});

async function initializeApp() {
  const startup = await loadStartupSchedule();

  schedule = startup.schedule;
  state.hasLocalAutosave = startup.hasLocalAutosave;
  state.hasUnexportedChanges = startup.hasUnexportedChanges;
  state.localSaveError = startup.localSaveError;
  state.localSavedAt = startup.localSavedAt;
  state.localStorageAvailable = startup.localStorageAvailable;
  state.startupSource = startup.source;

  if (!state.readOnly && !state.hasLocalAutosave && startup.shouldSaveLocalCopy) {
    saveCurrentScheduleLocally({ dirty: false });
  }

  renderApp({ preserveScroll: false });

  if (startup.statusMessage) {
    showFileStatus(startup.statusMessage, startup.statusTone);
  }
}

async function loadStartupSchedule() {
  if (state.readOnly) {
    return loadViewerStartupSchedule();
  }

  return loadEditorStartupSchedule();
}

async function loadViewerStartupSchedule() {
  try {
    const publishedResult = await loadPublishedScheduleFile();

    return createFileStartupResult(publishedResult, {
      source: "published",
      statusMessage: "Loaded published schedule.",
      statusTone: "success",
    });
  } catch {
    try {
      const defaultResult = await loadDefaultScheduleFile();

      return createFileStartupResult(defaultResult, {
        source: "default",
        statusMessage: "Published schedule was unavailable, so the fallback schedule was loaded.",
        statusTone: "info",
      });
    } catch {
      return {
        hasLocalAutosave: false,
        hasUnexportedChanges: false,
        localSaveError: "",
        localSavedAt: "",
        localStorageAvailable: true,
        schedule: structuredClone(sampleSchedule),
        shouldSaveLocalCopy: false,
        source: "sample",
        statusMessage: "Published and fallback schedule files were unavailable, so sample data was loaded.",
        statusTone: "info",
      };
    }
  }
}

async function loadEditorStartupSchedule() {
  const local = loadLocalAutosave();

  if (local.found && local.isValid) {
    return {
      hasLocalAutosave: true,
      hasUnexportedChanges: Boolean(local.dirty),
      localSaveError: "",
      localSavedAt: local.savedAt,
      localStorageAvailable: local.isAvailable,
      schedule: local.schedule,
      shouldSaveLocalCopy: false,
      source: "local",
      statusMessage: local.warnings?.length
        ? `Loaded local autosave. ${local.warnings.join(" ")}`
        : "",
      statusTone: "info",
    };
  }

  const localWarning = local.found && !local.isValid
    ? `Local autosave could not be loaded: ${local.errors.slice(0, 3).join(" ")} `
    : "";

  try {
    const publishedResult = await loadPublishedScheduleFile();

    return {
      hasLocalAutosave: false,
      hasUnexportedChanges: false,
      localSaveError: localWarning.trim(),
      localSavedAt: "",
      localStorageAvailable: local.isAvailable !== false,
      schedule: publishedResult.schedule,
      shouldSaveLocalCopy: true,
      source: "published",
      statusMessage: `${localWarning}Loaded published schedule.`,
      statusTone: localWarning ? "info" : "success",
    };
  } catch {
    try {
      const defaultResult = await loadDefaultScheduleFile();

      return {
        hasLocalAutosave: false,
        hasUnexportedChanges: false,
        localSaveError: localWarning.trim(),
        localSavedAt: "",
        localStorageAvailable: local.isAvailable !== false,
        schedule: defaultResult.schedule,
        shouldSaveLocalCopy: true,
        source: "default",
        statusMessage: `${localWarning}Published schedule was unavailable, so the fallback schedule was loaded.`,
        statusTone: "info",
      };
    } catch {
      return {
        hasLocalAutosave: false,
        hasUnexportedChanges: false,
        localSaveError: localWarning.trim(),
        localSavedAt: "",
        localStorageAvailable: local.isAvailable !== false,
        schedule: structuredClone(sampleSchedule),
        shouldSaveLocalCopy: true,
        source: "sample",
        statusMessage: `${localWarning}Published and fallback schedule files were unavailable, so sample data was loaded.`,
        statusTone: "info",
      };
    }
  }
}

function createFileStartupResult(result, { source, statusMessage, statusTone }) {
  return {
    hasLocalAutosave: false,
    hasUnexportedChanges: false,
    localSaveError: "",
    localSavedAt: "",
    localStorageAvailable: true,
    schedule: result.schedule,
    shouldSaveLocalCopy: false,
    source,
    statusMessage,
    statusTone,
  };
}

// Static schedule published for read-only viewers. This is temporary until a
// backend, Box, or database becomes the shared source of truth.
async function loadPublishedScheduleFile() {
  return loadScheduleFile(PUBLISHED_SCHEDULE_URL, "Published schedule file");
}

// Fallback/sample deployment data kept separate from the published schedule.
async function loadDefaultScheduleFile() {
  return loadScheduleFile(DEFAULT_SCHEDULE_URL, "Default schedule file");
}

async function loadScheduleFile(url, label) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`${label} could not be loaded.`);
  }

  const result = parseScheduleJson(await response.text());

  if (!result.isValid) {
    throw new Error(result.errors.join(" "));
  }

  return result;
}

async function handleLoadDefaultSchedule() {
  if (state.readOnly) {
    return;
  }

  const confirmed = globalThis.confirm(
    "Load the default schedule? This will replace the current in-memory schedule and local autosave.",
  );

  if (!confirmed) {
    return;
  }

  try {
    const result = await loadDefaultScheduleFile();

    state.startupSource = "default";
    commitScheduleLoaded(result.schedule, { preserveScroll: false });
    showFileStatus("Default schedule loaded. Local autosave was updated.", "success");
  } catch {
    showFileStatus("Default schedule could not be loaded. Check data/default-schedule.json.", "error");
  }
}

function renderApp(options = {}) {
  const {
    preserveScroll = true,
    scrollToDate = "",
    scrollToToday = false,
  } = options;
  const scrollPositions = preserveScroll ? captureHorizontalScrollPositions() : new Map();
  const dailyTotals = calculateDailyTotals(
    schedule.workers,
    schedule.shifts,
    schedule.weekStartDate,
    schedule.settings,
  );
  const weeklyTotals = calculateWeeklyTotals(schedule.workers, dailyTotals);

  syncModeControls();
  document.body.dataset.viewMode = state.viewMode;
  weekRangeLabel.textContent = formatWeekRange(schedule.weekStartDate);

  for (const button of viewModeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.viewMode === state.viewMode));
  }

  if (state.readOnly && schedule.settings.viewerWarningsEnabled === false) {
    scheduleWarnings.replaceChildren();
    scheduleWarnings.hidden = true;
  } else {
    renderScheduleWarnings(scheduleWarnings, schedule, dailyTotals, weeklyTotals);
  }
  renderScheduleBoard(scheduleBoard, schedule, dailyTotals, {
    onAddDeskCoverage: handleAddDeskCoverage,
    onAddShift: handleAddShift,
    onChangeDeskCoverage: handleChangeDeskCoverage,
    onChangeShift: handleChangeShift,
    onDuplicateDeskCoverage: handleDuplicateDeskCoverage,
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
  updatePersistenceStatus();

  if (preserveScroll) {
    restoreHorizontalScrollPositions(scrollPositions);
  }

  if (scrollToDate) {
    scrollToDateSection(scrollToDate);
  } else if (scrollToToday) {
    scrollToTodaySection();
  }
}

function commitScheduleChange(nextSchedule, renderOptions = { preserveScroll: true }) {
  schedule = nextSchedule;
  saveCurrentScheduleLocally({ dirty: true });
  renderApp(renderOptions);
}

function commitScheduleState(nextSchedule, renderOptions = { preserveScroll: true }) {
  schedule = nextSchedule;
  saveCurrentScheduleLocally({ dirty: state.hasUnexportedChanges });
  renderApp(renderOptions);
}

function commitScheduleLoaded(nextSchedule, renderOptions = { preserveScroll: false }) {
  schedule = nextSchedule;
  state.hasUnexportedChanges = false;
  saveCurrentScheduleLocally({ dirty: false });
  renderApp(renderOptions);
}

function saveCurrentScheduleLocally({ dirty = state.hasUnexportedChanges } = {}) {
  if (state.readOnly) {
    return;
  }

  const result = saveLocalAutosave(schedule, { dirty });

  state.hasUnexportedChanges = Boolean(dirty);

  if (result.ok) {
    state.hasLocalAutosave = true;
    state.localSavedAt = result.savedAt;
    state.localSaveError = "";
    state.localStorageAvailable = true;
  } else {
    state.localSaveError = result.error;
    state.localStorageAvailable = false;
  }

  updatePersistenceStatus();
}

function markScheduleExported() {
  state.hasUnexportedChanges = false;
  markLocalAutosaveExported();
  updatePersistenceStatus();
}

function updatePersistenceStatus() {
  if (!autosaveStatus || !exportReminder) {
    return;
  }

  const sourceLabel = getStartupSourceLabel();

  if (state.readOnly) {
    autosaveStatus.textContent = `Read only. Showing ${sourceLabel}.`;
    exportReminder.textContent = "Viewer Mode cannot edit, drag, resize, or import schedule data.";
    exportReminder.dataset.tone = "info";

    if (localSaveNote) {
      localSaveNote.textContent = "Calendar downloads are one-time snapshots and do not update automatically.";
    }
    return;
  }

  if (localSaveNote) {
    localSaveNote.textContent = "Export JSON to back up or share the schedule. Local autosave is not shared across computers or browsers.";
  }

  if (state.localSaveError) {
    autosaveStatus.textContent = state.localSaveError;
    autosaveStatus.dataset.tone = "error";
  } else if (state.hasLocalAutosave && state.localSavedAt) {
    autosaveStatus.textContent = `Last saved locally: ${formatLocalSaveTime(state.localSavedAt)}`;
    autosaveStatus.dataset.tone = "success";
  } else if (state.localStorageAvailable) {
    autosaveStatus.textContent = `Loaded ${sourceLabel}. Local autosave will start after the next change.`;
    autosaveStatus.dataset.tone = "info";
  } else {
    autosaveStatus.textContent = "Local autosave is not available in this browser.";
    autosaveStatus.dataset.tone = "error";
  }

  if (state.hasUnexportedChanges) {
    exportReminder.textContent = "Unsaved changes - open Settings -> Data / Backup -> Export JSON.";
    exportReminder.dataset.tone = "warning";
  } else {
    exportReminder.textContent = "Changes are saved only in this browser on this computer until you export JSON.";
    exportReminder.dataset.tone = "info";
  }
}

function getStartupSourceLabel() {
  if (state.startupSource === "local") {
    return "local autosave";
  }

  if (state.startupSource === "default") {
    return "the fallback schedule";
  }

  if (state.startupSource === "published") {
    return "the published schedule";
  }

  if (state.startupSource === "import") {
    return "the imported schedule";
  }

  return "sample data";
}

function formatLocalSaveTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat([], {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
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
    commitScheduleChange(
      updateOnCallAssignment(schedule, result.assignment),
      { preserveScroll: true },
    );
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
    commitScheduleChange(
      addShifts(addShift(schedule, result.shift), [
        ...repeatedShifts,
        ...copiedShifts,
      ]),
      { preserveScroll: true },
    );
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
    commitScheduleChange(
      addDeskCoverageItems(addDeskCoverage(schedule, result.coverage), [
        ...buildRepeatedDeskCoverageCopies(schedule, result.coverage, result.repeat),
      ]),
      { preserveScroll: true },
    );
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
    const updatedSchedule = updateShift(schedule, result.shift);

    commitScheduleChange(
      addShifts(
        updatedSchedule,
        [
          ...buildRepeatedShiftCopies(schedule, result.shift, result.repeat),
          ...buildWorkerCopies(result.shift, result.copy),
        ],
      ),
      { preserveScroll: true },
    );
  }

  if (result.action === "copy") {
    commitScheduleChange(
      addShifts(schedule, buildWorkerCopies(result.shift, result.copy)),
      { preserveScroll: true },
    );
  }

  if (result.action === "delete") {
    commitScheduleChange(
      deleteShift(schedule, result.shiftId),
      { preserveScroll: true },
    );
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
    const updatedSchedule = updateDeskCoverage(schedule, result.coverage);

    commitScheduleChange(
      addDeskCoverageItems(
        updatedSchedule,
        buildRepeatedDeskCoverageCopies(schedule, result.coverage, result.repeat),
      ),
      { preserveScroll: true },
    );
  }

  if (result.action === "delete") {
    commitScheduleChange(
      deleteDeskCoverage(schedule, result.coverageId),
      { preserveScroll: true },
    );
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

  commitScheduleChange(
    updateShift(schedule, {
      ...shift,
      ...changes,
    }),
    { preserveScroll: true },
  );
}

function handleChangeDeskCoverage({ coverageId, changes }) {
  if (state.readOnly) {
    return;
  }

  const coverage = (schedule.deskCoverage ?? []).find((item) => item.id === coverageId);

  if (!coverage) {
    return;
  }

  commitScheduleChange(
    updateDeskCoverage(schedule, {
      ...coverage,
      ...changes,
    }),
    { preserveScroll: true },
  );
}

function handleDuplicateDeskCoverage({ coverageId, changes }) {
  if (state.readOnly) {
    return;
  }

  const coverage = (schedule.deskCoverage ?? []).find((item) => item.id === coverageId);

  if (!coverage) {
    return;
  }

  commitScheduleChange(
    addDeskCoverage(schedule, copyDeskCoverage(schedule, coverage, changes)),
    { preserveScroll: true },
  );
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

  commitScheduleChange(
    addShift(schedule, copyShift(schedule, shift, changes)),
    { preserveScroll: true },
  );
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

async function handleImportFile(event) {
  const input = event?.currentTarget ?? importJsonInput;
  const file = input?.files?.[0];

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

    state.startupSource = "import";
    commitScheduleLoaded(result.schedule, { preserveScroll: false });

    const warnings = result.warnings?.length ? ` ${result.warnings.join(" ")}` : "";
    showFileStatus(`Imported ${file.name}.${warnings}`, "success");
  } catch {
    showFileStatus("Import failed. Please choose a valid schedule JSON file.", "error");
  } finally {
    if (input) {
      input.value = "";
    }
  }
}

function syncModeControls() {
  document.body.dataset.appMode = state.readOnly ? "viewer" : "editor";

  if (viewerModeIndicator) {
    viewerModeIndicator.hidden = !state.readOnly;
  }

  if (settingsButton) {
    settingsButton.hidden = state.readOnly;
    settingsButton.disabled = state.readOnly;
  }

  if (adminActionsGroup) {
    adminActionsGroup.hidden = state.readOnly;
  }

  if (viewerActionsGroup) {
    viewerActionsGroup.hidden = !state.readOnly;
  }

  if (calendarDownloadButton) {
    calendarDownloadButton.hidden = !state.readOnly;
    calendarDownloadButton.disabled = !state.readOnly;
  }
}

function captureHorizontalScrollPositions() {
  const positions = new Map();

  for (const section of scheduleBoard.querySelectorAll(".day-section[data-date]")) {
    const scrollFrame = section.querySelector(".schedule-scroll-frame");

    if (scrollFrame) {
      positions.set(section.dataset.date, scrollFrame.scrollLeft);
    }
  }

  return positions;
}

function restoreHorizontalScrollPositions(positions) {
  for (const section of scheduleBoard.querySelectorAll(".day-section[data-date]")) {
    const scrollFrame = section.querySelector(".schedule-scroll-frame");
    const scrollLeft = positions.get(section.dataset.date);

    if (scrollFrame && Number.isFinite(scrollLeft)) {
      scrollFrame.scrollLeft = scrollLeft;
    }
  }
}

function scrollToTodaySection() {
  scrollToDateSection(getTodayIsoDate());
}

function scrollToDateSection(isoDate) {
  const section = scheduleBoard.querySelector(`.day-section[data-date="${isoDate}"]`);

  section?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function showFileStatus(message, tone = "info") {
  clearFileStatusTimer();
  fileStatus.textContent = message;
  fileStatus.dataset.tone = tone;
  fileStatus.hidden = false;

  if (AUTO_DISMISS_STATUS_TONES.has(tone)) {
    fileStatusTimer = window.setTimeout(() => {
      if (fileStatus.textContent === message && fileStatus.dataset.tone === tone) {
        clearFileStatus();
      }
    }, STATUS_AUTO_DISMISS_MS);
  }
}

function clearFileStatus() {
  clearFileStatusTimer();
  fileStatus.textContent = "";
  delete fileStatus.dataset.tone;
  fileStatus.hidden = true;
}

function clearFileStatusTimer() {
  if (fileStatusTimer) {
    window.clearTimeout(fileStatusTimer);
    fileStatusTimer = null;
  }
}

function getRequiredElement(selector) {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Required page element is missing: ${selector}`);
  }

  return element;
}

function getOptionalElement(selector) {
  return document.querySelector(selector);
}

function getRequiredElements(selector) {
  const elements = [...document.querySelectorAll(selector)];

  if (elements.length === 0) {
    throw new Error(`Required page elements are missing: ${selector}`);
  }

  return elements;
}

function addOptionalListener(element, eventName, handler) {
  if (element) {
    element.addEventListener(eventName, handler);
  }
}

function isIsoDateValue(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
}

function isViewerModeFromUrl() {
  const mode = new URLSearchParams(window.location.search).get("mode")?.toLowerCase();

  return ["view", "viewer", "readonly", "read-only"].includes(mode);
}

function renderScheduleWarnings(container, currentSchedule, dailyTotals = {}, weeklyTotals = {}) {
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
  const dailyMaxWarnings = findDailyMaxHourWarnings(
    currentSchedule.workers,
    dailyTotals,
    weekDates,
    currentSchedule.settings,
  );
  const deskCoverageGapWarnings = findDeskCoverageGapWarnings(
    visibleShifts,
    currentSchedule.deskCoverage ?? [],
    weekDates,
    currentSchedule.settings,
  );

  container.replaceChildren();
  container.hidden =
    overlaps.length === 0 &&
    phoneOverlaps.length === 0 &&
    longWorkWarnings.length === 0 &&
    lateMorningWarnings.length === 0 &&
    weeklyMaxWarnings.length === 0 &&
    dailyMaxWarnings.length === 0 &&
    deskCoverageGapWarnings.length === 0;

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
  const shiftLookup = new Map(visibleShifts.map((shift) => [shift.id, shift]));
  const warningGroups = [
    {
      title: "Shift overlaps",
      warnings: overlaps.map((overlap) => {
        const overlappingShifts = overlap.shiftIds
          .map((shiftId) => shiftLookup.get(shiftId))
          .filter(Boolean);
        const overlapDetails = overlappingShifts.length > 0
          ? ` (${overlappingShifts.map(formatCompactShiftReference).join(" and ")})`
          : "";

        return `${workerNames.get(overlap.workerId) ?? "Unknown worker"} has overlapping shifts on ${dateLabels.get(overlap.date) ?? overlap.date}${overlapDetails}`;
      }),
    },
    {
      title: "Weekly max hours",
      warnings: weeklyMaxWarnings.map((warning) => {
        return `${warning.workerName} is scheduled for ${warning.hours.toFixed(2)} hours this week, which exceeds the ${warning.limit} hour limit`;
      }),
    },
    {
      title: "Daily max hours",
      warnings: dailyMaxWarnings.map((warning) => {
        return `${warning.workerName} is scheduled for ${warning.hours.toFixed(2)} counted hours on ${dateLabels.get(warning.date) ?? warning.date}, which exceeds the ${warning.limit} hour daily limit`;
      }),
    },
    {
      title: "Phone/on-call overlaps",
      warnings: phoneOverlaps.map((overlap) => {
        const workerLabel = overlap.workerIds.map((workerId) => {
          return workerNames.get(workerId) ?? "Unknown worker";
        }).join(" and ");
        const roleLabel = overlap.role === "primary" ? "Primary on-call" : "Backup on-call";

        return `${roleLabel} overlaps on ${dateLabels.get(overlap.date) ?? overlap.date} (${workerLabel}, ${formatTimeForDisplay(overlap.startTime)}-${formatTimeForDisplay(overlap.endTime)})`;
      }),
    },
    {
      title: "Desk coverage gaps",
      warnings: deskCoverageGapWarnings.map((gap) => {
        return `Desk coverage gap on ${dateLabels.get(gap.date) ?? gap.date} from ${formatTimeForDisplay(gap.startTime)} to ${formatTimeForDisplay(gap.endTime)}`;
      }),
    },
    {
      title: "Long consecutive work",
      warnings: longWorkWarnings.map((warning) => {
        return `${workerNames.get(warning.workerId) ?? "Unknown worker"} works ${warning.hours.toFixed(2)} consecutive hours on ${dateLabels.get(warning.date) ?? warning.date} (${formatTimeForDisplay(warning.startTime)}-${formatTimeForDisplay(warning.endTime)})`;
      }),
    },
    {
      title: "Late-night/morning turnaround",
      warnings: lateMorningWarnings.map((warning) => {
        return `${workerNames.get(warning.workerId) ?? "Unknown worker"} works late on ${dateLabels.get(warning.lateDate) ?? warning.lateDate} until ${formatTimeForDisplay(warning.lateEndTime)} and starts again ${dateLabels.get(warning.nextDate) ?? warning.nextDate} at ${formatTimeForDisplay(warning.earlyStartTime)}`;
      }),
    },
  ].filter((group) => group.warnings.length > 0);

  for (const group of warningGroups) {
    appendWarningGroup(container, group);
  }
}

function appendWarningGroup(container, { title, warnings }) {
  const group = document.createElement("section");
  group.className = "warning-group";

  if (warnings.length === 1) {
  group.classList.add("is-single");

  const warning = document.createElement("p");
  warning.textContent = `• ${title}: ${ensureSentence(warnings[0])}`;
  group.append(warning);
  container.append(group);
  return;
}

  const button = document.createElement("button");
  const list = document.createElement("ul");
  const listId = `warning-list-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  button.type = "button";
  button.className = "warning-group-toggle";
  button.setAttribute("aria-controls", listId);

  list.id = listId;
  list.className = "warning-list";

  for (const warningText of warnings) {
    const item = document.createElement("li");
    item.textContent = ensureSentence(warningText);
    list.append(item);
  }

  const setExpanded = (isExpanded) => {
    button.setAttribute("aria-expanded", String(isExpanded));
    group.classList.toggle("is-expanded", isExpanded);
    list.hidden = !isExpanded;
    button.textContent = isExpanded
      ? `v ${title}`
      : `> ${title}: ${ensureSentence(warnings[0])} + ${warnings.length - 1} more`;
  };

  button.addEventListener("click", () => {
    setExpanded(button.getAttribute("aria-expanded") !== "true");
  });

  setExpanded(false);
  group.append(button, list);
  container.append(group);
}

function formatCompactShiftReference(shift) {
  const label = shift.label || shift.shiftType || "Shift";
  return `${label} ${formatTimeForDisplay(shift.startTime)}-${formatTimeForDisplay(shift.endTime)}`;
}

function ensureSentence(value) {
  const text = String(value ?? "").trim();

  if (!text || /[.!?]$/.test(text)) {
    return text;
  }

  return `${text}.`;
}

initializeApp();
