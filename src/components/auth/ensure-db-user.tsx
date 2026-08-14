import { ensureCurrentUser } from "@/lib/users";

export async function EnsureDbUser() {
  await ensureCurrentUser();
  return null;
}
