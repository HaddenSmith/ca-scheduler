import { buildWeekDates } from "./dateUtils.js";

let editorElements;
let activeResolve;
let activeContext;

export function openOnCallEditor({ schedule, assignment }) {
  editorElements = editorElements ?? createEditorElements();

  if (activeResolve) {
    closeEditor({ action: "cancel", assignment: null });
  }

  activeContext = {
    schedule,
    assignment: { ...assignment },
  };

  populateForm();
  editorElements.backdrop.classList.remove("is-hidden");
  editorElements.form.querySelector('[name="primaryWorkerId"]').focus();

  return new Promise((resolve) => {
    activeResolve = resolve;
  });
}

function createEditorElements() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop is-hidden";
  backdrop.innerHTML = `
    <section class="shift-editor compact-editor" role="dialog" aria-modal="true" aria-labelledby="on-call-editor-title">
      <header class="shift-editor-header">
        <div>
          <p class="eyebrow">Night Phone Coverage</p>
          <h2 id="on-call-editor-title">Night On Call</h2>
        </div>
        <button type="button" class="icon-button" data-on-call-action="cancel" aria-label="Close on-call editor">x</button>
      </header>

      <form class="shift-editor-form" novalidate>
        <label>
          <span>Night Primary On Call</span>
          <select name="primaryWorkerId"></select>
        </label>

        <label>
          <span>Night Backup On Call</span>
          <select name="backupWorkerId"></select>
        </label>

        <footer class="shift-editor-actions align-end">
          <div>
            <button type="button" class="secondary-button" data-on-call-action="cancel">Cancel</button>
            <button type="submit" class="primary-button">Save</button>
          </div>
        </footer>
      </form>
    </section>
  `;

  const form = backdrop.querySelector("form");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    closeEditor({
      action: "save",
      assignment: readForm(),
    });
  });

  for (const button of backdrop.querySelectorAll('[data-on-call-action="cancel"]')) {
    button.addEventListener("click", () => closeEditor({ action: "cancel", assignment: null }));
  }

  document.body.append(backdrop);

  return {
    backdrop,
    form,
    title: backdrop.querySelector("#on-call-editor-title"),
  };
}

function populateForm() {
  const dateLabel = buildWeekDates(activeContext.schedule.weekStartDate).find((date) => {
    return date.isoDate === activeContext.assignment.date;
  });
  editorElements.title.textContent = `Night On Call - ${dateLabel?.dayName ?? activeContext.assignment.date}`;

  const workerOptions = [
    { value: "", label: "None selected" },
    ...activeContext.schedule.workers.map((worker) => ({
      value: worker.id,
      label: worker.name,
    })),
  ];

  fillSelect(getField("primaryWorkerId"), workerOptions);
  fillSelect(getField("backupWorkerId"), workerOptions);

  getField("primaryWorkerId").value = activeContext.assignment.primaryWorkerId;
  getField("backupWorkerId").value = activeContext.assignment.backupWorkerId;
}

function readForm() {
  return {
    date: activeContext.assignment.date,
    primaryWorkerId: getField("primaryWorkerId").value,
    backupWorkerId: getField("backupWorkerId").value,
  };
}

function closeEditor(result) {
  editorElements.backdrop.classList.add("is-hidden");

  const resolve = activeResolve;
  activeResolve = null;
  activeContext = null;

  if (resolve) {
    resolve(result);
  }
}

function getField(name) {
  return editorElements.form.querySelector(`[name="${name}"]`);
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
