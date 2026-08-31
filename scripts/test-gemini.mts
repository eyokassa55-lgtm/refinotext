/**
 * One-shot Vertex tuned-model connectivity check.
 * Never prints API keys, private keys, or service-account JSON.
 *
 * Run with: npm run test:gemini
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const {
  GeminiError,
  generateText,
  getGeminiModel,
  getVertexConfig,
  isBaseGeminiFallbackEnabled,
  isVertexConfigured,
  redactModelName,
} = await import("../src/lib/gemini");
const { buildTunedSystemInstruction } = await import("../src/lib/humanize-prompt");

async function main() {
  const vertex = getVertexConfig();
  const model = getGeminiModel();

  console.log(`Provider: ${isVertexConfigured() ? "vertex" : "gemini-api"}`);
  console.log(`Model: ${redactModelName(model)}`);
  console.log(`Base Gemini fallback: ${isBaseGeminiFallbackEnabled() ? "on" : "off"}`);
  if (vertex) {
    console.log(`Location: ${vertex.location}`);
  }

  if (!isVertexConfigured()) {
    console.error(
      "Vertex AI is not configured. Set GOOGLE_CLOUD_PROJECT, TUNED_MODEL_ENDPOINT (or VERTEX_AI_TUNED_ENDPOINT), and GOOGLE_SERVICE_ACCOUNT_JSON. GOOGLE_CLOUD_LOCATION is optional when the endpoint resource already includes a location. This test will not call gemini-2.5-flash-lite.",
    );
    process.exitCode = 1;
    return;
  }

  const input =
    "Furthermore, it is imperative to analyze the data systematically. Consequently, this study demonstrates significant statistical correlations across multiple key parameters.";

  console.log("Sending the user text to the tuned Vertex endpoint…");

  try {
    const text = await generateText(input, {
      systemInstruction: buildTunedSystemInstruction(),
    });
    console.log(`Response: ${text}`);
    console.log("Vertex tuned-model test succeeded.");
  } catch (error) {
    if (error instanceof GeminiError) {
      console.error(`Vertex test failed [${error.code}]: ${error.message}`);
    } else {
      console.error("Vertex test failed with an unexpected error.");
    }
    process.exitCode = 1;
  }
}

await main();
