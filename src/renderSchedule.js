import { buildWeekDates, formatTimeForDisplay } from "./dateUtils.js";
import { attachShiftInteractions } from "./dragDrop.js";
import { attachGridCreateInteractions } from "./gridCreate.js";
import { renderDayTotals } from "./renderTotals.js";
import { hasCustomShiftNotes } from "./rovingUtils.js";
import { getOnCallAssignment } from "./scheduleState.js";
import {
  buildTimeTicks,
  getScheduleBoundaryMinutes,
  timeToDisplayMinutes,
} from "./timeUtils.js";

const VIEW_LAYOUTS = {
  detailed: {
    className: "is-detailed",
    showDailyTotals: true,
    showShiftTime: true,
    slotHeight: 10,
    timeTickStep: 1,
    viewMode: "detailed",
  },
  compact: {
    className: "is-compact",
    showDailyTotals: false,
    showShiftTime: false,
    slotHeight: 2.5,
    timeTickStep: 3,
    viewMode: "compact",
  },
};

export function renderScheduleBoard(container, schedule, dailyTotals, options = {}) {
  const layout = VIEW_LAYOUTS[options.viewMode] ?? VIEW_LAYOUTS.detailed;
  container.replaceChildren();
  container.className = `schedule-board ${layout.className}${options.readOnly ? " is-read-only" : ""}`;
  container.dataset.viewMode = layout.viewMode;

  const weekDates = buildWeekDates(schedule.weekStartDate);

  for (const date of weekDates) {
    container.append(renderDaySection(schedule, date, dailyTotals, layout, options));
  }
}

function renderDaySection(schedule, date, dailyTotals, layout, callbacks) {
  const section = document.createElement("article");
  section.className = "day-section";
  section.dataset.date = date.isoDate;

  const heading = document.createElement("header");
  heading.className = "day-heading";

  const title = document.createElement("div");
  const eyebrow = document.createElement("p");
  const dayName = document.createElement("h3");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = date.displayDate;
  dayName.textContent = date.dayName;
  title.append(eyebrow, dayName);
  heading.append(title);

  const addButton = document.createElement("button");
  addButton.className = "add-shift-button";
  addButton.type = "button";
  addButton.dataset.date = date.isoDate;
  addButton.setAttribute("aria-label", `Add shift for ${date.dayName}`);
  addButton.textContent = "Add Shift";
  addButton.addEventListener("click", () => callbacks.onAddShift?.({ date: date.isoDate }));

  if (callbacks.readOnly) {
    addButton.hidden = true;
    addButton.disabled = true;
  }

  heading.append(addButton);

  section.append(heading);

  const scrollFrame = document.createElement("div");
  scrollFrame.className = "schedule-scroll-frame";
  scrollFrame.append(renderDayGrid(schedule, date.isoDate, layout, callbacks));
  section.append(scrollFrame);

  if (layout.showDailyTotals) {
    const totals = document.createElement("div");
    totals.className = "daily-totals";
    renderDayTotals(totals, schedule.workers, date.isoDate, dailyTotals);
    section.append(totals);
  }

  return section;
}

function renderDayGrid(schedule, isoDate, layout, callbacks) {
  const settings = schedule.settings;
  const onCallAssignment = getOnCallAssignment(schedule, isoDate);
  const { start, end } = getScheduleBoundaryMinutes(settings);
  const totalMinutes = end - start;
  const slotCount = totalMinutes / settings.slotMinutes;
  const height = slotCount * layout.slotHeight;
  const grid = document.createElement("div");

  grid.className = "day-grid";
  grid.dataset.date = isoDate;
  grid.style.setProperty("--slot-height", `${layout.slotHeight}px`);
  grid.style.setProperty("--worker-count", schedule.workers.length);
  grid.style.setProperty("--timeline-height", `${height}px`);
  grid.append(renderTimeRail(settings, height, layout));

  for (const worker of schedule.workers) {
    const workerShifts = schedule.shifts.filter((shift) => {
      return shift.date === isoDate && shift.workerId === worker.id;
    });

    grid.append(
      renderWorkerColumn(
        worker,
        workerShifts,
        settings,
        height,
        layout,
        callbacks,
        onCallAssignment,
        isoDate,
      ),
    );
  }

  return grid;
}

