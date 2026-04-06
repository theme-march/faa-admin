const fs = require("fs");
const path = require("path");

const OVERRIDES_DIR = path.join(__dirname, "..", "storage");
const OVERRIDES_FILE = path.join(OVERRIDES_DIR, "event-invoice-overrides.json");

function ensureStorage() {
  if (!fs.existsSync(OVERRIDES_DIR)) {
    fs.mkdirSync(OVERRIDES_DIR, { recursive: true });
  }
  if (!fs.existsSync(OVERRIDES_FILE)) {
    fs.writeFileSync(OVERRIDES_FILE, JSON.stringify({}, null, 2), "utf8");
  }
}

function readOverrides() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(OVERRIDES_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeOverrides(nextOverrides) {
  ensureStorage();
  const safeValue = nextOverrides && typeof nextOverrides === "object" ? nextOverrides : {};
  fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(safeValue, null, 2), "utf8");
}

function getEventOverride(eventId) {
  const normalizedEventId = String(eventId || "").trim();
  if (!normalizedEventId) return null;
  const allOverrides = readOverrides();
  const eventOverride = allOverrides[normalizedEventId];
  if (!eventOverride || typeof eventOverride !== "object") return null;
  return eventOverride;
}

function saveEventOverride(eventId, data = {}) {
  const normalizedEventId = String(eventId || "").trim();
  if (!normalizedEventId) return false;

  const allOverrides = readOverrides();
  allOverrides[normalizedEventId] = {
    invoice_title: String(data.invoice_title || "").trim(),
    contact_details: String(data.contact_details || "").trim(),
    logo_path: String(data.logo_path || "").trim(),
    updated_at: new Date().toISOString(),
  };
  writeOverrides(allOverrides);
  return true;
}

module.exports = {
  readOverrides,
  writeOverrides,
  getEventOverride,
  saveEventOverride,
};

