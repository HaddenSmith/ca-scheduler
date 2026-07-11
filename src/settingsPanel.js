import { formatTimeForDisplay, WEEKDAY_NAMES } from "./dateUtils.js";
import { DEFAULT_SETTINGS, DEFAULT_SHIFT_COLORS } from "./model.js";
import { minutesToTimeValue, parseTimeInput, timeToMinutes } from "./timeUtils.js";

const SLOT_OPTIONS = [15, 30, 60];
const COLOR_FIELDS = [
  { key: "Check In", label: "Check In" },
  { key: "Check Out", label: "Check Out / Checkout-Project", linkedKeys: ["Check Out", "Checkout/Project"] },
  { key: "Roving", label: "Roving" },
  { key: "Projects", label: "Projects" },
  { key: "Staff Meeting", label: "Staff Meeting" },
  { key: "Desk", label: "Desk" },
  { key: "Class", label: "Class" },
  { key: "On Call", label: "On Call / Backup On Call", linkedKeys: ["On Call", "Backup On Call"] },
  { key: "Desk Coverage", label: "Desk Coverage" },
  { key: "OFF", label: "OFF" },
];

let settingsElements;
let activeContext;
let activeResolve;

export function openSettingsPanel(schedule) {
  settingsElements = settingsElements ?? createSettingsElements();

  if (activeResolve) {
    closeSettings({ action: "cancel", settings: null });
  }

  activeContext = {
    schedule,
    settings: {
      ...DEFAULT_SETTINGS,
      ...schedule.settings,
      shiftColors: {
        ...DEFAULT_SHIFT_COLORS,
        ...(schedule.settings.shiftColors ?? {}),
      },
    },
  };

  populateSettingsForm();
  settingsElements.backdrop.classList.remove("is-hidden");
  getField("slotMinutes").focus();

  return new Promise((resolve) => {
    activeResolve = resolve;
  });
}

