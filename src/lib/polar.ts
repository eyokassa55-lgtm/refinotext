import "server-only";

import { Polar } from "@polar-sh/sdk";

import {
  describePolarError,
  isWrongPolarEnvironmentError,
  PolarConfigError,
} from "@/lib/polar-error";

export type PolarServer = "sandbox" | "production";

const clients = new Map<PolarServer, Polar>();

function readAccessToken(): string | undefined {
  const value = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (!value || value === "placeholder") return undefined;
  return value;
}

export function getConfiguredPolarServer(): PolarServer {
  return process.env.POLAR_SERVER === "production" ? "production" : "sandbox";
}

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

function polarServersToTry(): PolarServer[] {
  const configured = getConfiguredPolarServer();
  const fallback = configured === "sandbox" ? "production" : "sandbox";
  return [configured, fallback];
}

export async function createPolarCheckout(input: {
  productId: string;
  productKey: string;
  externalCustomerId: string;
  customerEmail: string;
  customerName?: string;
  successUrl: string;
  returnUrl: string;
  metadata: Record<string, string | number | boolean>;
  customerMetadata: Record<string, string | number | boolean>;
}) {
  const token = getPolarTokenStatus();
  if (!token.usable) {
    throw new PolarConfigError(
      "POLAR_ACCESS_TOKEN is missing or not a Polar access token.",
    );
  }

  let lastError: unknown;

  for (const server of polarServersToTry()) {
    try {
      const checkout = await getPolarClient(server).checkouts.create({
        products: [input.productId],
        externalCustomerId: input.externalCustomerId,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        successUrl: input.successUrl,
        returnUrl: input.returnUrl,
        allowDiscountCodes: true,
        metadata: input.metadata,
        customerMetadata: input.customerMetadata,
      });

      if (server !== token.server) {
        console.warn(
          `[polar] Checkout succeeded on ${server}. Set POLAR_SERVER=${server} in .env.local.`,
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
      if (!isWrongPolarEnvironmentError(error)) {
        throw error;
      }
      console.warn(
        `[polar] ${server} rejected checkout for ${input.productKey} (${input.productId}). Trying the other Polar environment.`,
      );
    }
  }

  throw lastError;
}