function renderTimeRail(settings, height, layout) {
  const rail = document.createElement("div");
  rail.className = "time-rail";

  const header = document.createElement("div");
  header.className = "column-header time-header";
  header.textContent = "Time";
  rail.append(header);

  const body = document.createElement("div");
  body.className = "time-rail-body";
  body.style.height = `${height}px`;

  const ticks = buildTimeTicks(settings);

  for (const [index, tick] of ticks.entries()) {
    const isVisibleTick =
      layout.timeTickStep === 1 ||
      index % layout.timeTickStep === 0 ||
      index === ticks.length - 1;

    if (!isVisibleTick) {
      continue;
    }

    const label = document.createElement("span");
    label.className = "time-tick";
    label.style.top = `${(tick.offsetMinutes / settings.slotMinutes) * layout.slotHeight}px`;
    label.textContent = tick.label;
    body.append(label);
  }

  rail.append(body);

  const onCall = document.createElement("div");
  onCall.className = "on-call-label";
  onCall.innerHTML = "<span>Night On Call</span><span>Night Backup</span>";
  rail.append(onCall);

  return rail;
}

function renderWorkerColumn(
  worker,
  shifts,
  settings,
  height,
  layout,
  callbacks,
  onCallAssignment,
  isoDate,
) {
  const column = document.createElement("div");
  column.className = "worker-column";
  column.dataset.date = isoDate;
  column.dataset.workerId = worker.id;

  const header = document.createElement("div");
  header.className = "column-header";
  header.textContent = worker.name;
  column.append(header);

  const body = document.createElement("div");
  body.className = "worker-timeline";
  body.dataset.date = isoDate;
  body.dataset.workerId = worker.id;
  body.dataset.workerName = worker.name;
  body.style.height = `${height}px`;

  for (const shift of layoutOverlappingShifts(shifts, settings)) {
    body.append(renderShiftBlock(shift, settings, layout, callbacks));
  }

  if (!callbacks.readOnly) {
    attachGridCreateInteractions(body, {
      callbacks,
      layout,
      settings,
    });
  }

  column.append(body);

  const onCall = document.createElement("button");
  onCall.className = "on-call-cell";
  onCall.type = "button";
  onCall.dataset.date = isoDate;
  onCall.dataset.workerId = worker.id;
  onCall.title = "Click to edit nightly on-call assignments";

  if (onCallAssignment.primaryWorkerId === worker.id) {
    onCall.classList.add("is-primary-on-call");
    onCall.append(createOnCallTag("Night OC"));
  }

  if (onCallAssignment.backupWorkerId === worker.id) {
    onCall.classList.add("is-backup-on-call");
    onCall.append(createOnCallTag("Night BOC"));
  }

  if (!onCall.hasChildNodes()) {
    onCall.setAttribute("aria-label", `Edit nightly on-call assignments for ${isoDate}`);
  } else {
    onCall.setAttribute("aria-label", `${worker.name} nightly on-call assignment for ${isoDate}. Click to edit.`);
  }

  if (callbacks.readOnly) {
    onCall.disabled = true;
    onCall.title = "Nightly on-call assignment";
  } else {
    onCall.addEventListener("click", () => callbacks.onEditOnCall?.({ date: isoDate }));
  }

  column.append(onCall);

  return column;
}

function createOnCallTag(text) {
  const tag = document.createElement("span");
  tag.className = "on-call-tag";
  tag.textContent = text;
  return tag;
}

