import {
  addWorker,
  removeWorker,
  renameWorker,
  reorderWorker,
} from "./scheduleState.js";

let managerElements;
let activeResolve;
let draftSchedule;
let draggedWorkerId = "";

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
        <p class="field-help">Drag workers to change schedule column order.</p>
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
    row.draggable = true;

    row.addEventListener("dragstart", (event) => {
      draggedWorkerId = worker.id;
      row.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", worker.id);
    });

    row.addEventListener("dragover", (event) => {
      if (!draggedWorkerId || draggedWorkerId === worker.id) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      row.classList.toggle("is-drop-after", isAfterRowMidpoint(event, row));
      row.classList.toggle("is-drop-before", !isAfterRowMidpoint(event, row));
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("is-drop-before", "is-drop-after");
    });

    row.addEventListener("drop", (event) => {
      event.preventDefault();
      const position = isAfterRowMidpoint(event, row) ? "after" : "before";

      draftSchedule = reorderWorker(draftSchedule, draggedWorkerId, worker.id, position);
      draggedWorkerId = "";
      renderWorkerRows();
      clearMessage();
    });

    row.addEventListener("dragend", () => {
      draggedWorkerId = "";
      renderWorkerRows();
    });

    const dragHandle = document.createElement("span");
    dragHandle.className = "worker-drag-handle";
    dragHandle.textContent = "Drag";
    dragHandle.title = "Drag to reorder";

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

    row.append(dragHandle, label, removeButton);
    managerElements.list.append(row);
  }
}

function isAfterRowMidpoint(event, row) {
  const rect = row.getBoundingClientRect();

  return event.clientY > rect.top + rect.height / 2;
}

function closeManager(result) {
  managerElements.backdrop.classList.add("is-hidden");
  clearMessage();

  const resolve = activeResolve;
  activeResolve = null;
  draftSchedule = null;
  draggedWorkerId = "";

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
