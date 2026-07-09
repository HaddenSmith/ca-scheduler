import {
  WEEKDAY_NAMES,
  buildWeekDates,
  formatTimeForDisplay,
  parseIsoDate,
} from "./dateUtils.js";
import { MAX_REPEAT_OCCURRENCES, getRepeatOccurrenceDates } from "./repeatShifts.js";
import { buildTimeInputOptions, normalizeScheduleTimeInput, timeToDisplayMinutes } from "./timeUtils.js";

let editorElements;
let activeContext;
let activeResolve;

const REPEAT_OPTIONS = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

export function openDeskCoverageEditor({ mode, schedule, coverage }) {
  editorElements = editorElements ?? createEditorElements();

  if (activeResolve) {
    closeEditor({ action: "cancel", coverage: null });
  }

  activeContext = {
    mode,
    schedule,
    coverage,
  };

  populateForm();
  editorElements.backdrop.classList.remove("is-hidden");
  getField("startTime").focus();

  return new Promise((resolve) => {
    activeResolve = resolve;
  });
}

function createEditorElements() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop is-hidden";
  backdrop.innerHTML = `
    <section class="shift-editor compact-editor" role="dialog" aria-modal="true" aria-labelledby="desk-coverage-title">
      <header class="shift-editor-header">
        <div>
          <p class="eyebrow">Desk Coverage</p>
          <h2 id="desk-coverage-title">Edit Desk Coverage</h2>
        </div>
        <button type="button" class="icon-button" data-desk-action="cancel" aria-label="Close desk coverage editor">x</button>
      </header>

      <form class="shift-editor-form" novalidate>
        <div class="form-errors" aria-live="polite" hidden></div>

        <label>
          <span>Date</span>
          <select name="date" required></select>
        </label>

        <div class="form-grid">
          <label>
            <span>Start Time</span>
            <input name="startTime" type="text" list="desk-time-options" inputmode="numeric" required />
          </label>

          <label>
            <span>End Time</span>
            <input name="endTime" type="text" list="desk-time-options" inputmode="numeric" required />
          </label>
        </div>

        <datalist id="desk-time-options"></datalist>

        <div class="form-grid">
          <label>
            <span>Label</span>
            <input name="label" type="text" />
          </label>

          <label>
            <span>Color</span>
            <input name="color" type="color" />
          </label>
        </div>

        <label>
          <span>Notes</span>
          <textarea name="notes" rows="3"></textarea>
        </label>

        <fieldset class="editor-fieldset repeat-section">
          <legend>Repeat</legend>

          <div class="form-grid">
            <label>
              <span>Repeat</span>
              <select name="repeatFrequency"></select>
            </label>

            <label class="repeat-control">
              <span>Repeat Until</span>
              <input name="repeatUntil" type="date" />
            </label>
          </div>

          <div class="form-grid repeat-control">
            <label>
              <span>Max Occurrences</span>
              <input name="repeatMaxOccurrences" type="number" min="1" max="100" step="1" />
            </label>
          </div>

          <div class="repeat-weekday-row" hidden>
            <span>Weekdays</span>
            <div class="weekday-picker"></div>
          </div>
        </fieldset>

        <footer class="shift-editor-actions">
          <button type="button" class="danger-button" data-desk-action="delete">Delete</button>
          <div>
            <button type="button" class="secondary-button" data-desk-action="cancel">Cancel</button>
            <button type="submit" class="primary-button">Save</button>
          </div>
        </footer>
      </form>
    </section>
  `;

  const form = backdrop.querySelector("form");
  const deleteButton = backdrop.querySelector('[data-desk-action="delete"]');

  form.addEventListener("submit", handleSubmit);
  form.querySelector('[name="date"]').addEventListener("change", () => {
    updateRepeatFields();
  });
  form.querySelector('[name="repeatFrequency"]').addEventListener("change", updateRepeatFields);

  for (const fieldName of ["startTime", "endTime"]) {
    form.querySelector(`[name="${fieldName}"]`).addEventListener("blur", () => {
      normalizeTimeField(fieldName);
    });
  }

  for (const button of backdrop.querySelectorAll('[data-desk-action="cancel"]')) {
    button.addEventListener("click", () => closeEditor({ action: "cancel", coverage: null }));
  }

  deleteButton.addEventListener("click", () => {
    closeEditor({ action: "delete", coverageId: activeContext.coverage.id });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.classList.contains("is-hidden")) {
      closeEditor({ action: "cancel", coverage: null });
    }
  });

  document.body.append(backdrop);

  return {
    backdrop,
    deleteButton,
    errors: backdrop.querySelector(".form-errors"),
    form,
    repeatWeekdayRow: backdrop.querySelector(".repeat-weekday-row"),
    saveButton: backdrop.querySelector('button[type="submit"]'),
    timeOptions: backdrop.querySelector("#desk-time-options"),
    title: backdrop.querySelector("#desk-coverage-title"),
  };
}

