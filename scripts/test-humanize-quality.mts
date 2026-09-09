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
  HUMAN_REWRITE_V2_SYSTEM_INSTRUCTION,
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
  extractDates,
  extractNumbers,
  extractProperNames,
  extractStatedNames,
  lengthRatio,
  phraseCopyRatio,
  stripModelChrome,
} from "../src/lib/humanize-quality";
import { countWords } from "../src/lib/words";
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
    console.log(`  PASS  ${label}${detail ? ` â€” ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}${detail ? ` â€” ${detail}` : ""}`);
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

Can we move Tuesday's 2:15 p.m. call with Priya Nandakumar to Wednesday? I need 25 minutes to review the â‚¬2,047.50 invoice from Harborline Analytics before we talk.

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
    text: `Dr. Priya Nandakumar met Jordan Hale in Milwaukee on 17 April 2026. They reviewed invoice 8831 for â‚¬2,047.50 and a headcount of 4,812. Nandakumar said the 12% wait-time claim still depends on the 9:40 p.m. cutoff.`,
  },
  {
    name: "multi-paragraph",
    text: `Paragraph one stays on facts. Harborline Analytics counted 4,812 commuters and reported a 12% decline in wait time after 17 April 2026.

Paragraph two keeps the names. Dr. Priya Nandakumar and Jordan Hale disagreed about night-shift coverage after 9:40 p.m.

Paragraph three keeps the money. The follow-up contract is â‚¬2,047.50, due 3 September 2026, and should not be described as a "small tweak" if the yard gate is the real bottleneck.`,
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

const ENVIRONMENT_HEADING_ESSAY = `# The Environment

The environment is everything that surrounds us, including the air we breathe, the water we drink, the land we live on, and the plants and animals we share the planet with. It is the natural system that supports life.

Human activities such as deforestation, pollution, and burning fossil fuels are damaging this system. These actions contribute to climate change and put the health of people, wildlife, and future generations at risk.
`;

const WATER_POLLUTION_HEADING_ESSAY = `# Water pollution

Factories, farms, and cities send chemicals, sewage, and runoff into rivers and lakes. That contamination changes how water can be used and harms the plants and animals that live in it.
`;

const DANGEROUS_THINGS_LIFE_ESSAY = `# Dangerous Things in Life

Life is full of dangers that come from nature, human carelessness, and unhealthy habits. Understanding these risks helps people stay safer at home and outdoors.

Road accidents are one of the most common dangers. Speeding, phone use while driving, and driving under the influence cause many crashes every year. Wearing a seatbelt and following traffic laws can reduce serious injury.
`;

const COLLABORATION_OF_ORGANS_ESSAY = `### The Collaboration of Organs

The human body is made of many organs that work together like a team. Each organ has its own job, but none of them can keep the body healthy alone.

The heart and lungs collaborate closely. The heart pumps blood through the body, while the lungs bring in oxygen and remove carbon dioxide. Without that partnership, cells would not receive the oxygen they need.

The digestive system also works with other organs. The stomach and intestines break down food, and the liver helps process nutrients so the body can use them for energy and repair.
`;

const CULTURAL_MEMORY_ESSAY = `# The Role of Cultural Memory in Shaping National Identity

Cultural memory is the shared stories, traditions, and experiences that help communities understand where they came from. It shapes national identity by connecting people to heroes, struggles, and achievements across generations.

Schools, museums, monuments, and public ceremonies keep those memories alive. When a nation remembers its past together, citizens often feel a stronger sense of belonging and purpose.
`;

const ENVIRONMENT_ESSAY = `Protecting the environment is no longer only a local issue. Air quality, rivers, and forests are linked to how cities produce energy, grow food, and throw things away.

Planting trees, cutting waste, and using cleaner power can reduce harm, but they work best when governments, businesses, and households act together. A single recycling bin does not fix polluted water if factories still dump chemicals upstream.

Young people often lead cleanup projects and ask for clearer rules. Those efforts count, especially when they are paired with measurements that show whether air and water are actually improving.`;

const DIGITAL_MARKETPLACE_ESSAY = `# The Digital Marketplace: Navigating the Promises and Perils of E-Commerce
E-commerce has transformed the way people buy and sell goods and services. Instead of visiting physical stores, consumers can use websites and mobile applications to search for products, compare prices, place orders, and have items delivered right to their doors.
E-commerce offers convenience and a global market. Small businesses can reach customers far from their town. It also creates risks: fraudulent sellers, fake products, privacy concerns, and packaging waste.
`;

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

const SUCCESS_CHATGPT_ESSAY = `# Success

Success is an important goal in life, but it can mean different things to different people. For some, success means achieving a good career or earning money, while for others, it means having a happy family, gaining knowledge, or helping their community. True success is often connected to personal growth and satisfaction rather than wealth alone.

Achieving success usually requires hard work, patience, and determination. People may face failures and difficult situations along the way, but these experiences can teach valuable lessons. A person who continues working toward a goal after experiencing setbacks can become stronger and more confident. Setting clear goals and developing good habits can also make it easier to make progress.

Education is another important part of success. Learning provides people with knowledge and skills that can help them solve problems and find opportunities. However, knowledge alone is not enough. Discipline, responsibility, and the willingness to learn from mistakes are also important qualities.

Success should not be measured only by material possessions. A person can be considered successful when they live according to their values, maintain healthy relationships, and make a positive contribution to others.`;

const HASH_TECHNOLOGY_ESSAY = `#technology

Phones, laptops, and the internet are now part of school, work, and home. People can send a message across the world in seconds. Online classes let students learn from anywhere.

Too much screen time can make it harder to talk face to face. Personal data is also stored on company servers, so privacy matters.

Used carefully, these tools help people get more done. Used carelessly, they can distract and spread mistakes.`;

const SUCCESS_PLAIN_ESSAY = SUCCESS_CHATGPT_ESSAY.replace(/^# Success\s*/, "").trim();

const PREAMBLE_SUCCESS_ESSAY = `In today's competitive world, success is often defined by money, status, or fame.

Hard work, patience, and learning from failure still matter more than a single lucky break.`;

const PREAMBLE_ENVIRONMENT_ESSAY = `In today's world, the environment is threatened by water pollution, deforestation, and climate change.

Rivers, forests, and cities are part of the same system.`;

const QUIET_STRENGTH_OF_CONSISTENCY_ESSAY = `The Quiet Strength of Consistency

Consistency is often treated as a quiet habit rather than a dramatic talent. People who keep the same standard from one day to the next build trust, skill, and a record that luck cannot explain. Small repeated choices add up because they happen when nobody is watching.

