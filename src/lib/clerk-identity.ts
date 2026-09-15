type ClerkEmailEntry = {
  id: string | null;
  email: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function emailsFromList(list: unknown): ClerkEmailEntry[] {
  if (!Array.isArray(list)) return [];
  const emails: ClerkEmailEntry[] = [];
  for (const entry of list) {
    const row = asRecord(entry);
    if (!row) continue;
    const email =
      asString(row.email_address) ??
      asString(row.emailAddress) ??
      asString(row.email);
    if (!email) continue;
    emails.push({ id: asString(row.id), email: email.toLowerCase() });
  }
  return emails;
}

export function clerkEmailFromPayload(data: unknown): string | null {
  const row = asRecord(data);
  if (!row) return null;

  const emails = [
    ...emailsFromList(row.email_addresses),
    ...emailsFromList(row.emailAddresses),
  ];
  const primaryId =
    asString(row.primary_email_address_id) ?? asString(row.primaryEmailAddressId);
  const primary = emails.find((entry) => entry.id && entry.id === primaryId);
  if (primary) return primary.email;
  if (emails[0]) return emails[0].email;

  const primaryObject = asRecord(row.primaryEmailAddress) ?? asRecord(row.primary_email_address);
  const fromPrimaryObject =
    asString(primaryObject?.emailAddress) ?? asString(primaryObject?.email_address);
  if (fromPrimaryObject) return fromPrimaryObject.toLowerCase();

  const linked = [
    ...emailsFromList(row.external_accounts),
    ...emailsFromList(row.externalAccounts),
    ...emailsFromList(row.enterprise_accounts),
    ...emailsFromList(row.enterpriseAccounts),
  ];
  return linked[0]?.email ?? null;
}

export function clerkNameFromPayload(data: unknown): string | null {
  const row = asRecord(data);
  if (!row) return null;
  const joined = [
    asString(row.first_name) ?? asString(row.firstName),
    asString(row.last_name) ?? asString(row.lastName),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (
    joined ||
    asString(row.full_name) ||
    asString(row.fullName) ||
    asString(row.username) ||
    null
  );
}

export function clerkUserIdFromPayload(data: unknown): string | null {
  const row = asRecord(data);
  if (!row) return null;
  const id = asString(row.id);
  if (id?.startsWith("user_")) return id;
  return asString(row.user_id) ?? asString(row.userId);
}

export type ClerkIdentity = {
  clerkUserId: string;
  email: string | null;
  name: string | null;
};

export function clerkIdentityFromWebhookData(
  eventType: string,
  data: unknown,
): ClerkIdentity | null {
  const row = asRecord(data);
  if (!row) return null;

  if (eventType.startsWith("session.")) {
    const nestedUser = asRecord(row.user);
    const clerkUserId =
      (nestedUser ? clerkUserIdFromPayload(nestedUser) : null) ??
      asString(row.user_id) ??
      asString(row.userId);
    if (!clerkUserId) return null;
    return {
      clerkUserId,
      email: clerkEmailFromPayload(nestedUser) ?? clerkEmailFromPayload(row),
      name: clerkNameFromPayload(nestedUser) ?? clerkNameFromPayload(row),
    };
  }

  const clerkUserId = clerkUserIdFromPayload(row);
  if (!clerkUserId) return null;
  return {
    clerkUserId,
    email: clerkEmailFromPayload(row),
    name: clerkNameFromPayload(row),
  };
}

export function clerkIdentityFromUser(user: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: Array<{ emailAddress?: string | null }>;
  externalAccounts?: Array<{ emailAddress?: string | null }>;
}): ClerkIdentity {
  const email =
    user.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ||
    user.emailAddresses?.find((entry) => entry.emailAddress)?.emailAddress?.trim().toLowerCase() ||
    clerkEmailFromPayload(user);

  return {
    clerkUserId: user.id,
    email,
    name: clerkNameFromPayload(user),
  };
}