function createSettingsElements() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop is-hidden";
  backdrop.innerHTML = `
    <section class="shift-editor settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header class="shift-editor-header">
        <div>
          <p class="eyebrow">Schedule</p>
          <h2 id="settings-title">Settings</h2>
        </div>
        <button type="button" class="icon-button" data-settings-action="cancel" aria-label="Close settings">x</button>
      </header>

      <form class="shift-editor-form" novalidate>
        <div class="form-errors" aria-live="polite" hidden></div>

        <fieldset class="settings-fieldset">
          <legend>Schedule Settings</legend>

          <div class="form-grid">
            <label>
              <span>Time Increment</span>
              <select name="slotMinutes"></select>
            </label>

            <label>
              <span>Week Start Day</span>
              <select name="weekStartsOn"></select>
            </label>
          </div>

          <div class="form-grid">
            <label>
              <span>Visible Day Start</span>
              <input name="startTime" type="text" list="settings-time-options" inputmode="numeric" required />
            </label>

            <label>
              <span>Visible Day End</span>
              <input name="endTime" type="text" list="settings-time-options" inputmode="numeric" required />
            </label>
          </div>
        </fieldset>

        <datalist id="settings-time-options"></datalist>

        <fieldset class="settings-fieldset">
          <legend>Warning Settings</legend>

          <div class="warning-settings-grid">
            <section class="warning-setting-card">
              <label class="checkbox-row">
                <input name="viewerWarningsEnabled" type="checkbox" />
                <span>Show warnings in Viewer Mode</span>
              </label>
            </section>

            <section class="warning-setting-card">
              <label class="checkbox-row">
                <input name="weeklyMaxHoursWarningEnabled" type="checkbox" />
                <span>Weekly max hours</span>
              </label>
              <label>
                <span>Max Weekly Hours per Worker</span>
                <input name="maxWeeklyHours" type="number" min="1" max="168" step="0.25" />
              </label>
            </section>

            <section class="warning-setting-card">
              <label class="checkbox-row">
                <input name="dailyMaxHoursWarningEnabled" type="checkbox" />
                <span>Daily max hours</span>
              </label>
              <label>
                <span>Max Daily Hours per Worker</span>
                <input name="maxDailyHours" type="number" min="1" max="24" step="0.25" />
              </label>
            </section>

            <section class="warning-setting-card">
              <label class="checkbox-row">
                <input name="longShiftWarningEnabled" type="checkbox" />
                <span>Long consecutive work</span>
              </label>
              <div class="form-grid compact-form-grid">
                <label>
                  <span>Max Consecutive Work Hours</span>
                  <input name="maxConsecutiveWorkHours" type="number" min="1" max="24" step="0.25" />
                </label>

                <label>
                  <span>Required Break Minutes</span>
                  <input name="requiredBreakMinutes" type="number" min="0" max="240" step="5" />
                </label>
              </div>
            </section>

            <section class="warning-setting-card">
              <label class="checkbox-row">
                <input name="lateNightWarningEnabled" type="checkbox" />
                <span>Late-night/morning turnaround</span>
              </label>
              <div class="form-grid compact-form-grid">
                <label>
                  <span>Late-Night Threshold</span>
                  <input name="lateNightThreshold" type="text" list="settings-time-options" inputmode="numeric" />
                </label>

                <label>
                  <span>Early-Morning Threshold</span>
                  <input name="earlyMorningThreshold" type="text" list="settings-time-options" inputmode="numeric" />
                </label>
              </div>
            </section>

            <section class="warning-setting-card">
              <label class="checkbox-row">
                <input name="deskCoverageGapWarningEnabled" type="checkbox" />
                <span>Desk coverage gaps</span>
              </label>
              <div class="form-grid compact-form-grid">
                <label>
                  <span>Required Desk Start</span>
                  <input name="deskCoverageRequiredStartTime" type="text" list="settings-time-options" inputmode="numeric" />
                </label>

                <label>
                  <span>Required Desk End</span>
                  <input name="deskCoverageRequiredEndTime" type="text" list="settings-time-options" inputmode="numeric" />
                </label>
              </div>
            </section>
          </div>
        </fieldset>

        <fieldset class="settings-fieldset">
          <legend>Default Shift Colors</legend>
          <div class="color-settings-grid"></div>
        </fieldset>

        <fieldset class="settings-fieldset settings-actions-section">
          <legend>Workers</legend>
          <p class="field-help">Add, rename, remove, or drag workers into schedule column order.</p>
          <button type="button" class="secondary-button" data-settings-action="manage-workers">Manage Workers</button>
        </fieldset>

        <fieldset class="settings-fieldset settings-actions-section">
          <legend>Data / Backup</legend>
          <p class="field-help">Local autosave stays in this browser. Export JSON to back up or share the schedule.</p>
          <div class="settings-action-grid">
            <button type="button" class="secondary-button" data-settings-action="import-json">Import JSON</button>
            <button type="button" class="secondary-button" data-settings-action="export-json">Export JSON</button>
            <button type="button" class="secondary-button" data-settings-action="clear-autosave">Clear Local Autosave</button>
            <button type="button" class="danger-button subtle-danger-button" data-settings-action="load-default">Load Default Schedule</button>
          </div>
        </fieldset>

        <footer class="shift-editor-actions align-end">
          <div>
            <button type="button" class="secondary-button" data-settings-action="cancel">Cancel</button>
            <button type="submit" class="primary-button">Save Settings</button>
          </div>
        </footer>
      </form>
    </section>
  `;

  const form = backdrop.querySelector("form");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const result = readSettingsForm();

    if (result.errors.length > 0) {
      showErrors(result.errors);
      return;
    }

    closeSettings({ action: "save", settings: result.settings });
  });

  for (const button of backdrop.querySelectorAll('[data-settings-action="cancel"]')) {
    button.addEventListener("click", () => closeSettings({ action: "cancel", settings: null }));
  }

  for (const action of ["manage-workers", "import-json", "export-json", "clear-autosave", "load-default"]) {
    backdrop.querySelector(`[data-settings-action="${action}"]`).addEventListener("click", () => {
      closeSettings({ action, settings: null });
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.classList.contains("is-hidden")) {
      closeSettings({ action: "cancel", settings: null });
    }
  });

  document.body.append(backdrop);

  return {
    backdrop,
    colorGrid: backdrop.querySelector(".color-settings-grid"),
    errors: backdrop.querySelector(".form-errors"),
    form,
    timeOptions: backdrop.querySelector("#settings-time-options"),
  };
}

