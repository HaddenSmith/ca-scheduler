import { formatTimeForDisplay } from "./dateUtils.js";
import {
  getScheduleBoundaryMinutes,
  minutesToTimeValue,
} from "./timeUtils.js";

const DRAG_THRESHOLD_PX = 5;
const DEFAULT_CLICK_DURATION_MINUTES = 30;

export function attachGridCreateInteractions(timeline, { callbacks, layout, onCreate, settings }) {
  let pointerContext = null;

  timeline.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || shouldIgnorePointerDown(event)) {
      return;
    }

    pointerContext = createPointerContext({ event, layout, settings, timeline });

    try {
      timeline.setPointerCapture(event.pointerId);
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
    timeline.classList.add("is-create-target");
    updateDraftPreview(pointerContext, event);
  }

  function handlePointerUp(event) {
    if (!pointerContext) {
      return;
    }

    try {
      timeline.releasePointerCapture(event.pointerId);
    } catch {
      // Browser automation can release capture before this handler runs.
    }

    event.preventDefault();
    const range = pointerContext.previewRange ?? getClickDefaultRange(pointerContext);

    removeWindowListeners();
    clearDraftState(pointerContext);
    pointerContext = null;

    if (range) {
      const create = onCreate ?? callbacks.onAddShift;

      create?.({
        date: timeline.dataset.date,
        workerId: timeline.dataset.workerId,
        startTime: minutesToTimeValue(range.start),
        endTime: minutesToTimeValue(range.end),
        shiftType: "Other",
      });
    }
  }

  function handlePointerCancel() {
    if (!pointerContext) {
      return;
    }

    removeWindowListeners();
    clearDraftState(pointerContext);
    pointerContext = null;
  }

  function removeWindowListeners() {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);
  }
}

function createPointerContext({ event, layout, settings, timeline }) {
  const { start: boundaryStart, end: boundaryEnd } = getScheduleBoundaryMinutes(settings);
  const timelineRect = timeline.getBoundingClientRect();
  const anchorMinute = snapMinuteFromClientY({
    boundaryEnd,
    boundaryStart,
    clientY: event.clientY,
    layout,
    allowBoundaryEnd: false,
    mode: "floor",
    settings,
    timelineRect,
  });

  return {
    anchorMinute,
    boundaryEnd,
    boundaryStart,
    draftNode: null,
    isActive: false,
    layout,
    previewRange: null,
    settings,
    startX: event.clientX,
    startY: event.clientY,
    timeline,
    timelineRect,
  };
}

function updateDraftPreview(context, event) {
  const pointerMinute = snapMinuteFromClientY({
    boundaryEnd: context.boundaryEnd,
    boundaryStart: context.boundaryStart,
    clientY: event.clientY,
    layout: context.layout,
    allowBoundaryEnd: true,
    mode: "round",
    settings: context.settings,
    timelineRect: context.timelineRect,
  });
  const range = getDragRange(context, pointerMinute);
  const top = ((range.start - context.boundaryStart) / context.settings.slotMinutes) * context.layout.slotHeight;
  const height = ((range.end - range.start) / context.settings.slotMinutes) * context.layout.slotHeight;
  const startTime = minutesToTimeValue(range.start);
  const endTime = minutesToTimeValue(range.end);

  context.previewRange = range;
  context.draftNode = context.draftNode ?? createDraftNode(context.timeline);
  context.draftNode.style.top = `${top}px`;
  context.draftNode.style.height = `${height}px`;
  context.draftNode.textContent = `${formatTimeForDisplay(startTime)}-${formatTimeForDisplay(endTime)}`;
}

function createDraftNode(timeline) {
  const node = document.createElement("div");
  node.className = "draft-shift-preview";
  timeline.append(node);
  return node;
}

function getClickDefaultRange(context) {
  const defaultDuration = Math.max(DEFAULT_CLICK_DURATION_MINUTES, context.settings.slotMinutes);
  const duration = Math.min(defaultDuration, context.boundaryEnd - context.boundaryStart);
  const latestStart = context.boundaryEnd - duration;
  const start = clamp(context.anchorMinute, context.boundaryStart, latestStart);

  return {
    start,
    end: start + duration,
  };
}

function getDragRange(context, pointerMinute) {
  const minDuration = context.settings.slotMinutes;
  let start = context.anchorMinute;
  let end = pointerMinute;

  if (end >= start) {
    end = Math.max(end, start + minDuration);
  } else {
    start = Math.min(end, context.anchorMinute - minDuration);
    end = context.anchorMinute;
  }

  start = clamp(start, context.boundaryStart, context.boundaryEnd - minDuration);
  end = clamp(end, start + minDuration, context.boundaryEnd);

  return { start, end };
}

function snapMinuteFromClientY({
  boundaryEnd,
  boundaryStart,
  clientY,
  layout,
  allowBoundaryEnd,
  mode,
  settings,
  timelineRect,
}) {
  const rawSlots = (clientY - timelineRect.top) / layout.slotHeight;
  const snappedSlots = mode === "round" ? Math.round(rawSlots) : Math.floor(rawSlots);
  const minute = boundaryStart + snappedSlots * settings.slotMinutes;
  const latestStart = allowBoundaryEnd ? boundaryEnd : boundaryEnd - settings.slotMinutes;

  return clamp(minute, boundaryStart, latestStart);
}

function clearDraftState(context) {
  context.timeline.classList.remove("is-create-target");
  context.draftNode?.remove();
}

function shouldIgnorePointerDown(event) {
  return Boolean(
    event.target.closest(
      ".shift-block, .shift-resize-handle, .on-call-cell, button, input, select, textarea, a",
    ),
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
