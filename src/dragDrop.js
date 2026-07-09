import { formatTimeForDisplay } from "./dateUtils.js";
import {
  getScheduleBoundaryMinutes,
  minutesToTimeValue,
  timeToDisplayMinutes,
} from "./timeUtils.js";

const DRAG_THRESHOLD_PX = 4;

let activeDropTarget = null;
let previewLabel = null;
let suppressClickUntil = 0;

export function attachShiftInteractions(node, { callbacks, layout, settings, shift }) {
  let pointerContext = null;

  node.addEventListener("click", (event) => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    callbacks.onEditShift?.(shift.id);
  });

  node.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    const handle = event.target.closest("[data-resize-edge]");
    const timeline = node.closest(".worker-timeline");

    if (!timeline) {
      return;
    }

    pointerContext = createPointerContext({
      callbacks,
      edge: handle?.dataset.resizeEdge ?? "",
      event,
      layout,
      node,
      settings,
      shift,
      timeline,
    });

    try {
      node.setPointerCapture(event.pointerId);
    } catch {
      // Window-level listeners below still complete the interaction if capture is unavailable.
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
  });

  function handlePointerMove(event) {
    if (!pointerContext) {
      return;
    }

    const movement = Math.hypot(
      event.clientX - pointerContext.startX,
      event.clientY - pointerContext.startY,
    );

    if (!pointerContext.isActive && movement < DRAG_THRESHOLD_PX) {
      return;
    }

    event.preventDefault();
    pointerContext.isActive = true;

    if (pointerContext.mode === "resize") {
      updateResizePreview(pointerContext, event);
      return;
    }

    updateDragPreview(pointerContext, event);
  }

  function handlePointerUp(event) {
    if (!pointerContext) {
      return;
    }

    try {
      node.releasePointerCapture(event.pointerId);
    } catch {
      // Some browser automation paths release capture before the handler runs.
    }

    if (pointerContext.isActive) {
      event.preventDefault();
      suppressClickUntil = Date.now() + 300;

      if (pointerContext.mode === "resize" && pointerContext.preview) {
        callbacks.onChangeShift?.({
          shiftId: shift.id,
          changes: {
            startTime: pointerContext.preview.startTime,
            endTime: pointerContext.preview.endTime,
          },
        });
      }

      if (pointerContext.mode === "drag" && pointerContext.preview) {
        const payload = {
          shiftId: shift.id,
          changes: {
            workerId: pointerContext.preview.workerId,
            date: pointerContext.preview.date,
            startTime: pointerContext.preview.startTime,
            endTime: pointerContext.preview.endTime,
          },
        };

        if (pointerContext.duplicateMode) {
          callbacks.onDuplicateShift?.(payload);
        } else {
          callbacks.onChangeShift?.(payload);
        }
      }
    }

    removeWindowListeners();
    clearInteractionState(pointerContext);
    pointerContext = null;
  }

  function handlePointerCancel() {
    if (!pointerContext) {
      return;
    }

    removeWindowListeners();
    clearInteractionState(pointerContext);
    pointerContext = null;
  }

  function removeWindowListeners() {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);
  }
}

