const fs = require("fs");

const text = fs.readFileSync(".env.local", "utf8");
const keys = [
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_LOCATION",
  "TUNED_MODEL_ENDPOINT",
  "VERTEX_AI_TUNED_ENDPOINT",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GEMINI_MODEL",
  "ALLOW_BASE_GEMINI_FALLBACK",
];

function getValue(key) {
  const match = text.match(new RegExp("^" + key + "=(.*)$", "m"));
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

for (const key of keys) {
  const raw = getValue(key);
  if (!raw) {
    console.log(key + ": missing");
    continue;
  }
  if (key === "TUNED_MODEL_ENDPOINT" || key === "VERTEX_AI_TUNED_ENDPOINT") {
    const id = raw.match(/\/((?:endpoints|models)\/[^/?#]+)/);
    const invalid = /^gemini-/i.test(raw);
    console.log(key + ": " + (invalid ? "INVALID_BASE_MODEL" : id ? id[1] : "set-nonstandard"));
    continue;
  }
  if (key === "GOOGLE_SERVICE_ACCOUNT_JSON") {
    console.log(key + ": set");
    continue;
  }
  if (key === "GOOGLE_CLOUD_PROJECT") {
    console.log(key + ": set");
    continue;
  }
  console.log(key + ": " + raw);
}
