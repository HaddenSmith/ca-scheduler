export const APP_MODES = {
  EDITOR: "editor",
  VIEWER: "viewer",
  HA_REVIEW: "ha-review",
};

export function getAppMode(value) {
  const mode = String(value ?? "").trim().toLowerCase();

  if (mode === APP_MODES.HA_REVIEW) {
    return APP_MODES.HA_REVIEW;
  }

  if (["view", "viewer", "readonly", "read-only"].includes(mode)) {
    return APP_MODES.VIEWER;
  }

  return APP_MODES.EDITOR;
}

export function isReadOnlyMode(mode) {
  return mode === APP_MODES.VIEWER || mode === APP_MODES.HA_REVIEW;
}

export function getModeScheduleUrl(mode) {
  return mode === APP_MODES.HA_REVIEW
    ? "./data/ha-review-schedule.json"
    : "./data/published-schedule.json";
}
