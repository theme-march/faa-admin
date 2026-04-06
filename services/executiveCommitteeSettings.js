const fs = require("fs");
const path = require("path");

const STORAGE_DIR = path.join(__dirname, "..", "storage");
const SETTINGS_FILE = path.join(STORAGE_DIR, "executive-committee-settings.json");

const DEFAULT_EXECUTIVE_COMMITTEE_SETTINGS = {
  committee_title: "FAA Executive Committee 2025-27",
};

function ensureStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(DEFAULT_EXECUTIVE_COMMITTEE_SETTINGS, null, 2),
      "utf8"
    );
  }
}

function getSettings() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      ...DEFAULT_EXECUTIVE_COMMITTEE_SETTINGS,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
  } catch (error) {
    return { ...DEFAULT_EXECUTIVE_COMMITTEE_SETTINGS };
  }
}

function saveSettings(payload = {}) {
  ensureStorage();
  const current = getSettings();
  const nextValue = {
    ...current,
    committee_title:
      String(payload.committee_title || "").trim() ||
      DEFAULT_EXECUTIVE_COMMITTEE_SETTINGS.committee_title,
    updated_at: new Date().toISOString(),
  };

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(nextValue, null, 2), "utf8");
  return nextValue;
}

module.exports = {
  DEFAULT_EXECUTIVE_COMMITTEE_SETTINGS,
  getSettings,
  saveSettings,
};
