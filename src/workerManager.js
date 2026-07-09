import {
  addWorker,
  removeWorker,
  renameWorker,
} from "./scheduleState.js";

let managerElements;
let activeResolve;
let draftSchedule;

export function openWorkerManager(schedule) {
  managerElements = managerElements ?? createManagerElements();

  if (activeResolve) {
    closeManager({ action: "cancel", schedule: null });
  }

  draftSchedule = structuredClone(schedule);
  renderWorkerRows();
  clearMessage();
  managerElements.backdrop.classList.remove("is-hidden");
  managerElements.newWorkerInput.focus();

  return new Promise((resolve) => {
    activeResolve = resolve;
  });
}

function createManagerElements() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop is-hidden";
  backdrop.innerHTML = `
    <section class="shift-editor worker-manager" role="dialog" aria-modal="true" aria-labelledby="worker-manager-title">
      <header class="shift-editor-header">
        <div>
          <p class="eyebrow">Schedule Setup</p>
          <h2 id="worker-manager-title">Workers</h2>
        </div>
        <button type="button" class="icon-button" data-worker-action="cancel" aria-label="Close worker manager">x</button>
      </header>

      <div class="shift-editor-form">
        <div class="form-errors" aria-live="polite" hidden></div>
        <div class="worker-list"></div>

        <form class="inline-add-form">
          <label>
            <span>New Worker</span>
            <input name="newWorkerName" type="text" />
          </label>
          <button type="submit" class="secondary-button">Add Worker</button>
        </form>

        <footer class="shift-editor-actions align-end">
          <div>
            <button type="button" class="secondary-button" data-worker-action="cancel">Cancel</button>
            <button type="button" class="primary-button" data-worker-action="save">Save</button>
          </div>
        </footer>
      </div>
    </section>
  `;

  const addForm = backdrop.querySelector(".inline-add-form");

  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = backdrop.querySelector('[name="newWorkerName"]').value;
    const result = addWorker(draftSchedule, name);
    draftSchedule = result.schedule;
    backdrop.querySelector('[name="newWorkerName"]').value = "";
    renderWorkerRows();
    clearMessage();
  });

  for (const button of backdrop.querySelectorAll('[data-worker-action="cancel"]')) {
    button.addEventListener("click", () => closeManager({ action: "cancel", schedule: null }));
  }

  backdrop.querySelector('[data-worker-action="save"]').addEventListener("click", () => {
    closeManager({ action: "save", schedule: draftSchedule });
  });

  document.body.append(backdrop);

  return {
    backdrop,
    errors: backdrop.querySelector(".form-errors"),
    list: backdrop.querySelector(".worker-list"),
    newWorkerInput: backdrop.querySelector('[name="newWorkerName"]'),
  };
}

function renderWorkerRows() {
  managerElements.list.replaceChildren();

  for (const worker of draftSchedule.workers) {
    const row = document.createElement("div");
    row.className = "worker-row";
    row.dataset.workerId = worker.id;

    const label = document.createElement("label");
    const labelText = document.createElement("span");
    const input = document.createElement("input");
    labelText.textContent = "Name";
    input.value = worker.name;
    input.dataset.workerId = worker.id;
    input.addEventListener("input", () => {
      draftSchedule = renameWorker(draftSchedule, worker.id, input.value);
    });
    label.append(labelText, input);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "danger-button";
    removeButton.dataset.workerId = worker.id;
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      const result = removeWorker(draftSchedule, worker.id);
      draftSchedule = result.schedule;

      if (!result.removed) {
        showMessage(result.error);
      } else {
        clearMessage();
      }

      renderWorkerRows();
    });

    row.append(label, removeButton);
    managerElements.list.append(row);
  }
}

function closeManager(result) {
  managerElements.backdrop.classList.add("is-hidden");
  clearMessage();

  const resolve = activeResolve;
  activeResolve = null;
  draftSchedule = null;

  if (resolve) {
    resolve(result);
  }
}

function showMessage(message) {
  managerElements.errors.replaceChildren();
  const item = document.createElement("p");
  item.textContent = message;
  managerElements.errors.append(item);
  managerElements.errors.hidden = false;
}

function clearMessage() {
  managerElements.errors.replaceChildren();
  managerElements.errors.hidden = true;
}
