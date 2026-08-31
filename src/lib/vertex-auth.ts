export class VertexAuthError extends Error {
  code: "INVALID_SERVICE_ACCOUNT";

  constructor(message = "The writing service could not be authorized.") {
    super(message);
    this.name = "VertexAuthError";
    this.code = "INVALID_SERVICE_ACCOUNT";
  }
}

export type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

function unwrapQuotes(value: string): string {
  let text = value.trim().replace(/^\uFEFF/, "");
  if (text.length >= 2) {
    const first = text[0];
    const last = text[text.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      text = text.slice(1, -1).trim();
    }
  }
  return text;
}

function tryJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function escapePrivateKeyNewlines(json: string): string {
  return json.replace(
    /("private_key"\s*:\s*")([\s\S]*?)("\s*[,}])/g,
    (_full, start: string, key: string, end: string) =>
      start + key.replace(/\r\n/g, "\\n").replace(/\n/g, "\\n") + end,
  );
}

function asCredentialObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Parse GOOGLE_SERVICE_ACCOUNT_JSON from Vercel / .env forms:
 * raw JSON, quoted JSON, double-encoded JSON, escaped quotes,
 * and private_key values with escaped or literal newlines.
 */
export function parseServiceAccountJson(raw: string): ServiceAccountCredentials {
  const text = unwrapQuotes(raw);
  if (!text) {
    throw new VertexAuthError();
  }

  const candidates: unknown[] = [];
  const first = tryJsonParse(text);
  if (first !== undefined) candidates.push(first);

  if (typeof first === "string") {
    const nested = tryJsonParse(first);
    if (nested !== undefined) candidates.push(nested);
  }

  if (candidates.length === 0 && text.includes('\\"')) {
    const unescaped = tryJsonParse(text.replace(/\\"/g, '"'));
    if (unescaped !== undefined) candidates.push(unescaped);
  }

  if (candidates.length === 0 && /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) {
    const repaired = tryJsonParse(escapePrivateKeyNewlines(text));
    if (repaired !== undefined) candidates.push(repaired);
  }

  let object: Record<string, unknown> | null = null;
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      object = asCredentialObject(tryJsonParse(candidate));
    } else {
      object = asCredentialObject(candidate);
    }
    if (object) break;
  }

  if (!object) {
    throw new VertexAuthError();
  }

  const clientEmail =
    typeof object.client_email === "string" ? object.client_email.trim() : "";
  let privateKey =
    typeof object.private_key === "string" ? object.private_key : "";
  privateKey = privateKey.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
  const projectId =
    typeof object.project_id === "string" ? object.project_id.trim() : undefined;

  if (!clientEmail.includes("@") || !privateKey.includes("BEGIN") || !privateKey.includes("PRIVATE KEY")) {
    throw new VertexAuthError();
  }

  return {
    client_email: clientEmail,
    private_key: privateKey,
    project_id: projectId || undefined,
  };
}

export function getGoogleAuthOptions():
  | {
      credentials: { client_email: string; private_key: string };
      projectId?: string;
    }
  | undefined {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const parsed = parseServiceAccountJson(json);
    return {
      credentials: {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      },
      projectId: parsed.project_id,
    };
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim().replace(/^["']|["']$/g, "");
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  if (clientEmail && privateKey) {
    return {
      credentials: { client_email: clientEmail, private_key: privateKey },
    };
  }

  return undefined;
}
