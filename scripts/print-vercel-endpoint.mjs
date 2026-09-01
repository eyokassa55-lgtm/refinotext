const endpoint =
  process.env.TUNED_MODEL_ENDPOINT || process.env.VERTEX_AI_TUNED_ENDPOINT || "";
const match = endpoint.match(/endpoints\/[^/?#]+/);
console.log("TUNED_MODEL_ENDPOINT:", match?.[0] ?? "(missing)");
console.log("GOOGLE_CLOUD_PROJECT:", process.env.GOOGLE_CLOUD_PROJECT ? "set" : "missing");
console.log("GOOGLE_SERVICE_ACCOUNT_JSON:", process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? "set" : "missing");