function renderShiftBlock(layoutShift, settings, layout, callbacks) {
  const template = document.querySelector("#event-template");
  const node = template.content.firstElementChild.cloneNode(true);
  const shift = layoutShift.shift;
  const { start } = getScheduleBoundaryMinutes(settings);
  const startMinutes = timeToDisplayMinutes(shift.startTime, settings);
  const endMinutes = timeToDisplayMinutes(shift.endTime, settings);
  const adjustedEnd = endMinutes <= startMinutes ? endMinutes + 24 * 60 : endMinutes;
  const top = ((startMinutes - start) / settings.slotMinutes) * layout.slotHeight;
  const height = Math.max(
    layout.slotHeight,
    ((adjustedEnd - startMinutes) / settings.slotMinutes) * layout.slotHeight,
  );

  node.dataset.shiftId = shift.id;
  node.style.setProperty("--shift-color", shift.color);
  node.style.top = `${top}px`;
  node.style.height = `${height}px`;
  node.style.left = `${layoutShift.leftPercent}%`;
  node.style.width = `calc(${layoutShift.widthPercent}% - 4px)`;
  node.title = `${shift.name}: ${formatTimeForDisplay(shift.startTime)} - ${formatTimeForDisplay(shift.endTime)}. ${callbacks.readOnly ? "Click for details." : "Click to edit."}`;
  node.setAttribute(
    "aria-label",
    `${shift.name}, ${formatTimeForDisplay(shift.startTime)} to ${formatTimeForDisplay(shift.endTime)}. ${callbacks.readOnly ? "Click for details." : "Click to edit."}`,
  );
  node.querySelector(".shift-label").textContent = shift.label;

  if (layout.showShiftTime) {
    node.querySelector(".shift-time").textContent = `${formatTimeForDisplay(shift.startTime)}-${formatTimeForDisplay(shift.endTime)}`;
  } else {
    node.querySelector(".shift-time").remove();
  }

  if (shift.alsoOnCall || shift.alsoBackupOnCall) {
    const flags = document.createElement("span");
    flags.className = "shift-flags";
    flags.textContent = [
      shift.alsoOnCall ? "OC" : "",
      shift.alsoBackupOnCall ? "BOC" : "",
    ].filter(Boolean).join(" / ");
    node.append(flags);
  }

  if (hasCustomShiftNotes(shift)) {
    const noteMarker = document.createElement("span");
    noteMarker.className = "shift-note-marker";
    noteMarker.textContent = "*";
    noteMarker.title = "Special notes";
    node.append(noteMarker);
  }

  if (!shift.countsTowardHours) {
    node.classList.add("is-marker");
  }

  if (callbacks.readOnly) {
    node.addEventListener("click", () => callbacks.onViewShift?.(shift.id));
  } else {
    node.append(createResizeHandle("top"), createResizeHandle("bottom"));
    attachShiftInteractions(node, {
      callbacks,
      layout,
      settings,
      shift,
    });
  }

  return node;
}

function createResizeHandle(edge) {
  const handle = document.createElement("span");
  handle.className = `shift-resize-handle is-${edge}`;
  handle.dataset.resizeEdge = edge;
  handle.setAttribute("aria-hidden", "true");
  return handle;
}

function layoutOverlappingShifts(shifts, settings) {
  const sorted = [...shifts].sort((a, b) => {
    return timeToDisplayMinutes(a.startTime, settings) - timeToDisplayMinutes(b.startTime, settings);
  });
  const lanes = [];
  const placed = [];

  for (const shift of sorted) {
    const start = timeToDisplayMinutes(shift.startTime, settings);
    let end = timeToDisplayMinutes(shift.endTime, settings);

    if (end <= start) {
      end += 24 * 60;
    }

    let laneIndex = lanes.findIndex((laneEnd) => laneEnd <= start);

    if (laneIndex === -1) {
      laneIndex = lanes.length;
      lanes.push(end);
    } else {
      lanes[laneIndex] = end;
    }

    placed.push({ shift, laneIndex, start, end });
  }

  const laneCount = Math.max(1, lanes.length);

  return placed.map((item) => ({
    shift: item.shift,
    leftPercent: (item.laneIndex / laneCount) * 100,
    widthPercent: 100 / laneCount,
  }));
}
