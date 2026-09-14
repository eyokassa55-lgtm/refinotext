import "server-only";

import { Polar } from "@polar-sh/sdk";
import type { Checkout } from "@polar-sh/sdk/models/components/checkout.js";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";

import {
  getConfiguredPolarServer,
  getExplicitPolarServer,
  type PolarServer,
} from "@/lib/polar-config";
import {
  describePolarError,
  isPolarValidationError,
  isWrongPolarEnvironmentError,
  PolarConfigError,
} from "@/lib/polar-error";

export type { PolarServer };

const clients = new Map<PolarServer, Polar>();

function readAccessToken(): string | undefined {
  const value = process.env.POLAR_ACCESS_TOKEN?.trim().replace(/^["']|["']$/g, "");
  if (!value || value === "placeholder") return undefined;
  return value;
}

export { getConfiguredPolarServer };

export function getPolarTokenStatus() {
  const token = readAccessToken();
  return {
    present: Boolean(token),
    usable: Boolean(token && (token.startsWith("polar_oat_") || token.startsWith("polar_at_"))),
    server: getConfiguredPolarServer(),
  };
}

export function getPolarClient(server: PolarServer = getConfiguredPolarServer()): Polar {
  const accessToken = readAccessToken();
  if (!accessToken) {
    throw new PolarConfigError("POLAR_ACCESS_TOKEN is not configured");
  }

  const cached = clients.get(server);
  if (cached) return cached;

  const client = new Polar({
    accessToken,
    server,
  });
  clients.set(server, client);
  return client;
}

function polarServersToTry(options?: {
  allowSandbox?: boolean;
  mode?: "create" | "read";
}): PolarServer[] {
  const configured = getConfiguredPolarServer();
  const other: PolarServer = configured === "sandbox" ? "production" : "sandbox";
  const allowSandbox = options?.allowSandbox ?? true;
  const mode = options?.mode ?? "read";

  if (mode === "create" && !allowSandbox) {
    return ["production"];
  }

  if (mode === "read" || !getExplicitPolarServer()) {
    return [configured, other];
  }

  return [configured];
}

function withoutCheckoutPlaceholder(url: string): string {
  return url
    .replace(/&?checkout_id=\{CHECKOUT_ID\}/i, "")
    .replace(/&?checkoutId=\{CHECKOUT_ID\}/i, "")
    .replace(/\?$/, "");
}

function stringifyMeta(
  meta: Record<string, string | number | boolean>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [key, String(value)]),
  );
}

type CheckoutCreateAttempt = {
  customerId?: string;
  customerEmail?: string;
  externalCustomerId?: string;
  successUrl: string;
  returnUrl?: string;
  metadata: Record<string, string | number | boolean>;
  customerMetadata: Record<string, string | number | boolean>;
};

function buildCheckoutAttempts(input: {
  customerId?: string | null;
  customerEmail: string;
  externalCustomerId: string;
  successUrl: string;
  returnUrl: string;
  alternateSuccessUrl?: string | null;
  alternateReturnUrl?: string | null;
  metadata: Record<string, string | number | boolean>;
  customerMetadata: Record<string, string | number | boolean>;
}): CheckoutCreateAttempt[] {
  const metadata = stringifyMeta(input.metadata);
  const customerMetadata = stringifyMeta(input.customerMetadata);
  const attempts: CheckoutCreateAttempt[] = [];
  const seen = new Set<string>();

  const push = (attempt: CheckoutCreateAttempt) => {
    const key = JSON.stringify(attempt);
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push(attempt);
  };

  const urlPairs = [
    { successUrl: input.successUrl, returnUrl: input.returnUrl },
    {
      successUrl: withoutCheckoutPlaceholder(input.successUrl),
      returnUrl: input.returnUrl,
    },
    { successUrl: withoutCheckoutPlaceholder(input.successUrl), returnUrl: undefined },
  ];

  if (input.alternateSuccessUrl) {
    urlPairs.push({
      successUrl: withoutCheckoutPlaceholder(input.alternateSuccessUrl),
      returnUrl: input.alternateReturnUrl ?? undefined,
    });
  }

  const identities: Array<Pick<
    CheckoutCreateAttempt,
    "customerId" | "customerEmail" | "externalCustomerId"
  >> = [
    {
      customerId: input.customerId ?? undefined,
      customerEmail: input.customerEmail || undefined,
      externalCustomerId: input.externalCustomerId,
    },
    {
      customerEmail: input.customerEmail || undefined,
      externalCustomerId: input.externalCustomerId,
    },
    { externalCustomerId: input.externalCustomerId },
  ];

  for (const urls of urlPairs) {
    for (const identity of identities) {
      push({
        ...identity,
        successUrl: urls.successUrl,
        returnUrl: urls.returnUrl,
        metadata,
        customerMetadata,
      });
    }
  }

  return attempts;
}

