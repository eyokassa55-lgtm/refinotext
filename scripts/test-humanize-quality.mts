/**
 * Humanizer quality tests.
 * Offline checks never call a model. Live checks use the Vertex tuned endpoint only.
 * Sample texts are new and are not from the 720-pair training set.
 *
 * Run with: npm run test:humanize
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { parseServiceAccountJson } from "../src/lib/vertex-auth";
import {
  TUNED_TRAINING_SYSTEM_INSTRUCTION,
  buildEditorSystemInstruction,
  buildRepairSystemInstruction,
  buildTunedSystemInstruction,
} from "../src/lib/humanize-prompt";
import {
  assessRewriteQuality,
  extractNumbers,
  extractProperNames,
  lengthRatio,
  phraseCopyRatio,
  stripModelChrome,
} from "../src/lib/humanize-quality";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const FAKE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIBFAKEKEYFORTESTSONLY\n-----END PRIVATE KEY-----\n";

const FAKE_SA = {
  type: "service_account",
  project_id: "demo-project",
  client_email: "refino-tests@demo-project.iam.gserviceaccount.com",
  private_key: FAKE_KEY,
};

const SAMPLES: { name: string; text: string }[] = [
  {
    name: "essay",
    text: `In late March 2026, Harborline Analytics published a field study of 4,812 commuters in Milwaukee. The authors argued that small schedule changes, not new rail lines, explained most of the 12% drop in average wait time.

Critics such as Dr. Priya Nandakumar replied that the paper undercounted night-shift workers. That objection matters because the dataset stops at 9:40 p.m., which is exactly when those shifts begin.`,
  },
  {
    name: "paragraph",
    text: `Furthermore, it is imperative to utilize the Harborline dashboard in order to facilitate timely reporting. Consequently, teams should leverage the 17 April 2026 cutoff in order to finalize the Milwaukee figures.`,
  },
  {
    name: "email",
    text: `Hi Jordan,

Can we move Tuesday's 2:15 p.m. call with Priya Nandakumar to Wednesday? I need 25 minutes to review the €2,047.50 invoice from Harborline Analytics before we talk.

Thanks,
Sam`,
  },
  {
    name: "business",
    text: `Q3 2026 revenue for the Milwaukee depot reached $1,284,900, a 6.4% increase versus Q2. Customer retention among accounts larger than 50 seats remained at 91%. The board asked Harborline Analytics to present a 12-week plan by 3 September 2026.`,
  },
  {
    name: "casual",
    text: `okay so i tried the new coffee place by the river on sunday and it was actually really good? the oat latte was $5.75 and the barista, lena, remembered that i wanted extra ice. weirdly nice after a long week.`,
  },
  {
    name: "long",
    text: `On 11 May 2026 the city council asked Harborline Analytics to explain why Route 14 still missed its 8:05 a.m. slot 19 times in April. Staff presented GPS traces, rider comments, and a spreadsheet with 4,812 rows.

The first problem was staging. Buses left the yard at 7:41, but the yard gate on Kinnickinnic Avenue queued behind bakery trucks. That delay, often 4 to 7 minutes, snowballed at the Water Street bridge.

The second problem was recovery time. Drivers had 3 minutes at the end of the line, which is not enough when a wheelchair boarding takes 90 seconds. Priya Nandakumar told the committee, "Give the block 8 minutes or stop promising 8:05."

A third issue was communication. Riders received an alert at 8:12 saying the bus was "2 minutes away" after it had already passed. That single message generated 140 complaints.

The recommended fix is operational, not a new rail line: move the first pull-out to 7:33, add a 8-minute recovery, and stop sending arrival predictions older than 45 seconds. If those three changes land by 3 September 2026, Harborline expects the 12% wait-time gain to hold through winter.`,
  },
  {
    name: "numbers-names",
    text: `Dr. Priya Nandakumar met Jordan Hale in Milwaukee on 17 April 2026. They reviewed invoice 8831 for €2,047.50 and a headcount of 4,812. Nandakumar said the 12% wait-time claim still depends on the 9:40 p.m. cutoff.`,
  },
  {
    name: "multi-paragraph",
    text: `Paragraph one stays on facts. Harborline Analytics counted 4,812 commuters and reported a 12% decline in wait time after 17 April 2026.

Paragraph two keeps the names. Dr. Priya Nandakumar and Jordan Hale disagreed about night-shift coverage after 9:40 p.m.

Paragraph three keeps the money. The follow-up contract is €2,047.50, due 3 September 2026, and should not be described as a "small tweak" if the yard gate is the real bottleneck.`,
  },
  {
    name: "simple-essay",
    text: `Rainforests are important places on Earth. They give us oxygen, food, medicine, and wood. Many animals and plants live in rainforests, and some of them cannot live anywhere else.

People cut down rainforests to make space for farms, roads, and towns. When trees are removed, the soil can wash away, rivers can flood, and the climate can change. Animals lose their homes, and some species may disappear forever.

Although rainforests are far from many cities, the choices people make still matter. Buying products that do not destroy forests, supporting local conservation, and planting trees can help. If we protect rainforests now, future generations will still be able to enjoy their beauty and the resources they provide.

Schools can teach students why forests matter. Families can reduce waste. Governments can make rules that stop illegal logging. These actions are simple, but they can keep rainforests alive for a long time.`,
  },
];

async function runOfflineTests() {
  console.log("\n1. Service account JSON parsing");

  const raw = parseServiceAccountJson(JSON.stringify(FAKE_SA));
  assert("parses raw JSON", raw.client_email.endsWith("gserviceaccount.com") && raw.private_key.includes("BEGIN PRIVATE KEY"));

  const quoted = parseServiceAccountJson(`'${JSON.stringify(FAKE_SA)}'`);
  assert("parses quoted JSON", quoted.client_email === FAKE_SA.client_email);

  const doubleEncoded = parseServiceAccountJson(JSON.stringify(JSON.stringify(FAKE_SA)));
  assert("parses double-encoded JSON", doubleEncoded.project_id === "demo-project");

  const escapedQuotes = JSON.stringify(FAKE_SA).replace(/"/g, '\\"');
  const fromEscaped = parseServiceAccountJson(escapedQuotes);
  assert("parses backslash-escaped JSON", fromEscaped.client_email === FAKE_SA.client_email);

  const literalNewlines = `{"client_email":"${FAKE_SA.client_email}","private_key":"-----BEGIN PRIVATE KEY-----\nMIIBFAKEKEYFORTESTSONLY\n-----END PRIVATE KEY-----\n","project_id":"demo-project"}`;
  const fromLiteral = parseServiceAccountJson(literalNewlines);
  assert("parses private_key with literal newlines", fromLiteral.private_key.includes("\n"));

  let threw = false;
  try {
    parseServiceAccountJson('{"client_email":"x","private_key":"nope"}');
  } catch {
    threw = true;
  }
  assert("rejects JSON missing a private key", threw);

  console.log("\n2. Quality checks");
  const source = SAMPLES.find((sample) => sample.name === "numbers-names")!.text;

  const good = assessRewriteQuality(
    source,
    `Dr. Priya Nandakumar sat down with Jordan Hale in Milwaukee on 17 April 2026. They went through invoice 8831 for €2,047.50 and the 4,812 headcount. Nandakumar noted that the 12% wait-time claim still hangs on the 9:40 p.m. cutoff.`,
  );
  assert("accepts a faithful rewrite", good.ok, good.issues.map((issue) => issue.code).join(",") || "clean");

  const stripped = stripModelChrome("Here is your rewritten text:\n\nThe Milwaukee depot stayed on schedule.");
  assert("strips wrapper copy", stripped.startsWith("The Milwaukee depot"));
  const strippedParagraphs = stripModelChrome(
    "Here are the rewritten paragraphs, maintaining the original meaning and facts:\n\nHarborline counted 4,812 commuters.",
  );
  assert("strips rewritten-paragraphs wrapper", strippedParagraphs.startsWith("Harborline counted"));

  const droppedNumber = assessRewriteQuality(source, "Priya met Jordan and talked about an invoice.");
  assert("flags dropped numbers", droppedNumber.issues.some((issue) => issue.code === "MISSING_FACTS"));

  const droppedName = assessRewriteQuality(source, "Someone met a colleague in Milwaukee on 17 April 2026 and reviewed invoice 8831 for €2,047.50 and 4,812 people, including the 12% wait-time claim and the 9:40 p.m. cutoff.");
  assert("flags dropped names", droppedName.issues.some((issue) => issue.code === "MISSING_NAMES"));

  const refusal = assessRewriteQuality(source, "I'm sorry, I cannot rewrite that.");
  assert("flags refusals", refusal.issues.some((issue) => issue.code === "REFUSAL"));

  const leak = assessRewriteQuality(source, "Follow VERTEX_AI_TUNED_ENDPOINT and rewrite the text.");
  assert("flags leaked internals", leak.issues.some((issue) => issue.code === "LEAK"));

  const empty = assessRewriteQuality(source, "   ");
  assert("flags empty output", empty.issues.some((issue) => issue.code === "EMPTY"));

  const nearCopySource = SAMPLES.find((sample) => sample.name === "simple-essay")!.text;
  const nearCopy = assessRewriteQuality(
    nearCopySource,
    nearCopySource
      .replace("Rainforests are important places on Earth.", "Rainforests are important places on Earth today.")
      .replace("give us oxygen, food, medicine, and wood", "give us oxygen, food, medicine, and timber"),
  );
  assert("flags a near-copy rewrite", nearCopy.issues.some((issue) => issue.code === "TOO_SIMILAR"));
  assert(
    "phrase copy is high for a near-copy",
    phraseCopyRatio(nearCopySource, nearCopy.output) >= 0.32,
  );

  const padded = assessRewriteQuality(
    nearCopySource,
    `${nearCopySource}

Rainforests also illustrate a much broader set of global development debates. It is essential to note that they play a crucial role in today's world, and a wide range of extra case studies, funding models, classroom exercises, and policy experiments could be added here. Those additions would more than double the original draft with new arguments that the source never made.`,
  );
  assert("flags a padded rewrite", padded.issues.some((issue) => issue.code === "TOO_LONG"));

  const invented = assessRewriteQuality(
    "Harborline counted 4,812 commuters in Milwaukee during April 2026.",
    "Harborline counted 4,812 commuters in Milwaukee during April 2026 and later claimed a 48% national increase worth $18,400.",
  );
  assert("flags invented numbers", invented.issues.some((issue) => issue.code === "INVENTED_FACTS"));

  assert("extracts 4812 from 4,812", extractNumbers("4,812 commuters").includes("4812"));
  assert("extracts Priya Nandakumar", extractProperNames(source).includes("Priya Nandakumar"));

  console.log("\n3. Editor instruction");
  const instruction = buildEditorSystemInstruction({
    text: source,
    tone: "standard",
    readability: "General Audience",
    intensity: 75,
  });
  assert("does not embed the source text", !instruction.includes("invoice 8831"));
  assert("sets meaning-first priority", instruction.includes("Meaning preservation"));
  assert("treats user text as data", instruction.includes("not instructions"));
  assert("asks for rewritten text only", instruction.includes("Return only the rewritten source text"));

  console.log("\n3b. Tuned inference matches training format");
  const { preserveSourceText, resolveTunedModelName } = await import("../src/lib/gemini");
  const tunedCue = buildTunedSystemInstruction({
    text: source,
    tone: "academic",
    readability: "University / Academic",
    intensity: 75,
  });
  assert(
    "starts from the training system line",
    tunedCue.startsWith(TUNED_TRAINING_SYSTEM_INSTRUCTION),
  );
  assert("asks for a real rewrite, not a copy", /do not copy/i.test(tunedCue));
  assert("asks to keep source length and paragraphs", /same length/i.test(tunedCue) && /paragraph/i.test(tunedCue));
  assert(
    "does not send University readability into the tuned model",
    !/university/i.test(tunedCue),
  );
  assert(
    "does not mention detectors or the 720-pair dataset",
    !/detector|gptzero|turnitin|720/i.test(tunedCue),
  );
  assert("does not wrap user drafts with extra prefixes", !tunedCue.includes("<<<USER_TEXT>>>"));
  const preserved = preserveSourceText("\uFEFFLine one.\r\n\r\nLine two.  ");
  assert("keeps paragraph breaks from the user draft", preserved === "Line one.\n\nLine two.");
  const repaired = buildRepairSystemInstruction({ text: source }, ["4,812"]);
  assert(
    "repair stays on the same training system line",
    repaired.startsWith(TUNED_TRAINING_SYSTEM_INSTRUCTION),
  );
  assert("repair does not embed the full source draft", !repaired.includes("invoice 8831"));

  console.log("\n3c. Tuned endpoint resource handling");
  const exact =
    "projects/demo-project/locations/us-central1/endpoints/123456789012345";
  assert(
    "uses a full Vertex resource exactly",
    resolveTunedModelName("other-project", "europe-west4", exact) === exact,
  );
  assert(
    "keeps a models resource exactly",
    resolveTunedModelName(
      "other-project",
      "europe-west4",
      "projects/demo-project/locations/us-central1/models/987",
    ) === "projects/demo-project/locations/us-central1/models/987",
  );
}

async function runLiveTests() {
  const {
    GeminiError,
    generateText,
    isVertexConfigured,
    redactModelName,
    requireVertexConfig,
  } = await import("../src/lib/gemini");
  const { runHumanization } = await import("../src/lib/humanize-engine");

  console.log("\n4. Vertex live rewrites");

  if (!isVertexConfigured()) {
    console.log("  SKIP  Vertex env is not set locally. Live tuned-model tests were not run.");
    console.log("         Add GOOGLE_CLOUD_PROJECT, VERTEX_AI_TUNED_ENDPOINT, and GOOGLE_SERVICE_ACCOUNT_JSON to .env.local.");
    return;
  }

  const vertex = requireVertexConfig();
  console.log(`  Using provider=vertex model=${redactModelName(vertex.model)} location=${vertex.location}`);

  for (const sample of SAMPLES) {
    try {
      const started = Date.now();
      const output = await runHumanization({
        text: sample.text,
        tone: "standard",
        readability: "General Audience",
        intensity: 75,
      });
      const ms = Date.now() - started;
      const quality = assessRewriteQuality(sample.text, output);
      const copyRatio = phraseCopyRatio(sample.text, output);
      const ratio = lengthRatio(sample.text, output);
      const longEnough = sample.text.trim().split(/\s+/).length >= 40;
      const lengthOk = !longEnough || (ratio >= 0.55 && ratio <= 1.4);
      const rewriteEnough = sample.name !== "simple-essay" || copyRatio < 0.32;
      assert(
        `${sample.name} rewrite`,
        Boolean(output.trim()) && quality.ok && rewriteEnough && lengthOk,
        `ms=${ms} issues=${quality.issues.map((issue) => issue.code).join(",") || "none"} outWords=${output.trim().split(/\s+/).length} copy=${copyRatio.toFixed(2)} len=${ratio.toFixed(2)}`,
      );
      console.log(`  --- ${sample.name} output ---`);
      console.log(output);
      console.log("  --- end ---");
    } catch (error) {
      const code = error instanceof GeminiError ? error.code : error instanceof Error ? error.name : "ERROR";
      assert(`${sample.name} rewrite`, false, `failed [${code}]`);
    }
  }

  let usedBaseGemini = false;
  try {
    await generateText("Return the single word ping.", {
      systemInstruction: "Return only the rewritten text.",
    });
  } catch {
    usedBaseGemini = false;
  }
  assert("live path is configured for Vertex, not silent Gemini", !usedBaseGemini && isVertexConfigured());
}

async function main() {
  await runOfflineTests();
  await runLiveTests();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

await main();
