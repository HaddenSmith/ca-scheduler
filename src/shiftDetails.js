import { buildWeekDates, formatTimeForDisplay } from "./dateUtils.js";
import {
  buildRovingNotes,
  formatRoveSubtypesLabel,
  normalizeRoveSubtypes,
} from "./rovingUtils.js";

let detailsElements;
let activeResolve;

export function openShiftDetails({ schedule, shift }) {
  detailsElements = detailsElements ?? createDetailsElements();

  if (activeResolve) {
    closeDetails();
  }

  populateDetails(schedule, shift);
  detailsElements.backdrop.classList.remove("is-hidden");
  detailsElements.closeButton.focus();

  return new Promise((resolve) => {
    activeResolve = resolve;
  });
}

function createDetailsElements() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop is-hidden";
  backdrop.innerHTML = `
    <section class="shift-editor shift-details" role="dialog" aria-modal="true" aria-labelledby="shift-details-title">
      <header class="shift-editor-header">
        <div>
          <p class="eyebrow">Read Only</p>
          <h2 id="shift-details-title">Shift Details</h2>
        </div>
        <button type="button" class="icon-button" data-details-close aria-label="Close shift details">x</button>
      </header>
      <dl class="shift-details-body"></dl>
      <footer class="shift-editor-actions align-end shift-details-actions">
        <button type="button" class="secondary-button" data-details-close>Close</button>
      </footer>
    </section>
  `;

  for (const button of backdrop.querySelectorAll("[data-details-close]")) {
    button.addEventListener("click", closeDetails);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.classList.contains("is-hidden")) {
      closeDetails();
    }
  });

  document.body.append(backdrop);

  return {
    backdrop,
    body: backdrop.querySelector(".shift-details-body"),
    closeButton: backdrop.querySelector("[data-details-close]"),
  };
}

function populateDetails(schedule, shift) {
  const workerName = schedule.workers.find((worker) => worker.id === shift.workerId)?.name ?? "Unknown worker";
  const dateLabel = buildWeekDates(schedule.weekStartDate).find((date) => date.isoDate === shift.date);
  const roveSubtypes = shift.shiftType === "Roving"
    ? normalizeRoveSubtypes(shift.roveSubtypes ?? shift.roveSubtype ?? shift.roveType, shift.label)
    : [];
  const notes = shift.notes || (shift.shiftType === "Roving" ? buildRovingNotes(roveSubtypes) : "");
  const formattedDate = dateLabel
    ? `${dateLabel.dayName}, ${dateLabel.displayDate}`
    : shift.date;
  const phoneCoverage = [
    shift.alsoOnCall ? "Primary during this shift" : "",
    shift.alsoBackupOnCall ? "Backup during this shift" : "",
  ].filter(Boolean).join("; ");

  detailsElements.body.replaceChildren(
    createDetailRow("Worker", workerName),
    createDetailRow("Date", formattedDate),
    createDetailRow("Time", `${formatTimeForDisplay(shift.startTime)}-${formatTimeForDisplay(shift.endTime)}`),
    createDetailRow("Shift Type", shift.shiftType || shift.name),
    ...(roveSubtypes.length ? [createDetailRow("Rove Type(s)", formatRoveSubtypesLabel(roveSubtypes))] : []),
    createDetailRow("Label", shift.label),
    createDetailRow("Counts Toward Hours", shift.countsTowardHours ? "Yes" : "No"),
    ...(phoneCoverage ? [createDetailRow("Phone Coverage", phoneCoverage)] : []),
    ...(notes ? [createDetailRow("Notes", notes)] : []),
  );
}

function createDetailRow(label, value) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  row.className = "detail-row";
  term.textContent = label;
  description.textContent = value;
  row.append(term, description);

  return row;
}

function closeDetails() {
  detailsElements.backdrop.classList.add("is-hidden");

  const resolve = activeResolve;
  activeResolve = null;

  if (resolve) {
    resolve({ action: "close" });
  }
}
