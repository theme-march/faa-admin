const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return;

  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envPath);
      return;
    } catch (e) {
      // Fallback if built-in parser fails
    }
  }

  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const equalsIdx = line.indexOf("=");
      if (equalsIdx === -1) continue;
      const key = line.slice(0, equalsIdx).trim();
      let value = line.slice(equalsIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    // Ignore error
  }
}

loadEnv();

function getFrontendBaseUrl() {
  return (
    process.env.FRONTEND_BASE_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://faa-dubd.org"
      : "http://localhost:3001")
  ).replace(/\/+$/, "");
}

function getBackendBaseUrl() {
  return (
    process.env.BACKEND_BASE_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://cms.faa-dubd.org"
      : "http://localhost:3000")
  ).replace(/\/+$/, "");
}

module.exports = {
  loadEnv,
  getFrontendBaseUrl,
  getBackendBaseUrl,
};