function populateSettingsForm() {
  const settings = activeContext.settings;

  clearErrors();
  fillSelect(
    getField("slotMinutes"),
    SLOT_OPTIONS.map((value) => ({ value: String(value), label: `${value} minutes` })),
  );
  fillSelect(
    getField("weekStartsOn"),
    WEEKDAY_NAMES.map((label, value) => ({ value: String(value), label })),
  );
  fillDatalist(settingsElements.timeOptions, buildFullDayTimeOptions());
  renderColorFields(settings);

  getField("slotMinutes").value = String(settings.slotMinutes);
  getField("weekStartsOn").value = String(settings.weekStartsOn);
  getField("startTime").value = formatTimeForDisplay(settings.startTime);
  getField("endTime").value = formatTimeForDisplay(settings.endTime);
  getField("viewerWarningsEnabled").checked = settings.viewerWarningsEnabled !== false;
  getField("weeklyMaxHoursWarningEnabled").checked = settings.weeklyMaxHoursWarningEnabled !== false;
  getField("maxWeeklyHours").value = String(settings.maxWeeklyHours ?? DEFAULT_SETTINGS.maxWeeklyHours);
  getField("dailyMaxHoursWarningEnabled").checked = settings.dailyMaxHoursWarningEnabled !== false;
  getField("maxDailyHours").value = String(settings.maxDailyHours ?? DEFAULT_SETTINGS.maxDailyHours);
  getField("longShiftWarningEnabled").checked = settings.longShiftWarningEnabled !== false;
  getField("maxConsecutiveWorkHours").value = String(settings.maxConsecutiveWorkHours ?? DEFAULT_SETTINGS.maxConsecutiveWorkHours);
  getField("requiredBreakMinutes").value = String(settings.requiredBreakMinutes ?? DEFAULT_SETTINGS.requiredBreakMinutes);
  getField("lateNightWarningEnabled").checked = settings.lateNightWarningEnabled !== false;
  getField("lateNightThreshold").value = formatTimeForDisplay(settings.lateNightThreshold ?? DEFAULT_SETTINGS.lateNightThreshold);
  getField("earlyMorningThreshold").value = formatTimeForDisplay(settings.earlyMorningThreshold ?? DEFAULT_SETTINGS.earlyMorningThreshold);
  getField("deskCoverageGapWarningEnabled").checked = settings.deskCoverageGapWarningEnabled !== false;
  getField("deskCoverageRequiredStartTime").value = formatTimeForDisplay(settings.deskCoverageRequiredStartTime ?? DEFAULT_SETTINGS.deskCoverageRequiredStartTime);
  getField("deskCoverageRequiredEndTime").value = formatTimeForDisplay(settings.deskCoverageRequiredEndTime ?? DEFAULT_SETTINGS.deskCoverageRequiredEndTime);
}

