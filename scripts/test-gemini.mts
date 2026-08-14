/**
 * One-shot Gemini connectivity check.
 * Never prints GEMINI_API_KEY.
 *
 * Run with: npm run test:gemini
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const { GeminiError, generateText, getGeminiModel } = await import(
  "../src/lib/gemini"
);

async function main() {
  const model = getGeminiModel();
  console.log(`Model: ${model}`);
  console.log("Sending a simple test prompt…");

  try {
    const text = await generateText(
      'Reply with exactly this sentence and nothing else: Gemini connected.',
    );
    console.log(`Response: ${text}`);
    console.log("Gemini test succeeded.");
  } catch (error) {
    if (error instanceof GeminiError) {
      console.error(`Gemini test failed [${error.code}]: ${error.message}`);
    } else {
      console.error("Gemini test failed with an unexpected error.");
    }
    process.exitCode = 1;
  }
}

await main();
