import { createScheduleFile, parseScheduleJson } from "./jsonHelpers.js";

const LOCAL_SCHEDULE_KEY = "conference-assistant-scheduler.localSchedule";
const LOCAL_META_KEY = "conference-assistant-scheduler.localMeta";

export function loadLocalAutosave() {
  const storage = getStorage();

  if (!storage) {
    return {
      found: false,
      isAvailable: false,
      isValid: false,
      errors: ["Local autosave is not available in this browser."],
    };
  }

  const jsonText = storage.getItem(LOCAL_SCHEDULE_KEY);

  if (!jsonText) {
    return {
      found: false,
      isAvailable: true,
      isValid: false,
      errors: [],
    };
  }

  const result = parseScheduleJson(jsonText);
  const meta = readLocalAutosaveMeta();

  if (!result.isValid) {
    return {
      found: true,
      isAvailable: true,
      isValid: false,
      errors: result.errors,
    };
  }

  return {
    found: true,
    isAvailable: true,
    isValid: true,
    dirty: Boolean(meta.dirty),
    errors: [],
    savedAt: meta.savedAt || result.metadata?.lastModifiedAt || result.metadata?.exportedAt || "",
    schedule: result.schedule,
    warnings: result.warnings ?? [],
  };
}

export function saveLocalAutosave(schedule, { dirty = true } = {}) {
  const storage = getStorage();

  if (!storage) {
    return {
      ok: false,
      savedAt: "",
      error: "Local autosave is not available in this browser.",
    };
  }

  const savedAt = new Date().toISOString();

  try {
    storage.setItem(LOCAL_SCHEDULE_KEY, JSON.stringify(createScheduleFile(schedule)));
    storage.setItem(LOCAL_META_KEY, JSON.stringify({ dirty: Boolean(dirty), savedAt }));

    return {
      ok: true,
      savedAt,
      error: "",
    };
  } catch {
    return {
      ok: false,
      savedAt: "",
      error: "Local autosave failed. Export JSON to keep a backup.",
    };
  }
}

export function markLocalAutosaveExported() {
  const meta = readLocalAutosaveMeta();

  return writeLocalAutosaveMeta({
    ...meta,
    dirty: false,
    savedAt: meta.savedAt || new Date().toISOString(),
  });
}

export function clearLocalAutosave() {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  storage.removeItem(LOCAL_SCHEDULE_KEY);
  storage.removeItem(LOCAL_META_KEY);

  return true;
}

export function readLocalAutosaveMeta() {
  const storage = getStorage();

  if (!storage) {
    return {
      dirty: false,
      savedAt: "",
    };
  }

  try {
    const raw = storage.getItem(LOCAL_META_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    return {
      dirty: Boolean(parsed.dirty),
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    };
  } catch {
    return {
      dirty: false,
      savedAt: "",
    };
  }
}

function writeLocalAutosaveMeta(meta) {
  const storage = getStorage();

  if (!storage) {
    return {
      ok: false,
      error: "Local autosave is not available in this browser.",
    };
  }

  try {
    storage.setItem(LOCAL_META_KEY, JSON.stringify(meta));
    return {
      ok: true,
      error: "",
    };
  } catch {
    return {
      ok: false,
      error: "Local autosave status could not be updated.",
    };
  }
}

function getStorage() {
  try {
    const storage = globalThis.localStorage;
    const testKey = "conference-assistant-scheduler.storageTest";

    storage.setItem(testKey, "1");
    storage.removeItem(testKey);

    return storage;
  } catch {
    return null;
  }
}
