/**
 * Credit system verification.
 * Creates a throwaway user, exercises every credit rule, then deletes it.
 *
 * Run with: npm run test:credits
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const { prisma } = await import("../src/lib/prisma");
const {
  checkCredits,
  consumeCredits,
  countWords,
  CreditError,
  getCreditBalance,
  provisionFreeTier,
  refundCredits,
} = await import("../src/lib/credits");

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

function words(n: number) {
  return Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
}

const clerkUserId = `test_credits_${Date.now()}`;

async function main() {
  const user = await prisma.user.create({
    data: {
      clerkUserId,
      email: `${clerkUserId}@refinotext.test`,
      name: "Credit Test User",
    },
  });

  await provisionFreeTier(user.id);

  console.log("\n1. Free tier provisioning");
  const free = await getCreditBalance(user.id);
  assert("new user starts on FREE with 500 credits", free?.plan === "FREE" && free?.balance === 500, `plan=${free?.plan} balance=${free?.balance}`);
  assert("free tier allows the full 500-credit allotment per request", free?.maxWordsPerRequest === 500);

  // Move to Basic so the 600-word rule can be exercised.
  await prisma.subscription.update({
    where: { userId: user.id },
    data: { plan: "BASIC", monthlyCredits: 8000, maxWordsPerRequest: 600 },
  });
  await prisma.creditBalance.update({
    where: { userId: user.id },
    data: { balance: 8000 },
  });

  console.log("\n2. 100 words = 100 credits");
  const text100 = words(100);
  assert("countWords returns 100", countWords(text100) === 100);
  const check100 = await checkCredits(user.id, text100);
  assert("check allows the request", check100.allowed && check100.requiredCredits === 100);
  const consume100 = await consumeCredits({
    userId: user.id,
    wordCount: 100,
    requestId: `${user.id}:req-100`,
  });
  assert("charged exactly 100 credits", consume100.charged === 100);
  assert("balance 8000 -> 7900", consume100.balanceAfter === 7900, `balance=${consume100.balanceAfter}`);

  console.log("\n3. 600 words = 600 credits");
  const text600 = words(600);
  assert("countWords returns 600", countWords(text600) === 600);
  const check600 = await checkCredits(user.id, text600);
  assert("600 words allowed on Basic (limit 600)", check600.allowed);
  const consume600 = await consumeCredits({
    userId: user.id,
    wordCount: 600,
    requestId: `${user.id}:req-600`,
  });
  assert("charged exactly 600 credits", consume600.charged === 600);
  assert("balance 7900 -> 7300", consume600.balanceAfter === 7300, `balance=${consume600.balanceAfter}`);

  console.log("\n4. Request over the plan word limit");
  const over = await checkCredits(user.id, words(700));
  assert("700 words rejected on Basic", !over.allowed && over.error?.code === "OVER_REQUEST_LIMIT", over.error?.code);
  const balanceAfterOver = await getCreditBalance(user.id);
  assert("no credits were charged", balanceAfterOver?.balance === 7300, `balance=${balanceAfterOver?.balance}`);

  console.log("\n5. Insufficient credits");
  await prisma.creditBalance.update({
    where: { userId: user.id },
    data: { balance: 50 },
  });
  const poor = await checkCredits(user.id, words(100));
  assert("check rejects 100 words with 50 credits", !poor.allowed && poor.error?.code === "INSUFFICIENT_CREDITS", poor.error?.code);

  let consumeBlocked = false;
  try {
    await consumeCredits({
      userId: user.id,
      wordCount: 100,
      requestId: `${user.id}:req-poor`,
    });
  } catch (error) {
    consumeBlocked = error instanceof CreditError && error.code === "INSUFFICIENT_CREDITS";
  }
  assert("consumeCredits also refuses to overdraw", consumeBlocked);
  const afterPoor = await getCreditBalance(user.id);
  assert("balance never goes negative", (afterPoor?.balance ?? -1) === 50, `balance=${afterPoor?.balance}`);

  console.log("\n6. Failed Gemini request refunds credits");
  await prisma.creditBalance.update({
    where: { userId: user.id },
    data: { balance: 1000 },
  });
  const failReq = `${user.id}:req-fail`;
  const consumedFail = await consumeCredits({
    userId: user.id,
    wordCount: 250,
    requestId: failReq,
  });
  assert("250 credits deducted", consumedFail.balanceAfter === 750, `balance=${consumedFail.balanceAfter}`);
  const refund = await refundCredits({ userId: user.id, requestId: failReq, reason: "Gemini failed" });
  assert("250 credits refunded", refund.refunded === 250 && refund.balanceAfter === 1000, `balance=${refund.balanceAfter}`);
  const doubleRefund = await refundCredits({ userId: user.id, requestId: failReq });
  assert("refund cannot be claimed twice", doubleRefund.alreadyRefunded && doubleRefund.refunded === 0);
  const afterRefund = await getCreditBalance(user.id);
  assert("balance restored to 1000", afterRefund?.balance === 1000, `balance=${afterRefund?.balance}`);

  console.log("\n7. Duplicate requests cannot double-charge");
  const dupReq = `${user.id}:req-dup`;
  const first = await consumeCredits({ userId: user.id, wordCount: 120, requestId: dupReq });
  const second = await consumeCredits({ userId: user.id, wordCount: 120, requestId: dupReq });
  const third = await consumeCredits({ userId: user.id, wordCount: 120, requestId: dupReq });
  assert("first call charges", !first.duplicate && first.balanceAfter === 880, `balance=${first.balanceAfter}`);
  assert("repeat calls are flagged duplicate", second.duplicate && third.duplicate);
  const afterDup = await getCreditBalance(user.id);
  assert("balance only moved once", afterDup?.balance === 880, `balance=${afterDup?.balance}`);
  const dupRows = await prisma.creditTransaction.count({
    where: { requestId: dupReq, type: "DEDUCTION" },
  });
  assert("only one DEDUCTION row exists", dupRows === 1, `rows=${dupRows}`);

  console.log("\n8. Transaction ledger");
  const ledger = await prisma.creditTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  const types = ledger.map((t) => t.type);
  assert("grant, deductions and refund are all recorded", types.includes("GRANT") && types.includes("DEDUCTION") && types.includes("REFUND"), types.join(","));
  assert("no negative amounts stored", ledger.every((t) => t.amount > 0));
  assert("no negative balances stored", ledger.every((t) => t.balanceAfter >= 0));

  await prisma.user.delete({ where: { id: user.id } });
  const gone = await prisma.user.findUnique({ where: { id: user.id } });
  assert("test user cleaned up", gone === null);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
    await prisma.user.deleteMany({ where: { clerkUserId } });
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