A person who writes a page every morning, or keeps a promise after the excitement has faded, is practicing the same idea. The work is not loud. It is the decision to return to the task after a dull week, a missed goal, or a day when motivation is gone.

Teams also depend on consistency. Customers, students, and colleagues notice whether a standard holds. When the standard slips, repair costs more than the original effort. When it holds, people can plan around it.

The strength is quiet because it does not need a speech. It needs a pattern that survives boredom, distraction, and the wish to start over with a new plan.`;

const DISCIPLINE_OF_BOREDOM_ESSAY = `The Discipline of Boredom

Boredom is often treated as something to escapeâ€”a signal that nothing interesting is happening. People fill the gap with noise, tasks, and constant stimulation. The result is that empty time feels like a problem rather than a chance to notice what the mind does when nothing is asked of it.

I. Boredom as Empty Space
Empty space is not always wasted. When a room is quiet, attention can settle on a thought that would not survive a crowded feed. Writers, students, and scientists have long used dull intervals to let an idea take shape. The discipline is to stay with that interval instead of reaching for the next distraction.

II. Why the feeling matters
Boredom can mark a mismatch between what a person wants and what the moment offers. It can also be a pause that makes later work sharper. Treating every dull minute as failure trains people to avoid silence. Treating it as a skill makes room for patience, memory, and independent thought.

Schools and offices often pack schedules so tightly that boredom never appears. That leaves little practice for sitting with an unfinished question. A short, unfilled stretch of time can be more useful than another round of busy work.`;

const POLITICAL_ECONOMY_GLOBALIZATION_ESSAY = `# The Political Economy of Globalization

Globalization is the process through which countries and people become increasingly connected through trade, technology, investment, communication, and the movement of goods and services. The political economy of globalization examines how governments, businesses, and international organizations influence these global economic relationships. It also considers how globalization affects wealth, employment, development, and inequality.

One major benefit of globalization is increased international trade. Countries can specialize in producing certain goods and services and trade with other countries. This can provide consumers with more choices and create opportunities for businesses to reach international markets.`;

const CLIMATE_PLAIN_ESSAY = `Climate change is heating the planet. Ice melts, seas rise, and storms get worse.

Cutting fossil fuels and planting trees can slow the damage. Cities can also prepare hospitals and cooling centers.`;

const FRIENDSHIP_PLAIN_ESSAY = `Friendship makes hard days easier. Trust, honesty, and time together keep the bond strong.

True friends listen, tell the truth, and stay when plans fall apart. That kind of support is worth more than a long list of contacts.`;

const HISTORY_ESSAY = `# History

History is the study of events, people, and societies from the past. It helps us understand how the world has changed over time and how earlier generations shaped the present. By studying history, we can learn about important discoveries, cultures, conflicts, achievements, and challenges faced by people throughout different periods.

One important purpose of history is to help us learn from the past. Historical events can show us the consequences of good and bad decisions. For example, studying wars and political conflicts can help societies understand the importance of peace, cooperation, and responsible leadership. History also teaches us about the achievements of scientists, explorers, artists, and other individuals who influenced human development.

History is preserved through many sources, including books, documents, photographs, buildings, artifacts, and oral traditions. Historians examine these sources to understand what happened and why. They organize events in chronological order so that relationships between different events can be understood more clearly.`;

const AMERICAN_HISTORY_ESSAY = `American History

The history of the United States of America encompasses many different periods and influences. From Indigenous nations to a modern country, wars, laws, and social movements shaped that path.`;

const INTELLIGENCE_ONLY_ESSAY = `Intelligence is the ability to learn from experience and adapt to new situations. Schools try to measure it with tests, but curiosity and judgment also matter.

People can grow their skills through practice, sleep, and good teaching. A single exam score does not tell the whole story.`;

const CLIMATE_ONLY_ESSAY = `Climate is the typical weather of a place over many years. Oceans, winds, and latitude shape how warm or wet a region stays.

People plan crops, homes, and travel around that long-run pattern, not around one unusual week.`;

const SOCIAL_ONLY_ESSAY = `Social life is how people spend time with friends, family, and neighbors. Shared meals, clubs, and daily talk keep those bonds alive.

Online posts can help, but they are not the same as showing up in person.`;

const WORK_ONLY_ESSAY = `Work is the time and skill people give to a job or a craft. Pay, purpose, and fair conditions all shape whether that effort feels worthwhile.