function populateForm() {
  const { coverage, mode, schedule } = activeContext;
  const isViewMode = mode === "view";

  editorElements.title.textContent = mode === "create"
    ? "Add Desk Coverage"
    : isViewMode
      ? "Desk Coverage Details"
      : "Edit Desk Coverage";
  editorElements.deleteButton.hidden = mode !== "edit";
  editorElements.saveButton.hidden = isViewMode;
  clearErrors();
  fillSelect(
    getField("date"),
    buildWeekDates(schedule.weekStartDate).map((date) => ({
      value: date.isoDate,
      label: `${date.dayName}, ${date.displayDate}`,
    })),
  );
  fillDatalist(editorElements.timeOptions, buildTimeInputOptions(schedule.settings));
  fillSelect(getField("repeatFrequency"), REPEAT_OPTIONS);
  renderWeekdayOptions();

  setValue("date", coverage.date);
  setTimeValue("startTime", coverage.startTime);
  setTimeValue("endTime", coverage.endTime);
  setValue("label", coverage.label || "D");
  setValue("notes", coverage.notes ?? "");
  setValue("color", coverage.color || "#a6a6a6");
  setValue("repeatFrequency", "none");
  setValue("repeatUntil", coverage.date);
  setValue("repeatMaxOccurrences", String(MAX_REPEAT_OCCURRENCES));
  setDefaultWeeklyDay(coverage.date);
  updateRepeatFields();

  for (const field of editorElements.form.querySelectorAll("input, select, textarea")) {
    field.disabled = isViewMode;
  }
}

function handleSubmit(event) {
  event.preventDefault();

  const result = readCoverageFromForm();
  const repeatResult = readRepeatFromForm(result.coverage);
  const errors = [
    ...result.errors,
    ...repeatResult.errors,
  ];

  if (errors.length > 0) {
    showErrors(errors);
    return;
  }

  setTimeValue("startTime", result.coverage.startTime);
  setTimeValue("endTime", result.coverage.endTime);
  closeEditor({ action: "save", coverage: result.coverage, repeat: repeatResult.repeat });
}

function readCoverageFromForm() {
  const errors = [];
  const startResult = normalizeScheduleTimeInput(getField("startTime").value, activeContext.schedule.settings);
  const endResult = normalizeScheduleTimeInput(getField("endTime").value, activeContext.schedule.settings);

  if (!getField("date").value) {
    errors.push("Date is required.");
  }

  if (!startResult.isValid) {
    errors.push(`Start time: ${startResult.error}`);
  }

  if (!endResult.isValid) {
    errors.push(`End time: ${endResult.error}`);
  }

  if (startResult.isValid && endResult.isValid) {
    const start = timeToDisplayMinutes(startResult.value, activeContext.schedule.settings);
    const end = timeToDisplayMinutes(endResult.value, activeContext.schedule.settings);

    if (end <= start) {
      errors.push("End time must be after start time.");
    }
  }

  return {
    errors,
    coverage: {
      ...activeContext.coverage,
      date: getField("date").value,
      startTime: startResult.isValid ? startResult.value : getField("startTime").value.trim(),
      endTime: endResult.isValid ? endResult.value : getField("endTime").value.trim(),
      label: getField("label").value.trim() || "D",
      notes: getField("notes").value.trim(),
      color: getField("color").value || "#a6a6a6",
    },
  };
}

