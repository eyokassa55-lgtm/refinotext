/**
 * Humanizer quality tests.
 * Offline checks never call a model. Live Vertex checks run when
 * TUNED_MODEL_ENDPOINT is set. Full rewrite samples require RUN_VERTEX_LIVE=1.
 *
 * Run with: npm run test:humanize
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { parseServiceAccountJson } from "../src/lib/vertex-auth";
import {
  HUMAN_REWRITE_SYSTEM_INSTRUCTION,
  OG_REFINO_TRAINING_SYSTEM_INSTRUCTION,
  TUNED_TRAINING_SYSTEM_INSTRUCTION,
  buildAntiTemplateRewriteInstruction,
  buildEditorSystemInstruction,
  buildHumanRewriteInstruction,
  buildOgRefinoInferenceInstruction,
  buildRepairSystemInstruction,
  buildStyleGuidedRewriteInstruction,
  buildTunedSystemInstruction,
} from "../src/lib/humanize-prompt";
import {
  findBannedAiPhrases,
  isTemplateLikeOutput,
  looksLikeGenericEssay,
} from "../src/lib/humanize-voice";
import {
  assessRewriteQuality,
  extractNumbers,
  extractProperNames,
  lengthRatio,
  phraseCopyRatio,
  stripModelChrome,
} from "../src/lib/humanize-quality";
import type { HumanizeResult } from "../src/lib/humanize-engine";
import {
  extractGrubbyHumanizePayload,
  GRUBBY_MCP_URL,
  parseSseJsonRpcMessages,
} from "../src/lib/grubby";

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

const SAME_TOPIC_DIFFERENT_ESSAY = `Rising temperatures are already changing how cities plan for heat waves and flooding. Burning coal, oil, and gas still puts greenhouse gases into the air, and those gases hold heat around the planet.

Coastal towns see higher tides more often. Farmers notice longer dry spells, then sudden storms that wash soil away. Coral reefs bleach when the water stays too warm for too many weeks.

Cutting emissions, protecting forests, and using cleaner energy will not reverse every loss, but they can slow the damage. Local governments can also prepare hospitals, cooling centers, and storm drains so people are less exposed while the atmosphere is still warming.`;

const NEW_ESSAY = SAMPLES.find((sample) => sample.name === "simple-essay")!.text;
const NEW_TOPIC = SAMPLES.find((sample) => sample.name === "essay")!.text;

const AI_TECH_ESSAY = `The development of artificial intelligence is changing modern technology in schools, hospitals, and workplaces. Machine learning systems now sort images, draft messages, and flag unusual patterns in large datasets.

These tools can save time, but they also raise questions about privacy, bias, and who is accountable when a model is wrong. Teams that adopt AI still need clear review steps, accurate training data, and people who understand the limits of automation.

Used carefully, AI can support research and customer service. Used carelessly, it can spread errors faster than a person would. The practical task is to keep human judgment in the loop while taking advantage of faster analysis.`;

const EDUCATION_ESSAY = `Education remains one of the strongest paths to opportunity. Classrooms that mix discussion, practice, and feedback help students remember ideas longer than lectures alone.

Access still varies. Some schools have reliable internet, current books, and enough teachers. Others do not. Closing that gap matters because skills in reading, writing, and problem-solving affect later work and civic life.

Lifelong learning also matters. Adults change jobs more often than earlier generations, so short courses, libraries, and online lessons can keep knowledge from stopping at graduation.`;

const ENVIRONMENT_ESSAY = `Protecting the environment is no longer only a local issue. Air quality, rivers, and forests are linked to how cities produce energy, grow food, and throw things away.

Planting trees, cutting waste, and using cleaner power can reduce harm, but they work best when governments, businesses, and households act together. A single recycling bin does not fix polluted water if factories still dump chemicals upstream.

Young people often lead cleanup projects and ask for clearer rules. Those efforts count, especially when they are paired with measurements that show whether air and water are actually improving.`;

const BUSINESS_ESSAY = `A small business grows when it understands its customers, controls costs, and keeps a reputation for reliable work. Fancy branding cannot replace on-time delivery and honest pricing.

Digital tools help with invoices, inventory, and marketing, yet they do not remove the need for a simple plan. Owners still have to decide which products to keep, which to drop, and how much cash to hold for slow months.

Hiring is another turning point. One skilled employee can raise quality, but payroll must match real revenue. Firms that expand too fast often discover that unpaid invoices, not a lack of ideas, are the real limit.`;

const GENERAL_ESSAY = `Routine is easy to dismiss, but daily habits shape most of a person's results. Sleep, reading, and a short walk do not look dramatic, yet they compound over months.

People often wait for a perfect schedule before they start. A smaller plan that actually happens is usually better. Ten pages a night beats an ambitious list that is abandoned in a week.

Friends and family also influence habits. It is easier to keep a promise when someone else expects you to show up. That is why study groups, training partners, and shared deadlines still matter in an age of solo apps.`;

const TECH_SCREENSHOT_ESSAY = `Technology is now an essential part of modern life, transforming how people communicate, work, and learn. From smartphones to artificial intelligence, technological advancements have made daily tasks faster and more efficient. Information is now accessible within seconds, allowing individuals to expand their knowledge and stay connected with the world.
One of the greatest benefits of technology is its impact on communication. People can interact instantly across continents through social media, video calls, and messaging platforms. This has strengthened global connections and enabled collaboration like never before. In education, technology has opened new opportunities through online learning, making knowledge available to students regardless of their location.
However, technology also presents challenges. Overdependence on digital devices can reduce face-to-face interactions and affect mental well-being. Privacy and data security have also become major concerns as personal information is increasingly stored online. It is important for individuals to use technology responsibly and maintain a balance between digital and real-world experiences.`;

const CHRONOLOGY_ESSAY = `Chronology is the arrangement of events in the order in which they happened. It helps us understand when things took place and how one event can lead to another. Chronology is used in history, science, literature, and everyday life.

For example, when studying the history of a country, we can arrange important events from the earliest to the most recent. This makes it easier to understand the development of the country over time. In the same way, a person can describe their life by explaining what happened first, what happened next, and what happened later.

Chronology is also useful when telling stories. A story can begin with an event, continue with what happened afterward, and end with the final result. Words such as "first," "next," "then," "afterward," and "finally" help show the order of events.

Understanding chronology is important because it helps people organize information and remember events accurately. It also makes complicated subjects easier to understand. Students often use timelines to study historical events and see how they are connected.`;

function meaningPreservation(input: string, output: string) {
  const quality = assessRewriteQuality(input, output);
  const meaningCodes = quality.issues
    .map((issue) => issue.code)
    .filter((code) =>
      [
        "UNRELATED",
        "MISSING_FACTS",
        "MISSING_NAMES",
        "INVENTED_FACTS",
        "TOO_SHORT",
        "COPIED_RETRIEVED",
      ].includes(code),
    );
  return {
    quality,
    result: meaningCodes.length === 0 ? "preserved" : `failed:${meaningCodes.join(",")}`,
  };
}

function printCaseReport(
  label: string,
  input: string,
  result: HumanizeResult,
) {
  const meaning = meaningPreservation(input, result.text);
  const matches =
    (result.retrieval?.matches ?? [])
      .map((match) => `#${match.index}=${match.score}`)
      .join(", ") || "none";
  console.log(`\n  REPORT ${label}`);
  console.log(`    path=${result.source}`);
  console.log(`    band=${result.retrieval?.band ?? "n/a"}`);
  console.log(`    matches=${matches}`);
  console.log(
    `    outputChars=${result.text.length} outputWords=${result.text.trim().split(/\s+/).filter(Boolean).length}`,
  );
  console.log(`    meaning=${meaning.result}`);
}

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

  console.log("\n2b. Template voice detection");
  const aiEssay =
    "Success is a significant life goal, yet its definition varies from person to person. For some, success equates to a thriving career or financial prosperity. Others find fulfillment in a happy family, the pursuit of knowledge, or contributing to their communities. Ultimately, true success often intertwines with personal growth and contentment, not just material wealth. Reaching success typically demands considerable effort, patience, and unwavering determination. Along the path, individuals will inevitably encounter failures and challenges. However, these experiences are invaluable for learning and developing resilience. Those who persist in pursuing their goals despite setbacks often emerge stronger and more self-assured. Establishing clear objectives and cultivating positive habits can further facilitate progress toward these aspirations. Education plays a vital role in achieving success.";
  assert("flags banned AI phrases", findBannedAiPhrases("Ultimately, we must unlock potential.").includes("ultimately"));
  assert("detects template-like essay output", isTemplateLikeOutput(aiEssay, source));
  assert("detects generic topic essays", looksLikeGenericEssay(aiEssay));
  const antiTemplate = buildAntiTemplateRewriteInstruction(
    { text: aiEssay, tone: "standard", intensity: 100 },
    { bannedPhrases: ["ultimately", "unlock"], templateLike: true },
  );
  assert("anti-template retry bans listed phrases", /Remove these words entirely: ultimately, unlock/i.test(antiTemplate));
  assert("anti-template retry asks for short sentences", /very short sentences/i.test(antiTemplate));

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
  assert("asks for rewritten text only", /return only the final refined text/i.test(tunedCue));
  assert("does not ask for analysis", /no analysis|do not add explanations or analysis/i.test(tunedCue));
  assert(
    "rejects one-word swaps",
    /one or two words is not enough/i.test(tunedCue) && /do not copy sentences/i.test(tunedCue),
  );
  assert(
    "sends University readability into the tuned model when selected",
    /university \/ academic reading level/i.test(tunedCue),
  );
  assert(
    "asks for varied sentence length and natural vocabulary",
    /vary sentence lengths/i.test(tunedCue) && /natural vocabulary/i.test(tunedCue),
  );
  assert("uses the Vertex objective line", /reads naturally human while retaining 100%/i.test(tunedCue));
  assert("includes burstiness guidance", /maximize burstiness/i.test(tunedCue) && /3-5 words/i.test(tunedCue));
  assert("bans common AI filler words", /banish ai vocabulary/i.test(tunedCue) && /delve/i.test(tunedCue));
  assert(
    "includes clarity swap guidance",
    /clarity swaps/i.test(tunedCue) &&
      /woven into the fabric|dominates or shapes/i.test(tunedCue) &&
      /people rely on/i.test(tunedCue),
  );
  assert(
    "includes editorial quality priorities",
    /top editorial priorities/i.test(tunedCue) &&
      /vary sentence openings/i.test(tunedCue) &&
      /do not invent a new opposing view/i.test(tunedCue),
  );
  assert("identifies as RefinoText", /you are refinotext/i.test(tunedCue));
  assert(
    "does not mention detector bypass products or the 720-pair dataset",
    !/gptzero|turnitin|originality\.ai|720/i.test(tunedCue) &&
      !/bypass.*detector|beat.*detector|undetectable/i.test(tunedCue),
  );
  assert("does not wrap user drafts with extra prefixes", !tunedCue.includes("<<<USER_TEXT>>>"));
  assert("asks for an academic register when Academic is selected", /academic register/i.test(tunedCue));
  assert(
    "asks for a conversational register when Conversational is selected",
    /conversational register/i.test(buildTunedSystemInstruction({ text: source, tone: "conversational", intensity: 75 })) &&
      /contractions/i.test(buildTunedSystemInstruction({ text: source, tone: "conversational", intensity: 75 })),
  );
  assert(
    "asks for an executive register when Executive is selected",
    /executive register/i.test(buildTunedSystemInstruction({ text: source, tone: "executive", intensity: 75 })),
  );
  assert("does not attach training examples to the tuned prompt", !tunedCue.includes("STYLE REFERENCE"));
  const preserved = preserveSourceText("\uFEFFLine one.\r\n\r\nLine two.  ");
  assert("keeps paragraph breaks from the user draft", preserved === "Line one.\n\nLine two.");
  const repaired = buildRepairSystemInstruction({ text: source }, ["4,812"]);
  assert(
    "repair stays on the same training system line",
    repaired.startsWith(TUNED_TRAINING_SYSTEM_INSTRUCTION),
  );
  assert("repair does not embed the full source draft", !repaired.includes("invoice 8831"));

  console.log("\n3d. Dataset lookup vs Vertex-only Humanize path");
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { findExactTrainingMatch, getTrainingLookupStats, getTrainingPairs } = await import(
    "../src/lib/training-lookup"
  );
  const { findDatabaseMatch, pickDistantStyleReferences } = await import("../src/lib/training-retrieval");
  const { toApiSource } = await import("../src/lib/humanize-engine");
  const stats = getTrainingLookupStats();
  assert("loads all training_data.jsonl rows", stats.rows === 722, `rows=${stats.rows}`);
  assert(
    "keeps a lookup key for every stored input",
    stats.lookupKeys === stats.rows - stats.duplicateInputs,
  );
  const firstLine = readFileSync(join(process.cwd(), "data", "training_data.jsonl"), "utf8")
    .split(/\r?\n/)
    .find(Boolean)!;
  const firstPair = JSON.parse(firstLine) as { input: string; output: string };
  const lookup = findExactTrainingMatch(firstPair.input);
  assert("finds the stored input exactly", Boolean(lookup));
  assert(
    "returns stored human_text byte-for-byte",
    Boolean(lookup) &&
      Buffer.from(lookup!.output, "utf8").equals(Buffer.from(firstPair.output, "utf8")),
    `chars=${firstPair.output.length}`,
  );

  const exactHit = findDatabaseMatch(firstPair.input);
  assert("A path is an exact database match", exactHit?.kind === "exact");
  assert(
    "A output is character-for-character identical",
    Boolean(exactHit) &&
      exactHit!.output === firstPair.output &&
      Buffer.from(exactHit!.output, "utf8").equals(Buffer.from(firstPair.output, "utf8")),
  );
  assert(
    "A reports the stored row with score 1",
    exactHit?.index === lookup!.index && exactHit?.score === 1,
  );

  const techPair = getTrainingPairs()[1]!;
  const oneWordSwap = techPair.input.replace("has become", "is now");
  const oneWordHit = findDatabaseMatch(oneWordSwap);
  assert(
    "tiny wording change still finds stored human_text",
    oneWordHit?.kind !== undefined && oneWordHit.output === techPair.output,
    `kind=${oneWordHit?.kind} row=${oneWordHit?.index}`,
  );

  const screenshotHit = findDatabaseMatch(TECH_SCREENSHOT_ESSAY);
  assert(
    "truncated technology essay still finds stored human_text",
    screenshotHit?.output === techPair.output,
    `kind=${screenshotHit?.kind} row=${screenshotHit?.index}`,
  );

  const truncatedAiText = techPair.input
    .split(/\n\s*\n/)
    .slice(0, -1)
    .join("\n\n");
  const truncatedHit = findDatabaseMatch(truncatedAiText);
  assert(
    "truncated ai_text sample still finds paired human_text",
    truncatedHit?.output === techPair.output,
    `kind=${truncatedHit?.kind} row=${truncatedHit?.index}`,
  );

  const { runHumanization: runEngineHumanization } = await import("../src/lib/humanize-engine");
  const engineExact = await runEngineHumanization({ text: firstPair.input, intensity: 75 });
  assert(
    "Humanize engine returns stored human_text for an exact training row",
    engineExact.source === "EXACT_TRAINING_MATCH" &&
      engineExact.text === firstPair.output &&
      engineExact.retrieval?.band === "exact",
    `source=${engineExact.source}`,
  );
  const engineNear = await runEngineHumanization({ text: oneWordSwap, intensity: 75 });
  assert(
    "Humanize engine returns stored human_text for a near-exact training row",
    engineNear.source === "DATABASE_SIMILARITY_MATCH" && engineNear.text === techPair.output,
    `source=${engineNear.source}`,
  );

  const engineHuman = await runEngineHumanization({ text: firstPair.output, intensity: 75 });
  assert(
    "pasting stored human_text returns it unchanged",
    engineHuman.source === "EXACT_TRAINING_MATCH" && engineHuman.text === firstPair.output,
    `source=${engineHuman.source}`,
  );

  assert("B new essay is not a database match", findDatabaseMatch(NEW_ESSAY) === null);
  assert(
    "C same-topic different essay is not a database match",
    findDatabaseMatch(SAME_TOPIC_DIFFERENT_ESSAY) === null,
  );
  assert("D new topic is not a database match", findDatabaseMatch(NEW_TOPIC) === null);
  assert("T1 AI essay is not a database match", findDatabaseMatch(AI_TECH_ESSAY) === null);
  assert("T2 education essay is not a database match", findDatabaseMatch(EDUCATION_ESSAY) === null);
  assert("T3 environment essay is not a database match", findDatabaseMatch(ENVIRONMENT_ESSAY) === null);
  assert("T4 business essay is not a database match", findDatabaseMatch(BUSINESS_ESSAY) === null);
  assert("T5 general essay is not a database match", findDatabaseMatch(GENERAL_ESSAY) === null);
  assert("chronology essay is not a stored ai_text sample", findDatabaseMatch(CHRONOLOGY_ESSAY) === null);
  assert("trimmed exact paste still hits the dataset", Boolean(findExactTrainingMatch(`\n${firstPair.input}\n`)));

  const newPrompt = buildTunedSystemInstruction({ text: NEW_ESSAY, intensity: 75 });
  assert("new-input prompt does not include training examples", !newPrompt.includes("STYLE REFERENCE"));
  const stylePrompt = buildStyleGuidedRewriteInstruction(
    { text: NEW_ESSAY, intensity: 75 },
    [{ input: firstPair.input, output: firstPair.output }],
  );
  assert("unseen drafts get a before/after rewrite example", stylePrompt.includes("EXAMPLE of how much to rewrite"));
  assert("style prompt forbids copying the example topic", /do not write about the example topic/i.test(stylePrompt));
  assert("rewrite prompt states the source word count", /\d+ words/.test(stylePrompt));
  assert(
    "human rewrite is not a lookup task",
    !HUMAN_REWRITE_SYSTEM_INSTRUCTION.includes("Find the matching human-written version"),
  );
  const rewritePrompt = buildHumanRewriteInstruction({ text: NEW_ESSAY, intensity: 75 }, [
    { input: firstPair.input, output: firstPair.output },
  ]);
  assert("rewrite prompt keeps facts and paragraph breaks", /paragraph breaks/i.test(rewritePrompt));
  const engineSource = readFileSync(join(process.cwd(), "src", "lib", "humanize-engine.ts"), "utf8");
  assert("Humanize engine does not call Grubby", !engineSource.includes("humanizeWithGrubby"));
  const ogCue = buildOgRefinoInferenceInstruction({ text: NEW_ESSAY, intensity: 75 });
  assert(
    "OG REFINO inference starts from the Vertex training system line",
    ogCue.startsWith(OG_REFINO_TRAINING_SYSTEM_INSTRUCTION),
  );
  assert("OG REFINO inference forbids summarizing", /do not summarize/i.test(ogCue));
  assert("unseen drafts use the base Gemini rewriter", engineSource.includes('backend: "base"'));
  assert("Humanize engine does not send new drafts to the lookup-tuned endpoint", !engineSource.includes('backend: "tuned"'));
  assert("Humanize engine sends distant human_text as style", engineSource.includes("pickDistantStyleReferences"));
  assert("Humanize engine disables model thinking so drafts are not truncated", engineSource.includes("thinkingBudget: 0"));
  const styleRefs = pickDistantStyleReferences(NEW_ESSAY, 1);
  assert("picks a distant rewrite demonstration", styleRefs.length === 1, `count=${styleRefs.length}`);
  assert(
    "style demonstration is not the user draft",
    styleRefs.every((row) => !NEW_ESSAY.includes(row.output.slice(0, 48))),
  );
  assert("new-input prompt asks for rewritten text only", /return only the final refined text/i.test(newPrompt));
  assert(
    "standard tone does not add extra register instructions",
    !/academic register|conversational register|executive register/i.test(newPrompt),
  );
  assert("exact match API source is database", toApiSource("EXACT_TRAINING_MATCH") === "database");
  assert("same-draft API source is database", toApiSource("DATABASE_SIMILARITY_MATCH") === "database");
  assert("model rewrite API source stays model", toApiSource("FINE_TUNED_MODEL") === "model");

  console.log("\n3e. Grubby MCP payload parsing");
  assert("uses the official Grubby MCP URL", GRUBBY_MCP_URL === "https://grubby.ai/api/mcp");
  const sse = [
    "event: message",
    'data: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"Harborline changed the Milwaukee timetable."}]}}',
    "",
  ].join("\n");
  const sseMessages = parseSseJsonRpcMessages(sse);
  const sseRecord = sseMessages[0] as { result?: { content?: { text?: string }[] } };
  assert(
    "reads SSE tool text",
    sseRecord?.result?.content?.[0]?.text === "Harborline changed the Milwaukee timetable.",
  );
  const jobPayload = extractGrubbyHumanizePayload(
    JSON.stringify({ status: "processing", job_id: "job_123" }),
  );
  assert("treats a job_id as a pollable job", jobPayload.kind === "job" && jobPayload.jobId === "job_123");
  const textPayload = extractGrubbyHumanizePayload(
    JSON.stringify({ humanized_text: "The depot published a shorter wait-time note." }),
  );
  assert("reads humanized_text from JSON", textPayload.kind === "text" && textPayload.text.includes("depot"));
  const plainPayload = extractGrubbyHumanizePayload("Harborline posted the Milwaukee figures on Tuesday.");
  assert("treats plain tool text as the rewrite", plainPayload.kind === "text");



  const copiedRetrieved = assessRewriteQuality(
    "Harborline counted 4,812 commuters in Milwaukee during April 2026.",
    "Coral reefs bleached after Dr. Elena Voss recorded a 48.6% rise in hospital visits.",
    {
      retrievedPairs: [
        {
          input: "Climate change is accelerating.",
          output: "Coral reefs bleached after Dr. Elena Voss recorded a 48.6% rise in hospital visits.",
        },
      ],
    },
  );
  assert(
    "flags using a stored human_text as the answer",
    copiedRetrieved.issues.some((issue) => issue.code === "COPIED_RETRIEVED" || issue.code === "UNRELATED"),
  );

  const leakedFacts = assessRewriteQuality(
    "Harborline counted 4,812 commuters in Milwaukee during April 2026.",
    "Harborline counted 4,812 commuters in Milwaukee during April 2026 after Dr. Elena Voss recorded a 48.6% rise.",
    {
      retrievedPairs: [
        {
          input: "Climate change is accelerating.",
          output: "Dr. Elena Voss recorded a 48.6% rise in heat-related hospital visits.",
        },
      ],
    },
  );
  assert(
    "flags names and numbers copied from retrieved examples",
    leakedFacts.issues.some((issue) => issue.code === "RETRIEVED_FACTS"),
  );

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
    getGeminiModel,
    isGeminiApiConfigured,
    isVertexConfigured,
    redactModelName,
    requireVertexConfig,
  } = await import("../src/lib/gemini");
  const { runHumanization } = await import("../src/lib/humanize-engine");
  const { getTrainingPairs } = await import("../src/lib/training-lookup");

  console.log("\n4. Live Humanize provider cases");

  if (isVertexConfigured()) {
    const vertex = requireVertexConfig();
    const tunedModel = redactModelName(vertex.model);
    console.log(`  Vertex credentials present (${tunedModel}); unmatched drafts use publisher Gemini`);
    assert(
      "Vertex endpoint env is a resource id",
      tunedModel.startsWith("endpoints/") || tunedModel.startsWith("models/"),
      tunedModel,
    );
  } else if (isGeminiApiConfigured()) {
    const model = redactModelName(getGeminiModel());
    console.log(`  Using provider=gemini-api model=${model}`);
    assert("live path targets Gemini API model", model.startsWith("gemini-"), model);
  } else {
    console.log("  SKIP  No Vertex endpoint or Gemini API key is set locally.");
    return;
  }

  if (process.env.RUN_VERTEX_LIVE !== "1") {
    console.log("  SKIP  Live rewrite samples are off. Set RUN_VERTEX_LIVE=1 to enable.");
    return;
  }

  const storedOutputs = new Set(getTrainingPairs().map((pair) => pair.output));
  const sample = { id: "T6", name: "chronology", text: CHRONOLOGY_ESSAY };

  try {
    const result = await runHumanization({
      text: sample.text,
      tone: "standard",
      readability: "General Audience",
      intensity: 75,
    });
    const copyRatio = phraseCopyRatio(sample.text, result.text);
    const usedStoredEssay = storedOutputs.has(result.text);
    assert(
      `${sample.id} ${sample.name}`,
      result.source === "FINE_TUNED_MODEL" &&
        result.retrieval === null &&
        Boolean(result.text.trim()) &&
        !usedStoredEssay &&
        copyRatio < 0.32,
      `source=${result.source} copy=${copyRatio.toFixed(2)}`,
    );
  } catch (error) {
    const code = error instanceof Error ? error.name : "ERROR";
    assert(`${sample.id} ${sample.name}`, false, `failed [${code}]`);
  }
}

async function main() {
  await runOfflineTests();
  await runLiveTests();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

await main();