export function attachDeskCoverageInteractions(node, { callbacks, coverage, layout, settings }) {
  let pointerContext = null;

  node.addEventListener("click", (event) => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    callbacks.onEditDeskCoverage?.(coverage.id);
  });

  node.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    const handle = event.target.closest("[data-resize-edge]");
    const timeline = node.closest(".desk-coverage-timeline");

    if (!timeline) {
      return;
    }

    pointerContext = createPointerContext({
      callbacks,
      edge: handle?.dataset.resizeEdge ?? "",
      event,
      layout,
      node,
      settings,
      shift: coverage,
      timeline,
    });

    try {
      node.setPointerCapture(event.pointerId);
    } catch {
      // Window-level listeners below still complete the interaction if capture is unavailable.
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
  });

  function handlePointerMove(event) {
    if (!pointerContext) {
      return;
    }

    const movement = Math.hypot(
      event.clientX - pointerContext.startX,
      event.clientY - pointerContext.startY,
    );

    if (!pointerContext.isActive && movement < DRAG_THRESHOLD_PX) {
      return;
    }

    event.preventDefault();
    pointerContext.isActive = true;

    if (pointerContext.mode === "resize") {
      updateResizePreview(pointerContext, event);
      return;
    }

    updateDeskCoverageDragPreview(pointerContext, event);
  }

  function handlePointerUp(event) {
    if (!pointerContext) {
      return;
    }

    try {
      node.releasePointerCapture(event.pointerId);
    } catch {
      // Some browser automation paths release capture before the handler runs.
    }

    if (pointerContext.isActive) {
      event.preventDefault();
      suppressClickUntil = Date.now() + 300;

      if (pointerContext.mode === "resize" && pointerContext.preview) {
        callbacks.onChangeDeskCoverage?.({
          coverageId: coverage.id,
          changes: {
            startTime: pointerContext.preview.startTime,
            endTime: pointerContext.preview.endTime,
          },
        });
      }

      if (pointerContext.mode === "drag" && pointerContext.preview) {
        callbacks.onChangeDeskCoverage?.({
          coverageId: coverage.id,
          changes: {
            date: pointerContext.preview.date,
            startTime: pointerContext.preview.startTime,
            endTime: pointerContext.preview.endTime,
          },
        });
      }
    }

    removeWindowListeners();
    clearInteractionState(pointerContext);
    pointerContext = null;
  }

  function handlePointerCancel() {
    if (!pointerContext) {
      return;
    }

    removeWindowListeners();
    clearInteractionState(pointerContext);
    pointerContext = null;
  }

  function removeWindowListeners() {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);
  }
}

function createPointerContext({ callbacks, edge, event, layout, node, settings, shift, timeline }) {
  const originalStart = timeToDisplayMinutes(shift.startTime, settings);
  let originalEnd = timeToDisplayMinutes(shift.endTime, settings);

  if (originalEnd <= originalStart) {
    originalEnd += 24 * 60;
  }

  const { start: boundaryStart, end: boundaryEnd } = getScheduleBoundaryMinutes(settings);
  const rect = node.getBoundingClientRect();

  return {
    boundaryEnd,
    boundaryStart,
    callbacks,
    durationMinutes: originalEnd - originalStart,
    edge,
    duplicateMode: false,
    isActive: false,
    layout,
    mode: edge ? "resize" : "drag",
    node,
    originalEnd,
    originalStart,
    originalStyle: {
      height: node.style.height,
      left: node.style.left,
      position: node.style.position,
      top: node.style.top,
      transform: node.style.transform,
      width: node.style.width,
    },
    pointerOffsetX: event.clientX - rect.left,
    pointerOffsetY: event.clientY - rect.top,
    preview: null,
    previewHeight: rect.height,
    previewWidth: rect.width,
    settings,
    shift,
    startX: event.clientX,
    startY: event.clientY,
    timeline,
    timelineRect: timeline.getBoundingClientRect(),
  };
}