function readRepeatFromForm(coverage) {
  const frequency = getField("repeatFrequency").value;

  if (frequency === "none") {
    return {
      errors: [],
      repeat: null,
    };
  }

  const errors = [];
  const untilDate = getField("repeatUntil").value;
  const maxOccurrences = Number(getField("repeatMaxOccurrences").value);
  const weekdays = getCheckedWeekdays();

  if (!isIsoDate(untilDate)) {
    errors.push("Repeat until date is required.");
  } else if (untilDate < coverage.date) {
    errors.push("Repeat until date must be on or after the desk coverage date.");
  }

  if (!Number.isInteger(maxOccurrences) || maxOccurrences < 1) {
    errors.push("Max occurrences must be at least 1.");
  } else if (maxOccurrences > MAX_REPEAT_OCCURRENCES) {
    errors.push(`Max occurrences cannot be more than ${MAX_REPEAT_OCCURRENCES}.`);
  }

  if (errors.length === 0) {
    const repeatPlan = getRepeatOccurrenceDates({
      frequency,
      maxOccurrences,
      startDate: coverage.date,
      untilDate,
      weekdays,
    });

    if (repeatPlan.exceedsLimit) {
      errors.push(`Repeat would create more than ${maxOccurrences} desk coverage blocks. Shorten the date range or raise the limit up to ${MAX_REPEAT_OCCURRENCES}.`);
    }
  }

  return {
    errors,
    repeat: errors.length === 0
      ? {
          frequency,
          maxOccurrences,
          untilDate,
          weekdays,
        }
      : null,
  };
}

function closeEditor(result) {
  editorElements.backdrop.classList.add("is-hidden");
  clearErrors();

  const resolve = activeResolve;
  activeContext = null;
  activeResolve = null;

  if (resolve) {
    resolve(result);
  }
}

function normalizeTimeField(fieldName) {
  const result = normalizeScheduleTimeInput(getField(fieldName).value, activeContext.schedule.settings);

  if (result.isValid) {
    setTimeValue(fieldName, result.value);
  }
}

function getField(name) {
  return editorElements.form.querySelector(`[name="${name}"]`);
}

function setValue(name, value) {
  getField(name).value = value ?? "";
}

function setTimeValue(name, value) {
  setValue(name, value ? formatTimeForDisplay(value) : "");
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
    node.label = option.label;
    datalist.append(node);
  }
}

function updateRepeatFields() {
  const frequency = getField("repeatFrequency").value;
  const date = getField("date").value;
  const isRepeating = frequency !== "none";

  for (const element of editorElements.form.querySelectorAll(".repeat-control")) {
    element.hidden = !isRepeating;
  }

  editorElements.repeatWeekdayRow.hidden = frequency !== "weekly";
  getField("repeatUntil").min = date;

  if (!getField("repeatUntil").value || getField("repeatUntil").value < date) {
    setValue("repeatUntil", date);
  }

  if (frequency === "weekly" && getCheckedWeekdays().length === 0) {
    setDefaultWeeklyDay(date);
  }
}

function renderWeekdayOptions() {
  const picker = editorElements.form.querySelector(".weekday-picker");

  picker.replaceChildren();

  WEEKDAY_NAMES.forEach((weekday, value) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const text = document.createElement("span");

    label.className = "checkbox-row weekday-option";
    input.name = "repeatWeekday";
    input.type = "checkbox";
    input.value = String(value);
    text.textContent = weekday.slice(0, 3);
    label.append(input, text);
    picker.append(label);
  });
}

function setDefaultWeeklyDay(date) {
  const weekday = String(parseIsoDate(date).getDay());

  for (const input of editorElements.form.querySelectorAll('input[name="repeatWeekday"]')) {
    input.checked = input.value === weekday;
  }
}

function getCheckedWeekdays() {
  return [...editorElements.form.querySelectorAll('input[name="repeatWeekday"]:checked')]
    .map((input) => Number(input.value));
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function showErrors(errors) {
  editorElements.errors.replaceChildren();

  for (const error of errors) {
    const item = document.createElement("p");
    item.textContent = error;
    editorElements.errors.append(item);
  }

  editorElements.errors.hidden = false;
}

function clearErrors() {
  editorElements.errors.replaceChildren();
  editorElements.errors.hidden = true;
}