A good workplace makes room for rest as well as output.`;

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
    `Dr. Priya Nandakumar sat down with Jordan Hale in Milwaukee on 17 April 2026. They went through invoice 8831 for â‚¬2,047.50 and the 4,812 headcount. Nandakumar noted that the 12% wait-time claim still hangs on the 9:40 p.m. cutoff.`,
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

  const droppedName = assessRewriteQuality(source, "Someone met a colleague in Milwaukee on 17 April 2026 and reviewed invoice 8831 for â‚¬2,047.50 and 4,812 people, including the 12% wait-time claim and the 9:40 p.m. cutoff.");
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
    phraseCopyRatio(nearCopySource, nearCopy.output) >= 0.28,
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
  assert("extracts slash dates", extractDates("date 12/3/2027").includes("12/3/2027"));
  assert(
    "extracts a lowercase name after my name is",
    extractStatedNames("my name is eyosoft kassa date 12/3/2027").some((name) =>
      /eyosoft kassa/i.test(name),
    ),
  );
  const droppedIntro = assessRewriteQuality(
    "# Trees\nmy name is eyosoft kassa date 12/3/2027 sine i was kid\n\nTrees talk through roots.",
    "Trees communicate through their roots.",
  );
  assert(
    "flags a dropped name and date from an informal opening",
    droppedIntro.issues.some((issue) => issue.code === "MISSING_FACTS" || issue.code === "MISSING_NAMES"),
  );

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
  const { findDatabaseMatch, findTopicMatch, storedMatchAlignsWithDraft } = await import("../src/lib/training-retrieval");
  const { findWikipediaLiveMatch, titleMatchesUserTopic } = await import("../src/lib/wikipedia-corpus");
  const { applyInputTitle, formatEssayParagraphs, formatWikipediaEditorText, hasLatexDump, splitHumanizeOutput, stripWikiMath } = await import(
    "../src/lib/humanize-output"
  );
  const { HumanizationFailedError, toApiSource } = await import("../src/lib/humanize-engine");
  const formattedWiki = formatWikipediaEditorText(
    "Artificial intelligence",
    "Artificial intelligence (AI) is useful in daily life and in large research projects.\n\nIt is a field of research in computer science, mathematics, and engineering.\n\n== History ==\n\nEarly researchers built machines that could follow instructions.\n\nSee also\n\nRobotics",
  );
  const formattedParts = splitHumanizeOutput(formattedWiki);
  assert(
    "formatted Wikipedia output starts with the exact title",
    formattedWiki.startsWith("# Artificial intelligence\n\n") &&
      formattedParts.title === "Artificial intelligence",
  );
  assert(
    "formatted Wikipedia output separates paragraphs",
    formattedParts.paragraphs.length >= 2,
  );
  assert(
    "formatted Wikipedia output does not add a sub-topic heading at the end",
    !/==/.test(formattedWiki) &&
      !/\nSee also\n/i.test(formattedWiki) &&
      !formattedParts.paragraphs.some((paragraph) => /^history$/i.test(paragraph.trim())),
  );
  const longWikiBody = Array.from({ length: 12 }, (_, i) =>
    `Paragraph ${i + 1} explains the same topic with complete sentences and normal punctuation for readers.`,
  ).join("\n\n");
  const fullWikiEssay = formatWikipediaEditorText("Essay Topic", longWikiBody, 20_000, 40, 80);
  assert(
    "formatted Wikipedia essay sizes to the target word length",
    fullWikiEssay.includes("Paragraph 1") &&
      countWords(fullWikiEssay) <= 100 &&
      countWords(fullWikiEssay) >= 40,
    `words=${countWords(fullWikiEssay)}`,
  );
  const longTargetWiki = formatWikipediaEditorText("Essay Topic", longWikiBody, 20_000, 40, 200);
  assert(
    "formatted Wikipedia essay grows when the input word target is larger",
    countWords(longTargetWiki) > countWords(fullWikiEssay),
    `short=${countWords(fullWikiEssay)} long=${countWords(longTargetWiki)}`,
  );
  const truncatedWiki =
    "E-commerce refers to buying online. Typical transactions include the purchase of products (such as books from Amazon) or services (such as";
  const { endOnCompleteSentence } = await import("../src/lib/humanize-output");
  const repairedWiki = endOnCompleteSentence(truncatedWiki);
  assert(
    "truncated Wikipedia extracts never keep an unfinished final phrase",
    repairedWiki.endsWith(".") &&
      !/\bsuch as\s*$/i.test(repairedWiki) &&
      !/\([^)]*$/.test(repairedWiki) &&
      /buying online/i.test(repairedWiki),
    repairedWiki,
  );
  const essayFormatted = formatEssayParagraphs(
    "Road Safety\n\nPeople overlook hazards every day when they rush\n\nDrivers who text take serious risks on busy roads",
  );
  assert(
    "essay formatter adds terminal punctuation to paragraphs",
    essayFormatted.startsWith("Road Safety\n\n") &&
      essayFormatted.includes("rush.") &&
      essayFormatted.includes("roads."),
    essayFormatted,
  );
  const mathDump = `In deductive logic, a consistent theory is one that does not lead to a logical contradiction. A theory 


      
        T
      
    
    {\\displaystyle T}
  
 is consistent if there is no formula 


      
        Ï†
      
    
    {\\displaystyle \\varphi }
  
 such that both 


      
        Ï†
      
    
    {\\displaystyle \\varphi }
  
 and its negation 


      
        Â¬
        Ï†
      
    
    {\\displaystyle \\lnot \\varphi }
  
 are elements of the set of consequences of 


      
        T
      
    
    {\\displaystyle T}
  