export async function createPolarCheckout(input: {
  productId: string;
  productKey: string;
  externalCustomerId: string;
  customerId?: string | null;
  customerEmail: string;
  customerName?: string;
  successUrl: string;
  returnUrl: string;
  alternateSuccessUrl?: string | null;
  alternateReturnUrl?: string | null;
  allowSandbox?: boolean;
  metadata: Record<string, string | number | boolean>;
  customerMetadata: Record<string, string | number | boolean>;
}) {
  const token = getPolarTokenStatus();
  if (!token.usable) {
    throw new PolarConfigError(
      "POLAR_ACCESS_TOKEN is missing or not a Polar access token.",
    );
  }

  const attempts = buildCheckoutAttempts(input);
  let lastError: unknown;

  for (const server of polarServersToTry({
    allowSandbox: input.allowSandbox,
    mode: "create",
  })) {
    for (const attempt of attempts) {
      try {
        const checkout = await createCheckoutOnce(server, input, attempt);
        if (server !== token.server) {
          console.warn(
            `[polar] Checkout succeeded on ${server}. Set POLAR_SERVER=${server}.`,
          );
        }
        return { checkout, server };
      } catch (error) {
        lastError = error;
        const info = describePolarError(error);
        console.error("[polar] checkout.create failed", {
          server,
          productKey: input.productKey,
          productId: input.productId,
          errorName: info.name,
          httpStatus: info.statusCode,
          message: info.message,
          body: info.body,
        });

        if (info.statusCode === 401 || info.statusCode === 403) {
          break;
        }

        if (
          info.statusCode === 404 &&
          !attempt.customerId &&
          !attempt.customerEmail
        ) {
          break;
        }

        if (
          info.statusCode === 422 ||
          info.statusCode === 404 ||
          isPolarValidationError(error)
        ) {
          continue;
        }

        throw error;
      }
    }
  }

  throw lastError;
}

async function createCheckoutOnce(
  server: PolarServer,
  input: {
    productId: string;
    customerName?: string;
  },
  attempt: CheckoutCreateAttempt,
) {
  return getPolarClient(server).checkouts.create({
    products: [input.productId],
    ...(attempt.customerId ? { customerId: attempt.customerId } : {}),
    ...(attempt.externalCustomerId
      ? { externalCustomerId: attempt.externalCustomerId }
      : {}),
    ...(attempt.customerEmail ? { customerEmail: attempt.customerEmail } : {}),
    ...(input.customerName ? { customerName: input.customerName } : {}),
    successUrl: attempt.successUrl,
    ...(attempt.returnUrl ? { returnUrl: attempt.returnUrl } : {}),
    allowDiscountCodes: true,
    metadata: attempt.metadata,
    customerMetadata: attempt.customerMetadata,
  });
}

async function withPolarRead<T>(
  fn: (client: Polar) => Promise<T>,
): Promise<{ value: T; server: PolarServer }> {
  let lastError: unknown;
  for (const server of polarServersToTry({ mode: "read" })) {
    try {
      const value = await fn(getPolarClient(server));
      return { value, server };
    } catch (error) {
      lastError = error;
      if (!isWrongPolarEnvironmentError(error)) throw error;
    }
  }
  throw lastError;
}

export async function getPolarCheckout(id: string): Promise<{
  checkout: Checkout;
  server: PolarServer;
}> {
  const { value, server } = await withPolarRead((client) =>
    client.checkouts.get({ id }),
  );
  return { checkout: value, server };
}

export async function getPolarSubscription(id: string): Promise<{
  subscription: Subscription;
  server: PolarServer;
}> {
  const { value, server } = await withPolarRead((client) =>
    client.subscriptions.get({ id }),
  );
  return { subscription: value, server };
}

export async function listPolarOrdersForCheckout(checkoutId: string): Promise<Order[]> {
  const { value } = await withPolarRead(async (client) => {
    const page = await client.orders.list({
      checkoutId,
      limit: 20,
    });
    return page.result.items;
  });
  return value;
}

export async function listRecentPaidCheckouts(externalCustomerId: string): Promise<Checkout[]> {
  const { value } = await withPolarRead(async (client) => {
    const page = await client.checkouts.list({
      externalCustomerId,
      status: ["succeeded", "confirmed"],
      limit: 10,
      sorting: ["-created_at"],
    });
    return page.result.items;
  });
  return value;
}