function readSettingsForm() {
  const errors = [];
  const startResult = parseTimeInput(getField("startTime").value);
  const endResult = parseTimeInput(getField("endTime").value);
  const lateNightResult = parseTimeInput(getField("lateNightThreshold").value);
  const earlyMorningResult = parseTimeInput(getField("earlyMorningThreshold").value);
  const deskCoverageStartResult = parseTimeInput(getField("deskCoverageRequiredStartTime").value);
  const deskCoverageEndResult = parseTimeInput(getField("deskCoverageRequiredEndTime").value);
  const slotMinutes = Number(getField("slotMinutes").value);
  const weekStartsOn = Number(getField("weekStartsOn").value);
  const maxWeeklyHours = Number(getField("maxWeeklyHours").value);
  const maxDailyHours = Number(getField("maxDailyHours").value);
  const maxConsecutiveWorkHours = Number(getField("maxConsecutiveWorkHours").value);
  const requiredBreakMinutes = Number(getField("requiredBreakMinutes").value);

  if (!SLOT_OPTIONS.includes(slotMinutes)) {
    errors.push("Choose a valid time increment.");
  }

  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    errors.push("Choose a valid week start day.");
  }

  if (!startResult.isValid) {
    errors.push(`Start time: ${startResult.error}`);
  }

  if (!endResult.isValid) {
    errors.push(`End time: ${endResult.error}`);
  }

  if (startResult.isValid && endResult.isValid && timeToMinutes(startResult.value) === timeToMinutes(endResult.value)) {
    errors.push("Visible day start and end cannot be the same time.");
  }

  if (!Number.isFinite(maxWeeklyHours) || maxWeeklyHours <= 0) {
    errors.push("Max weekly hours must be greater than 0.");
  }

  if (!Number.isFinite(maxDailyHours) || maxDailyHours <= 0) {
    errors.push("Max daily hours must be greater than 0.");
  }

  if (!Number.isFinite(maxConsecutiveWorkHours) || maxConsecutiveWorkHours <= 0) {
    errors.push("Max consecutive work hours must be greater than 0.");
  }

  if (!Number.isFinite(requiredBreakMinutes) || requiredBreakMinutes < 0) {
    errors.push("Required break minutes must be 0 or greater.");
  }

  if (!lateNightResult.isValid) {
    errors.push(`Late-night threshold: ${lateNightResult.error}`);
  }

  if (!earlyMorningResult.isValid) {
    errors.push(`Early-morning threshold: ${earlyMorningResult.error}`);
  }

  if (!deskCoverageStartResult.isValid) {
    errors.push(`Required desk coverage start: ${deskCoverageStartResult.error}`);
  }

  if (!deskCoverageEndResult.isValid) {
    errors.push(`Required desk coverage end: ${deskCoverageEndResult.error}`);
  }

  if (
    deskCoverageStartResult.isValid &&
    deskCoverageEndResult.isValid &&
    timeToMinutes(deskCoverageStartResult.value) === timeToMinutes(deskCoverageEndResult.value)
  ) {
    errors.push("Required desk coverage start and end cannot be the same time.");
  }

  const shiftColors = {
    ...DEFAULT_SHIFT_COLORS,
    ...(activeContext.settings.shiftColors ?? {}),
  };

  for (const field of COLOR_FIELDS) {
    const color = getField(`color-${field.key}`).value;

    for (const key of field.linkedKeys ?? [field.key]) {
      shiftColors[key] = color;
    }
  }

  return {
    errors,
    settings: {
      ...activeContext.settings,
      startTime: startResult.isValid ? startResult.value : activeContext.settings.startTime,
      endTime: endResult.isValid ? endResult.value : activeContext.settings.endTime,
      slotMinutes,
      weekStartsOn,
      viewerWarningsEnabled: getField("viewerWarningsEnabled").checked,
      weeklyMaxHoursWarningEnabled: getField("weeklyMaxHoursWarningEnabled").checked,
      maxWeeklyHours: Number.isFinite(maxWeeklyHours)
        ? maxWeeklyHours
        : activeContext.settings.maxWeeklyHours,
      dailyMaxHoursWarningEnabled: getField("dailyMaxHoursWarningEnabled").checked,
      maxDailyHours: Number.isFinite(maxDailyHours)
        ? maxDailyHours
        : activeContext.settings.maxDailyHours,
      longShiftWarningEnabled: getField("longShiftWarningEnabled").checked,
      maxConsecutiveWorkHours: Number.isFinite(maxConsecutiveWorkHours)
        ? maxConsecutiveWorkHours
        : activeContext.settings.maxConsecutiveWorkHours,
      requiredBreakMinutes: Number.isFinite(requiredBreakMinutes)
        ? requiredBreakMinutes
        : activeContext.settings.requiredBreakMinutes,
      lateNightWarningEnabled: getField("lateNightWarningEnabled").checked,
      lateNightThreshold: lateNightResult.isValid
        ? lateNightResult.value
        : activeContext.settings.lateNightThreshold,
      earlyMorningThreshold: earlyMorningResult.isValid
        ? earlyMorningResult.value
        : activeContext.settings.earlyMorningThreshold,
      deskCoverageGapWarningEnabled: getField("deskCoverageGapWarningEnabled").checked,
      deskCoverageRequiredStartTime: deskCoverageStartResult.isValid
        ? deskCoverageStartResult.value
        : activeContext.settings.deskCoverageRequiredStartTime,
      deskCoverageRequiredEndTime: deskCoverageEndResult.isValid
        ? deskCoverageEndResult.value
        : activeContext.settings.deskCoverageRequiredEndTime,
      shiftColors,
    },
  };
}

function renderColorFields(settings) {
  settingsElements.colorGrid.replaceChildren();

  for (const field of COLOR_FIELDS) {
    const label = document.createElement("label");
    const text = document.createElement("span");
    const input = document.createElement("input");

    text.textContent = field.label;
    input.name = `color-${field.key}`;
    input.type = "color";
    input.value = settings.shiftColors?.[field.key] ?? DEFAULT_SHIFT_COLORS[field.key];

    label.append(text, input);
    settingsElements.colorGrid.append(label);
  }
}

function closeSettings(result) {
  settingsElements.backdrop.classList.add("is-hidden");
  clearErrors();

  const resolve = activeResolve;
  activeContext = null;
  activeResolve = null;

  if (resolve) {
    resolve(result);
  }
}

function getField(name) {
  return settingsElements.form.querySelector(`[name="${name}"]`);
}

function fillSelect(select, options) {
  select.replaceChildren();

  for (const option of options) {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    select.append(node);
  }
}

function fillDatalist(datalist, options) {
  datalist.replaceChildren();

  for (const option of options) {
    const node = document.createElement("option");
    node.value = option.value;
    datalist.append(node);
  }
}

function buildFullDayTimeOptions() {
  const options = [];

  for (let minute = 0; minute < 24 * 60; minute += 15) {
    options.push(formatTimeForDisplay(minutesToTimeValue(minute)));
  }

  return options;
}

function showErrors(errors) {
  settingsElements.errors.replaceChildren();

  for (const error of errors) {
    const item = document.createElement("p");
    item.textContent = error;
    settingsElements.errors.append(item);
  }

  settingsElements.errors.hidden = false;
}

function clearErrors() {
  settingsElements.errors.replaceChildren();
  settingsElements.errors.hidden = true;
}