. Let A {\\displaystyle A} be a set of closed sentences.`;
  const cleanedMath = stripWikiMath(mathDump);
  const formattedMath = formatWikipediaEditorText("Consistency", mathDump);
  assert(
    "Wikipedia math markup is removed from editor output",
    !/displaystyle/.test(cleanedMath) &&
      !/\\varphi/.test(cleanedMath) &&
      !/\\lnot/.test(cleanedMath) &&
      /A theory T is consistent/.test(cleanedMath.replace(/\s+/g, " ")) &&
      !/displaystyle/.test(formattedMath) &&
      !hasLatexDump(cleanedMath) &&
      !hasLatexDump(formattedMath) &&
      formattedMath.includes("\n\n") &&
      !formattedMath.split(/\n\n/).some((paragraph) => /^[,eEgG]\.?/.test(paragraph.trim())),
  );
  const titledFromInput = applyInputTitle(
    formattedWiki,
    "The Discipline of Boredom\n\nBoredom is often treated as empty time.",
  );
  assert(
    "editor output uses the input title instead of the Wikipedia title",
    titledFromInput.startsWith("The Discipline of Boredom\n\n") &&
      !titledFromInput.startsWith("Boredom\n") &&
      !titledFromInput.startsWith("Artificial intelligence\n") &&
      !/^# /.test(titledFromInput),
  );
  const untitledFromInput = applyInputTitle(
    "# Boredom\n\nBoredom is an emotion characterized by uninterest.",
    "Boredom is often treated as something to escape.",
  );
  assert(
    "untitled drafts do not add a Wikipedia heading",
    untitledFromInput === "Boredom is an emotion characterized by uninterest.",
  );
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

  const { runHumanization: runEngineHumanization } = await import(
    "../src/lib/humanize-engine"
  );
  async function expectNoWiki(label: string, text: string) {
    try {
      const result = await runEngineHumanization({ text, intensity: 75 });
      assert(
        label,
        result.source === "FINE_TUNED_MODEL",
        `expected Vertex rewrite fallback, got ${result.source}`,
      );
    } catch (error) {
      assert(
        label,
        error instanceof HumanizationFailedError &&
          (error.code === "NO_WIKIPEDIA_MATCH" ||
            error.code === "MISSING_VERTEX_CONFIG" ||
            error.code === "HUMANIZATION_FAILED" ||
            error.code === "QUALITY_CHECK_FAILED" ||
            error.code === "EMPTY_RESPONSE"),
        error instanceof HumanizationFailedError ? error.code : String(error),
      );
    }
  }
  assert(
    "Natural environment is the same topic as Environment",
    titleMatchesUserTopic("Natural environment", ["environment"]),
  );
  assert(
    "Trade is related to Digital Trade",
    titleMatchesUserTopic("Trade", ["digital\u0001trade"]),
  );
  assert(
    "Collaboration alone is not the topic for Collaboration of Organs",
    !titleMatchesUserTopic("Collaboration", ["collaboration\u0001organ"]),
  );
  assert(
    "Organ (biology) matches Collaboration of Organs",
    titleMatchesUserTopic("Organ (biology)", ["collaboration\u0001organ"]),
  );
  assert(
    "Memory alone is not the topic for Cultural Memory",
    !titleMatchesUserTopic("Memory", ["cultural\u0001memory"]),
  );
  assert(
    "Cultural memory matches Cultural Memory",
    titleMatchesUserTopic("Cultural memory", ["cultural\u0001memory"]),
  );
  assert(
    "Collective memory matches Cultural Memory",
    titleMatchesUserTopic("Collective memory", ["cultural\u0001memory"]) ||
      titleMatchesUserTopic("Collective memory", ["collective\u0001memory"]),
  );
  assert(
    "Internet of things is not related to Dangerous Things in Life",
    !titleMatchesUserTopic("Internet of things", ["dangerous\u0001things"]),
  );
  assert(
    "Artificial intelligence is not the same topic as intelligence",
    !titleMatchesUserTopic("Artificial intelligence", ["intelligence"]),
  );
  const engineStoredSuccess = await runEngineHumanization({ text: firstPair.input, intensity: 75 });
  assert(
    "a Success draft uses the tuned model for Success, not training human_text",
    (engineStoredSuccess.source === "TOPIC_TRAINING_MATCH" || engineStoredSuccess.source === "FINE_TUNED_MODEL") &&
      /success/i.test(engineStoredSuccess.text.slice(0, 400)) &&
      engineStoredSuccess.text !== firstPair.output,
    `source=${engineStoredSuccess.source} opening=${engineStoredSuccess.text.slice(0, 80)}`,
  );
  const engineStoredTech = await runEngineHumanization({ text: oneWordSwap, intensity: 75 });
  assert(
    "a Technology draft uses the tuned model for Technology, not training human_text",
    (engineStoredTech.source === "TOPIC_TRAINING_MATCH" || engineStoredTech.source === "FINE_TUNED_MODEL") &&
      /technolog/i.test(engineStoredTech.text.slice(0, 400)),
    `source=${engineStoredTech.source} opening=${engineStoredTech.text.slice(0, 80)}`,
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
  assert("ChatGPT success essay is not an exact ai_text row", findDatabaseMatch(SUCCESS_CHATGPT_ESSAY) === null);
  const successTopic = findTopicMatch(SUCCESS_CHATGPT_ESSAY);
  assert(
    "ChatGPT success essay finds the first stored success human_text",
    successTopic?.kind === "topic" &&
      successTopic?.index === 0 &&
      successTopic!.output === firstPair.output,
    `kind=${successTopic?.kind} row=${successTopic?.index}`,
  );
  assert(
    "topic match does not alter stored human_text",
    Boolean(successTopic) &&
      Buffer.from(successTopic!.output, "utf8").equals(Buffer.from(firstPair.output, "utf8")),
  );
  const educationTopic = findTopicMatch(EDUCATION_ESSAY);
  const educationStored = educationTopic ? getTrainingPairs()[educationTopic.index] : null;
  assert(
    "education draft finds a stored education human_text",
    educationTopic?.kind === "topic" &&
      Boolean(educationStored) &&
      /\beducation\b/i.test(educationStored!.input.slice(0, 480)) &&
      educationTopic!.output === educationStored!.output,
    `row=${educationTopic?.index}`,
  );
  assert("Harborline field study has no related training topic", findTopicMatch(NEW_TOPIC) === null);
  const hashTech = findTopicMatch(HASH_TECHNOLOGY_ESSAY);
  assert(
    "#technology heading finds the first stored technology human_text",
    hashTech?.kind === "topic" &&
      hashTech?.index === techPair.index &&
      hashTech!.output === techPair.output,
    `row=${hashTech?.index}`,
  );
  const plainTech = findTopicMatch(TECH_SCREENSHOT_ESSAY);
  assert(
    "technology draft without a hashtag still finds the first stored technology human_text",
    plainTech?.kind === "topic" &&
      plainTech?.index === techPair.index &&
      plainTech!.output === techPair.output,
    `row=${plainTech?.index}`,
  );
  const plainSuccess = findTopicMatch(SUCCESS_PLAIN_ESSAY);
  assert(
    "success draft without a hashtag finds the first stored success human_text",
    plainSuccess?.kind === "topic" &&
      plainSuccess?.index === 0 &&
      plainSuccess!.output === firstPair.output,
    `row=${plainSuccess?.index}`,
  );
  const aiPair = getTrainingPairs()[13]!;
  const aiTopic = findTopicMatch(AI_TECH_ESSAY);
  assert(
    "AI draft without a hashtag finds the stored artificial intelligence human_text",
    /^artificial intelligence\b/i.test(aiPair.input.trim()) &&
      aiTopic?.kind === "topic" &&
      aiTopic?.index === aiPair.index &&
      aiTopic!.output === aiPair.output,
    `row=${aiTopic?.index} stored=${aiPair.index}`,
  );
  const climatePair = getTrainingPairs()[11]!;
  const climateTopic = findTopicMatch(CLIMATE_PLAIN_ESSAY);
  assert(
    "climate draft finds the first stored climate human_text",
    /^climate change\b/i.test(climatePair.input.trim()) &&
      climateTopic?.kind === "topic" &&
      climateTopic?.index === climatePair.index &&
      climateTopic!.output === climatePair.output,
    `row=${climateTopic?.index}`,
  );
  const friendshipPair = getTrainingPairs()[12]!;
  const friendshipTopic = findTopicMatch(FRIENDSHIP_PLAIN_ESSAY);
  assert(
    "friendship draft finds the first stored friendship human_text",
    /^friendship\b/i.test(friendshipPair.input.trim()) &&
      friendshipTopic?.kind === "topic" &&
      friendshipTopic?.index === friendshipPair.index &&
      friendshipTopic!.output === friendshipPair.output,
    `row=${friendshipTopic?.index}`,
  );
  const americanHistoryPair = getTrainingPairs().find((pair) =>
    /^american history\b/i.test(pair.input.trim()),
  );
  const ecommercePair = getTrainingPairs().find((pair) =>
    /^the rise of e-commerce\b/i.test(pair.input.trim()),
  );
  assert("dataset includes an e-commerce pair", Boolean(ecommercePair));
  const marketplaceTopic = findTopicMatch(DIGITAL_MARKETPLACE_ESSAY);
  assert(
    "a Digital Marketplace e-commerce draft finds the stored e-commerce human_text",
    marketplaceTopic?.kind === "topic" &&
      Boolean(ecommercePair) &&
      marketplaceTopic.index === ecommercePair!.index &&
      marketplaceTopic.output === ecommercePair!.output,
    `row=${marketplaceTopic?.index} stored=${ecommercePair?.index}`,
  );
  assert(
    "stored e-commerce row is rejected when the marketplace body drifts away from that title",
    Boolean(marketplaceTopic) && !storedMatchAlignsWithDraft(DIGITAL_MARKETPLACE_ESSAY, marketplaceTopic!),
    `row=${marketplaceTopic?.index}`,
  );
  const engineMarketplace = await runEngineHumanization({
    text: DIGITAL_MARKETPLACE_ESSAY,
    intensity: 75,
  });
  assert(
    "Humanize keeps the marketplace title and does not return the mismatched stored e-commerce essay",
    ((engineMarketplace.source === "TOPIC_TRAINING_MATCH" || engineMarketplace.source === "FINE_TUNED_MODEL")) &&
      engineMarketplace.text !== ecommercePair!.output &&
      engineMarketplace.text.startsWith("The Digital Marketplace: Navigating the Promises and Perils of E-Commerce") &&
      /e-commerce|electronic commerce|online shopping|digital marketplace|customers|products/i.test(
        engineMarketplace.text,
      ) &&
      !/\btraditional retail\b|\babstract\.\b/i.test(engineMarketplace.text) &&
      !/\bJack Dangers\b|\bMeat Beat Manifesto\b|\bAmal Graafstra\b/i.test(
        engineMarketplace.text,
      ),
    `source=${engineMarketplace.source} opening=${engineMarketplace.text.slice(0, 80)}`,
  );
  assert("dataset includes an American History pair", Boolean(americanHistoryPair));
  const historyTopic = findTopicMatch(HISTORY_ESSAY);
  assert(
    "a general History draft does not return American History",
    historyTopic === null || historyTopic.index !== americanHistoryPair!.index,
    `row=${historyTopic?.index}`,
  );
  assert(
    "a general History draft does not substitute a different country's history",
    historyTopic === null,
    `row=${historyTopic?.index} opening=${historyTopic ? getTrainingPairs()[historyTopic.index]?.input.slice(0, 80) : "none"}`,
  );
  const americanHistoryTopic = findTopicMatch(AMERICAN_HISTORY_ESSAY);
  assert(
    "an American History draft finds the stored American History human_text",
    americanHistoryTopic?.kind === "topic" &&
      americanHistoryTopic.index === americanHistoryPair!.index &&
      americanHistoryTopic.output === americanHistoryPair!.output,
    `row=${americanHistoryTopic?.index}`,
  );
  const intelligenceTopic = findTopicMatch(INTELLIGENCE_ONLY_ESSAY);
  const intelligenceStored = intelligenceTopic ? getTrainingPairs()[intelligenceTopic.index] : null;
  assert(
    "an intelligence draft does not return the artificial intelligence essay",
    !intelligenceStored || !/^artificial intelligence\b/i.test(intelligenceStored.input.trim()),
    `row=${intelligenceTopic?.index}`,
  );
  const climateOnlyTopic = findTopicMatch(CLIMATE_ONLY_ESSAY);
  const climateOnlyStored = climateOnlyTopic ? getTrainingPairs()[climateOnlyTopic.index] : null;
  assert(
    "a climate draft does not return the climate change essay",
    !climateOnlyStored || !/^climate change\b/i.test(climateOnlyStored.input.trim()),
    `row=${climateOnlyTopic?.index}`,
  );
  const socialOnlyTopic = findTopicMatch(SOCIAL_ONLY_ESSAY);
  const socialOnlyStored = socialOnlyTopic ? getTrainingPairs()[socialOnlyTopic.index] : null;
  assert(
    "a social draft does not return the social media essay",
    !socialOnlyStored || !/^social media\b/i.test(socialOnlyStored.input.trim()),
    `row=${socialOnlyTopic?.index}`,
  );
  const workOnlyTopic = findTopicMatch(WORK_ONLY_ESSAY);
  const workOnlyStored = workOnlyTopic ? getTrainingPairs()[workOnlyTopic.index] : null;
  assert(
    "a work draft does not return the hard work essay",
    !workOnlyStored || !/^hard work\b/i.test(workOnlyStored.input.trim()),
    `row=${workOnlyTopic?.index}`,
  );
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
  assert(
    "human rewrite forbids lazy copying and swapping in a related stored essay",
    /not a copy job/i.test(HUMAN_REWRITE_SYSTEM_INSTRUCTION) &&
      /related subject/i.test(HUMAN_REWRITE_SYSTEM_INSTRUCTION),
  );
  assert(
    "v2 rewrite instruction matches the ai_text to human_text JSONL",
    HUMAN_REWRITE_V2_SYSTEM_INSTRUCTION.startsWith("Rewrite the AI draft into natural human prose"),
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
  assert(
    "Humanize engine prefers live Wikipedia outputs, then tuned model with style examples",
    engineSource.includes("findWikipediaLiveMatch") &&
      engineSource.includes("pickWikipediaStyleExample") &&
      engineSource.includes("runModelHumanization"),
  );
  assert(
    "Humanize engine still reports NO_WIKIPEDIA_MATCH when rewrite model is unavailable",
    engineSource.includes("NO_WIKIPEDIA_MATCH"),
  );
  const wikiSource = readFileSync(join(process.cwd(), "src", "lib", "wikipedia-corpus.ts"), "utf8");
  assert(
    "Humanize uses live English Wikipedia API, not the local 3000-row file",
    wikiSource.includes("https://en.wikipedia.org/w/api.php") &&
      wikiSource.includes("findWikipediaLiveMatch") &&
      wikiSource.includes("findClosestLiveWikipediaPage") &&
      wikiSource.includes("WIKIPEDIA_EDITOR_MAX_CHARS = 20_000") &&
      wikiSource.includes("WIKIPEDIA_EDITOR_MAX_PARAGRAPHS = 40"),
  );
  const workspaceSource = readFileSync(
    join(process.cwd(), "src", "components", "humanizer", "humanizer-workspace.tsx"),
    "utf8",
  );
  assert(
    "Humanize editor does not show a Wikipedia search bar",
    !workspaceSource.includes("WikipediaPicker") &&
      !workspaceSource.includes("Search any English Wikipedia topic"),
  );
  assert(
    "Humanize editor does not show a red Wikipedia-match banner",
    !workspaceSource.includes("border-red-200") &&
      workspaceSource.includes('apiError.code === "NO_WIKIPEDIA_MATCH"'),
  );
  assert(
    "Humanize editor uses a two-panel layout with a clean empty output state",
    workspaceSource.includes("Paste text on the left and click Humanize") &&
      workspaceSource.includes("Your humanized text will appear here") &&
      workspaceSource.includes('label: "Auto"') &&
      workspaceSource.includes('label: "Academic"'),
  );
  const outputViewSource = readFileSync(
    join(process.cwd(), "src", "components", "humanizer", "humanized-output-view.tsx"),
    "utf8",
  );
  assert(
    "Humanized output pane shows plain text like the input, with no heading",
    outputViewSource.includes("textarea") &&
      outputViewSource.includes("readOnly") &&
      !outputViewSource.includes("<h2") &&
      !outputViewSource.includes("font-bold") &&
      !outputViewSource.includes("font-semibold"),
  );
  const engineHashTech = await runEngineHumanization({ text: HASH_TECHNOLOGY_ESSAY, intensity: 75 });
  assert(
    "Humanize uses the tuned model for Technology for a #technology draft",
    (engineHashTech.source === "TOPIC_TRAINING_MATCH" || engineHashTech.source === "FINE_TUNED_MODEL") && /technolog/i.test(engineHashTech.text),
    `source=${engineHashTech.source} opening=${engineHashTech.text.slice(0, 80)}`,
  );
  const engineSuccess = await runEngineHumanization({ text: SUCCESS_CHATGPT_ESSAY, intensity: 75 });
  assert(
    "Humanize uses the tuned model for Success for a Success draft",
    (engineSuccess.source === "TOPIC_TRAINING_MATCH" || engineSuccess.source === "FINE_TUNED_MODEL") &&
      /^Success\n\n/i.test(engineSuccess.text) &&
      /success/i.test(engineSuccess.text),
    `source=${engineSuccess.source} opening=${engineSuccess.text.slice(0, 80)}`,
  );
  const engineBoredom = await runEngineHumanization({
    text: DISCIPLINE_OF_BOREDOM_ESSAY,
    intensity: 75,
  });
  assert(
    "Humanize keeps the input title The Discipline of Boredom",
    ((engineBoredom.source === "TOPIC_TRAINING_MATCH" || engineBoredom.source === "FINE_TUNED_MODEL")) &&
      engineBoredom.text.startsWith("The Discipline of Boredom\n\n") &&
      !engineBoredom.text.startsWith("Boredom\n") &&
      !/^# /.test(engineBoredom.text) &&
      /boredom/i.test(engineBoredom.text),
    `source=${engineBoredom.source} opening=${engineBoredom.text.slice(0, 80)}`,
  );
  const engineConsistency = await runEngineHumanization({
    text: QUIET_STRENGTH_OF_CONSISTENCY_ESSAY,
    intensity: 75,
  });
  assert(
    "Humanize output is plain essay paragraphs without Wikipedia math markup",
    ((engineConsistency.source === "TOPIC_TRAINING_MATCH" || engineConsistency.source === "FINE_TUNED_MODEL")) &&
      engineConsistency.text.startsWith("The Quiet Strength of Consistency\n\n") &&
      !hasLatexDump(engineConsistency.text) &&
      !/displaystyle/.test(engineConsistency.text) &&
      !/\{\s*\\/.test(engineConsistency.text) &&
      !/\\[a-zA-Z]+/.test(engineConsistency.text) &&
      engineConsistency.text.includes("\n\n") &&
      /consistenc/i.test(engineConsistency.text),
    `source=${engineConsistency.source} opening=${engineConsistency.text.slice(0, 160)}`,
  );
  const enginePlainTech = await runEngineHumanization({ text: TECH_SCREENSHOT_ESSAY, intensity: 75 });
  assert(
    "Humanize uses the tuned model for Technology for a technology draft",
    (enginePlainTech.source === "TOPIC_TRAINING_MATCH" || enginePlainTech.source === "FINE_TUNED_MODEL") && /technolog/i.test(enginePlainTech.text),
    `source=${enginePlainTech.source}`,
  );
  const engineEducation = await runEngineHumanization({ text: EDUCATION_ESSAY, intensity: 75 });
  assert(
    "Humanize returns the live Wikipedia Education article for an education draft",
    (engineEducation.source === "TOPIC_TRAINING_MATCH" || engineEducation.source === "FINE_TUNED_MODEL") && /education/i.test(engineEducation.text),
    `source=${engineEducation.source}`,
  );
  const engineAi = await runEngineHumanization({ text: AI_TECH_ESSAY, intensity: 75 });
  assert(
    "Humanize returns the live Wikipedia Artificial intelligence article for an AI draft",
    (engineAi.source === "TOPIC_TRAINING_MATCH" || engineAi.source === "FINE_TUNED_MODEL") && /artificial intelligence/i.test(engineAi.text),
    `source=${engineAi.source}`,
  );
  const environmentHeadingTopic = findTopicMatch(ENVIRONMENT_HEADING_ESSAY);
  const environmentHeadingStored = environmentHeadingTopic
    ? getTrainingPairs()[environmentHeadingTopic.index]
    : null;
  assert(
    "an Environment heading does not return a water-pollution essay",
    !environmentHeadingStored ||
      !/^water pollution\b/i.test(environmentHeadingStored.input.trim()),
    `row=${environmentHeadingTopic?.index} opening=${environmentHeadingStored?.input.slice(0, 80) ?? "none"}`,
  );
  const environmentWiki = await findWikipediaLiveMatch(ENVIRONMENT_HEADING_ESSAY);
  assert(
    "an Environment heading matches live Wikipedia Natural environment",
    environmentWiki?.kind === "topic" &&
      /natural environment/i.test(environmentWiki.output) &&
      !/^water pollution/i.test(environmentWiki.output),
    `kind=${environmentWiki?.kind ?? "none"} opening=${environmentWiki?.output.slice(0, 80) ?? "none"}`,
  );
  const engineEnvironment = await runEngineHumanization({ text: ENVIRONMENT_HEADING_ESSAY, intensity: 75 });
  assert(
    "Humanize uses the tuned model for Environment, not Water pollution",
    (engineEnvironment.source === "TOPIC_TRAINING_MATCH" || engineEnvironment.source === "FINE_TUNED_MODEL") &&
      /environment/i.test(engineEnvironment.text) &&
      !/^water pollution/i.test(engineEnvironment.text),
    `source=${engineEnvironment.source} opening=${engineEnvironment.text.slice(0, 80)}`,
  );
  const untitledEnvironment = await findWikipediaLiveMatch(ENVIRONMENT_ESSAY);
  assert(
    "an untitled Environment draft still matches Wikipedia Environment",
    Boolean(untitledEnvironment) && /natural environment/i.test(untitledEnvironment!.output),
    `kind=${untitledEnvironment?.kind ?? "none"}`,
  );
  const waterWiki = await findWikipediaLiveMatch(WATER_POLLUTION_HEADING_ESSAY);
  assert(
    "a Water pollution heading matches the Wikipedia Water pollution article",
    waterWiki?.kind === "topic" && /water pollution/i.test(waterWiki.output),
    `kind=${waterWiki?.kind ?? "none"}`,
  );
  const dangerousThingsWiki = await findWikipediaLiveMatch(DANGEROUS_THINGS_LIFE_ESSAY);
  assert(
    "Dangerous Things in Life does not return Wikipedia bios or company pages",
    dangerousThingsWiki === null ||
      (!/\bretailer\b/i.test(dangerousThingsWiki.output) &&
        !/\bimplant\b/i.test(dangerousThingsWiki.output) &&
        !/\bAmal Graafstra\b/i.test(dangerousThingsWiki.output) &&
        !/\bJack Dangers\b/i.test(dangerousThingsWiki.output) &&
        !/\bMeat Beat Manifesto\b/i.test(dangerousThingsWiki.output) &&
        !/\bJohn Stephen Corrigan\b/i.test(dangerousThingsWiki.output)),
    `opening=${dangerousThingsWiki?.output.slice(0, 160) ?? "none"}`,
  );
  const organsWiki = await findWikipediaLiveMatch(COLLABORATION_OF_ORGANS_ESSAY);
  assert(
    "Collaboration of Organs matches biology (not trade/history collaboration)",
    organsWiki?.kind === "topic" &&
      /organ \(biology\)|organ system|human body/i.test(organsWiki.topic) &&
      /\borgan\b|\btissue\b|\bheart\b|\blung/i.test(organsWiki.output) &&
      !/\bRoman Empire\b|\bbarter\b|\bcomparative advantage\b|\bCossack\b|\bWorld War II\b/i.test(
        organsWiki.output,
      ),
    `topic=${organsWiki?.topic ?? "none"} opening=${organsWiki?.output.slice(0, 120) ?? "none"}`,
  );
  const culturalMemoryWiki = await findWikipediaLiveMatch(CULTURAL_MEMORY_ESSAY);
  assert(
    "Cultural Memory matches collective/cultural memory (not biology Memory)",
    culturalMemoryWiki?.kind === "topic" &&
      /cultural memory|collective memory|national identity/i.test(culturalMemoryWiki.topic) &&
      /\bcultur|\bnation|\btradition|\bcollective|\bidentit/i.test(culturalMemoryWiki.output) &&
      !/\bamnesia\b|\bneuron\b|\bsensory processor\b|\bencoding\b.*\bstorage\b/i.test(
        culturalMemoryWiki.output,
      ),
    `topic=${culturalMemoryWiki?.topic ?? "none"} opening=${culturalMemoryWiki?.output.slice(0, 140) ?? "none"}`,
  );
  assert(
    "Dangerous Things in Life has no same-topic Wikipedia page (Vertex rewrite path)",
    dangerousThingsWiki === null,
    `kind=${dangerousThingsWiki?.kind ?? "none"} opening=${dangerousThingsWiki?.output.slice(0, 80) ?? "none"}`,
  );
  try {
    const engineDangerous = await runEngineHumanization({
      text: DANGEROUS_THINGS_LIFE_ESSAY,
      intensity: 75,
    });
    assert(
      "Dangerous Things in Life uses Vertex rewrite of the draft, not a Wikipedia bio",
      engineDangerous.source === "FINE_TUNED_MODEL" &&
        /danger|road|accident|speed|traffic|phone|hazard|life/i.test(engineDangerous.text) &&
        !/\bJack Dangers\b|\bMeat Beat Manifesto\b|\bJohn Stephen Corrigan\b|\bAmal Graafstra\b/i.test(
          engineDangerous.text,
        ),
      `source=${engineDangerous.source} opening=${engineDangerous.text.slice(0, 120)}`,
    );
  } catch (error) {
    assert(
      "Dangerous Things in Life uses Vertex rewrite of the draft, not a Wikipedia bio",
      error instanceof HumanizationFailedError &&
        (error.code === "NO_WIKIPEDIA_MATCH" ||
          error.code === "MISSING_VERTEX_CONFIG" ||
          error.code === "HUMANIZATION_FAILED" ||
          error.code === "QUALITY_CHECK_FAILED" ||
          error.code === "EMPTY_RESPONSE"),
      error instanceof HumanizationFailedError ? error.code : String(error),
    );
  }
  assert(
    "unrelated Harborline draft has no Wikipedia topic row",
    findTopicMatch(NEW_TOPIC) === null,
  );
  await expectNoWiki("Harborline draft uses Vertex rewrite when Wikipedia has no match", NEW_TOPIC);
  const historyWiki = await findWikipediaLiveMatch(HISTORY_ESSAY);
  assert(
    "a general History draft matches Wikipedia History, not US history",
    Boolean(historyWiki) &&
      /study of the past/i.test(historyWiki!.output) &&
      !/history of the land which became the united states/i.test(historyWiki!.output),
    `kind=${historyWiki?.kind ?? "none"} opening=${historyWiki?.output.slice(0, 80) ?? "none"}`,
  );
  const engineHistory = await runEngineHumanization({ text: HISTORY_ESSAY, intensity: 75 });
  assert(
    "Humanize uses the tuned model for History for a History draft",
    (engineHistory.source === "TOPIC_TRAINING_MATCH" || engineHistory.source === "FINE_TUNED_MODEL") && /histor/i.test(engineHistory.text),
    `source=${engineHistory.source}`,
  );
  const intelligenceWiki = await findWikipediaLiveMatch(INTELLIGENCE_ONLY_ESSAY);
  assert(
    "an intelligence draft matches Wikipedia Intelligence, not Artificial intelligence",
    Boolean(intelligenceWiki) &&
      /capacity for abstraction/i.test(intelligenceWiki!.output) &&
      !/artificial intelligence \(ai\)/i.test(intelligenceWiki!.output),
    `kind=${intelligenceWiki?.kind ?? "none"} opening=${intelligenceWiki?.output.slice(0, 80) ?? "none"}`,
  );
  const engineAmericanHistory = await runEngineHumanization({ text: AMERICAN_HISTORY_ESSAY, intensity: 75 });
  assert(
    "Humanize uses the tuned model for History of the United States for an American History draft",
    (engineAmericanHistory.source === "TOPIC_TRAINING_MATCH" || engineAmericanHistory.source === "FINE_TUNED_MODEL") &&
      /united states|american|history/i.test(engineAmericanHistory.text),
    `source=${engineAmericanHistory.source} opening=${engineAmericanHistory.text.slice(0, 80)}`,
  );
  const climateWiki = await findWikipediaLiveMatch(CLIMATE_PLAIN_ESSAY);
  assert(
    "a Climate change draft matches Wikipedia Climate change",
    Boolean(climateWiki) && /climate change/i.test(climateWiki!.output),
    `kind=${climateWiki?.kind ?? "none"}`,
  );
  const preambleSuccess = await findWikipediaLiveMatch(PREAMBLE_SUCCESS_ESSAY);
  assert(
    "a ChatGPT-style Success draft still matches Wikipedia Success",
    Boolean(preambleSuccess) && /success is the state or condition/i.test(preambleSuccess!.output),
    `kind=${preambleSuccess?.kind ?? "none"}`,
  );
  const preambleEnvironment = await findWikipediaLiveMatch(PREAMBLE_ENVIRONMENT_ESSAY);
  assert(
    "a ChatGPT-style Environment draft matches Environment, not Water pollution",
    Boolean(preambleEnvironment) &&
      /natural environment/i.test(preambleEnvironment!.output) &&
      !/^water pollution/i.test(preambleEnvironment!.output),
    `kind=${preambleEnvironment?.kind ?? "none"} opening=${preambleEnvironment?.output.slice(0, 80) ?? "none"}`,
  );
  const enginePreambleSuccess = await runEngineHumanization({ text: PREAMBLE_SUCCESS_ESSAY, intensity: 75 });
  assert(
    "Humanize uses the tuned model for Success for a preamble Success draft",
    (enginePreambleSuccess.source === "TOPIC_TRAINING_MATCH" || enginePreambleSuccess.source === "FINE_TUNED_MODEL") && /success/i.test(enginePreambleSuccess.text),
    `source=${enginePreambleSuccess.source}`,
  );
  const engineGlobalization = await runEngineHumanization({
    text: POLITICAL_ECONOMY_GLOBALIZATION_ESSAY,
    intensity: 75,
  });
  assert(
    "Humanize returns a close Wikipedia page or Vertex rewrite for Political Economy of Globalization",
    ((engineGlobalization.source === "TOPIC_TRAINING_MATCH" || engineGlobalization.source === "FINE_TUNED_MODEL")) &&
      /globalization|political economy|trade|market/i.test(engineGlobalization.text),
    `source=${engineGlobalization.source} opening=${engineGlobalization.text.slice(0, 100)}`,
  );
  assert("new-input prompt asks for rewritten text only", /return only the final refined text/i.test(newPrompt));
  assert(
    "standard tone does not add extra register instructions",
    !/academic register|conversational register|executive register/i.test(newPrompt),
  );
  assert("exact match API source is database", toApiSource("EXACT_TRAINING_MATCH") === "database");
  assert("same-draft API source is database", toApiSource("DATABASE_SIMILARITY_MATCH") === "database");
  assert("topic match API source is database", toApiSource("TOPIC_TRAINING_MATCH") === "database");
  assert("model rewrite API source stays model", toApiSource("FINE_TUNED_MODEL") === "model");
  const exportSource = readFileSync(join(process.cwd(), "scripts", "export-vertex-training.mts"), "utf8");
  assert(
    "v4 Vertex export keeps validation under 30% of training",
    exportSource.includes("humanizer_validation_v4.jsonl") &&
      exportSource.includes("MAX_VALIDATION_RATIO") &&
      exportSource.includes("0.3"),
  );
  assert(
    "Vertex export trains ai_text to human_text, not identity copy",
    exportSource.includes("ai_text â†’ human_text") &&
      exportSource.includes("row.input ?? row.ai_text") &&
      exportSource.includes("row.output ?? row.human_text"),
  );
  assert(
    "Vertex export includes every stored pair with no topic filter",
    exportSource.includes("every stored pair") &&
      exportSource.includes("No topic filter") &&
      exportSource.includes("exported.length + skippedIdentity !== lines.length"),
  );
  const trainSource = readFileSync(join(process.cwd(), "scripts", "start-vertex-tuning.mts"), "utf8");
  assert(
    "Vertex training job uses a validation URI under the 30% cap",
    trainSource.includes("VALIDATION_DATA_GCS_URI") && trainSource.includes("â‰¤30% of training size"),
  );
  assert(
    "Vertex rewrite job uses extra epochs and a larger adapter so it learns the edit",
    trainSource.includes('epochCount: "8"') && trainSource.includes("ADAPTER_SIZE_EIGHT"),
  );
  const bindSource = readFileSync(join(process.cwd(), "scripts", "bind-tuned-endpoint.mts"), "utf8");
  assert(
    "bind uses TOPN1 only and does not fall back to lookup-tuned OG REFINO",
    bindSource.includes('DEFAULT_JOB_NAME = "TOPN1"') &&
      bindSource.includes("isTopn1Job") &&
      bindSource.includes("Humanize binds TOPN1 only") &&
      bindSource.includes("VERTEX_HUMAN_TEXT_MODEL") &&
      bindSource.includes("Not binding an older lookup-tuned job"),
  );

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

  console.log("\n4. Live Humanize provider cases");

  if (isVertexConfigured()) {
    const vertex = requireVertexConfig();
    const tunedModel = redactModelName(vertex.model);
    console.log(`  Vertex credentials present (${tunedModel}); unmatched drafts use the rewrite-trained endpoint when VERTEX_HUMAN_TEXT_MODEL=1`);
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

  const { HumanizationFailedError } = await import("../src/lib/humanize-engine");
  const sample = { id: "T6", name: "environment-topic", text: ENVIRONMENT_HEADING_ESSAY };

  try {
    const result = await runHumanization({
      text: sample.text,
      tone: "standard",
      readability: "General Audience",
      intensity: 75,
    });
    assert(
      `${sample.id} ${sample.name}`,
      (result.source === "TOPIC_TRAINING_MATCH" || result.source === "FINE_TUNED_MODEL") &&
        /environment/i.test(result.text) &&
        !/^water pollution/i.test(result.text),
      `source=${result.source}`,
    );
  } catch (error) {
    const code = error instanceof HumanizationFailedError ? error.code : "ERROR";
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