function updateDeskCoverageDragPreview(context, event) {
  const target = getDeskCoverageDropTarget(event.clientX, event.clientY);

  context.node.classList.add("is-dragging");
  context.node.style.position = "fixed";
  context.node.style.left = `${event.clientX - context.pointerOffsetX}px`;
  context.node.style.top = `${event.clientY - context.pointerOffsetY}px`;
  context.node.style.width = `${context.previewWidth}px`;
  context.node.style.height = `${context.previewHeight}px`;
  context.node.style.transform = "none";

  setActiveDropTarget(target);

  if (!target) {
    context.preview = null;
    updatePreviewLabel(event, "Drop inside a Desk Coverage column");
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const proposedTop = event.clientY - targetRect.top - context.pointerOffsetY;
  const proposedStart = context.boundaryStart + Math.round(
    proposedTop / context.layout.slotHeight,
  ) * context.settings.slotMinutes;
  const latestStart = context.boundaryEnd - context.durationMinutes;
  const nextStart = clamp(proposedStart, context.boundaryStart, latestStart);
  const nextEnd = nextStart + context.durationMinutes;
  const startTime = minutesToTimeValue(nextStart);
  const endTime = minutesToTimeValue(nextEnd);

  context.preview = {
    date: target.dataset.date,
    startTime,
    endTime,
  };

  updatePreviewLabel(
    event,
    `Desk ${formatTimeForDisplay(startTime)}-${formatTimeForDisplay(endTime)}`,
  );
}

function updateDragPreview(context, event) {
  const target = getDropTarget(event.clientX, event.clientY);
  const isDuplicate = event.shiftKey || event.ctrlKey;

  context.node.classList.add("is-dragging");
  context.node.classList.toggle("is-duplicating", isDuplicate);
  context.duplicateMode = isDuplicate;
  context.node.style.position = "fixed";
  context.node.style.left = `${event.clientX - context.pointerOffsetX}px`;
  context.node.style.top = `${event.clientY - context.pointerOffsetY}px`;
  context.node.style.width = `${context.previewWidth}px`;
  context.node.style.height = `${context.previewHeight}px`;
  context.node.style.transform = "none";

  setActiveDropTarget(target);

  if (!target) {
    context.preview = null;
    updatePreviewLabel(event, "Drop inside a worker column");
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const proposedTop = event.clientY - targetRect.top - context.pointerOffsetY;
  const proposedStart = context.boundaryStart + Math.round(
    proposedTop / context.layout.slotHeight,
  ) * context.settings.slotMinutes;
  const latestStart = context.boundaryEnd - context.durationMinutes;
  const nextStart = clamp(proposedStart, context.boundaryStart, latestStart);
  const nextEnd = nextStart + context.durationMinutes;
  const startTime = minutesToTimeValue(nextStart);
  const endTime = minutesToTimeValue(nextEnd);

  context.preview = {
    date: target.dataset.date,
    workerId: target.dataset.workerId,
    startTime,
    endTime,
  };

  updatePreviewLabel(
    event,
    `${isDuplicate ? "Copy to " : ""}${target.dataset.workerName} ${formatTimeForDisplay(startTime)}-${formatTimeForDisplay(endTime)}`,
  );
}

function updateResizePreview(context, event) {
  const pointerMinute = context.boundaryStart + Math.round(
    (event.clientY - context.timelineRect.top) / context.layout.slotHeight,
  ) * context.settings.slotMinutes;
  const minDuration = context.settings.slotMinutes;
  let nextStart = context.originalStart;
  let nextEnd = context.originalEnd;

  context.node.classList.add("is-resizing");

  if (context.edge === "top") {
    nextStart = clamp(pointerMinute, context.boundaryStart, context.originalEnd - minDuration);
  } else {
    nextEnd = clamp(pointerMinute, context.originalStart + minDuration, context.boundaryEnd);
  }

  const top = ((nextStart - context.boundaryStart) / context.settings.slotMinutes) * context.layout.slotHeight;
  const height = ((nextEnd - nextStart) / context.settings.slotMinutes) * context.layout.slotHeight;
  const startTime = minutesToTimeValue(nextStart);
  const endTime = minutesToTimeValue(nextEnd);

  context.node.style.top = `${top}px`;
  context.node.style.height = `${height}px`;
  context.preview = { startTime, endTime };

  updatePreviewLabel(
    event,
    `${formatTimeForDisplay(startTime)}-${formatTimeForDisplay(endTime)}`,
  );
}

function clearInteractionState(context) {
  context.node.classList.remove("is-dragging", "is-resizing", "is-duplicating");
  context.node.style.position = context.originalStyle.position;
  context.node.style.left = context.originalStyle.left;
  context.node.style.top = context.originalStyle.top;
  context.node.style.width = context.originalStyle.width;
  context.node.style.height = context.originalStyle.height;
  context.node.style.transform = context.originalStyle.transform;
  setActiveDropTarget(null);
  hidePreviewLabel();
}

function getDeskCoverageDropTarget(x, y) {
  return document.elementsFromPoint(x, y).find((element) => {
    return element.classList?.contains("desk-coverage-timeline");
  }) ?? null;
}

function getDropTarget(x, y) {
  return document.elementsFromPoint(x, y).find((element) => {
    return element.classList?.contains("worker-timeline");
  }) ?? null;
}

function setActiveDropTarget(target) {
  if (activeDropTarget === target) {
    return;
  }

  activeDropTarget?.classList.remove("is-drop-target");
  activeDropTarget = target;
  activeDropTarget?.classList.add("is-drop-target");
}

function updatePreviewLabel(event, text) {
  previewLabel = previewLabel ?? createPreviewLabel();
  previewLabel.textContent = text;
  previewLabel.hidden = false;
  previewLabel.style.left = `${event.clientX + 12}px`;
  previewLabel.style.top = `${event.clientY + 12}px`;
}

function hidePreviewLabel() {
  if (previewLabel) {
    previewLabel.hidden = true;
  }
}

function createPreviewLabel() {
  const label = document.createElement("div");
  label.className = "drag-preview-label";
  label.hidden = true;
  document.body.append(label);
  return label;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
