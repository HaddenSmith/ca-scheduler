import { buildWeekDates, formatTimeForDisplay } from "./dateUtils.js";
import { buildTimeInputOptions, normalizeScheduleTimeInput, timeToDisplayMinutes } from "./timeUtils.js";

let editorElements;
let activeContext;
let activeResolve;
let isProgrammaticFieldUpdate = false;

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

  setValue("date", coverage.date);
  setTimeValue("startTime", coverage.startTime);
  setTimeValue("endTime", coverage.endTime);
  setValue("label", coverage.label || "D");
  setValue("notes", coverage.notes ?? "");
  setValue("color", coverage.color || "#a6a6a6");

  for (const field of editorElements.form.querySelectorAll("input, select, textarea")) {
    field.disabled = isViewMode;
  }
}

function handleSubmit(event) {
  event.preventDefault();

  const result = readCoverageFromForm();

  if (result.errors.length > 0) {
    showErrors(result.errors);
    return;
  }

  setTimeValue("startTime", result.coverage.startTime);
  setTimeValue("endTime", result.coverage.endTime);
  closeEditor({ action: "save", coverage: result.coverage });
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
  isProgrammaticFieldUpdate = true;
  getField(name).value = value ?? "";
  isProgrammaticFieldUpdate = false;
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
