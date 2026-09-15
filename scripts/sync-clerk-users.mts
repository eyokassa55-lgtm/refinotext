import { config } from "dotenv";

config({ path: ".env.local" });
config();

const { syncAllClerkUsersToNeon } = await import("../src/lib/clerk-user-sync");

const result = await syncAllClerkUsersToNeon();
console.log(
  `Clerk → Neon sync complete. scanned=${result.scanned} synced=${result.synced} skipped=${result.skipped}`,
);
