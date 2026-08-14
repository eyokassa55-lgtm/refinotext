import "server-only";

import { PolarError } from "@polar-sh/sdk/models/errors/polarerror.js";
import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror.js";

function getErrorStatus(error: unknown): number | null {
  if (error instanceof PolarError) return error.statusCode;
  if (error && typeof error === "object" && "statusCode" in error) {
    const status = (error as { statusCode: unknown }).statusCode;
    return typeof status === "number" ? status : null;
  }
  return null;
}

function getErrorBody(error: unknown): string | null {
  if (error instanceof PolarError) return error.body || null;
  if (error && typeof error === "object" && "body" in error) {
    const body = (error as { body: unknown }).body;
    return typeof body === "string" && body ? body : null;
  }
  return null;
}

export class PolarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolarConfigError";
  }
}

export type PolarErrorInfo = {
  name: string;
  statusCode: number | null;
  message: string;
  body: string | null;
  publicMessage: string;
};

export function redactPolarSecrets(value: string): string {
  return value
    .replace(/polar_oat_[A-Za-z0-9]+/gi, "[redacted-token]")
    .replace(/polar_at_[A-Za-z0-9]+/gi, "[redacted-token]")
    .replace(/polar_whs_[A-Za-z0-9]+/gi, "[redacted-secret]");
}

export function isWrongPolarEnvironmentError(error: unknown): boolean {
  const status = getErrorStatus(error);
  return status === 401 || status === 403 || status === 404;
}

export function describePolarError(error: unknown): PolarErrorInfo {
  if (error instanceof PolarConfigError) {
    return {
      name: error.name,
      statusCode: 500,
      message: error.message,
      body: null,
      publicMessage: error.message,
    };
  }

  if (error instanceof SDKValidationError) {
    const message = redactPolarSecrets(error.message);
    return {
      name: error.name,
      statusCode: 400,
      message,
      body: null,
      publicMessage: "Polar rejected the checkout payload.",
    };
  }

  const statusCode = getErrorStatus(error);
  const rawBody = getErrorBody(error);
  if (statusCode !== null || rawBody) {
    const body = rawBody ? redactPolarSecrets(rawBody) : null;
    const message = redactPolarSecrets(
      error instanceof Error ? error.message : "Polar API error",
    );
    return {
      name: error instanceof Error ? error.name : "PolarError",
      statusCode,
      message,
      body,
      publicMessage: publicMessageForStatus(statusCode ?? 502, body),
    };
  }

  const message = redactPolarSecrets(
    error instanceof Error ? error.message : "Unknown Polar error",
  );

  return {
    name: "Error",
    statusCode: null,
    message,
    body: null,
    publicMessage: "Could not reach Polar. Check the server logs.",
  };
}

function publicMessageForStatus(statusCode: number, body: string | null): string {
  if (statusCode === 401 || statusCode === 403) {
    return "Payments could not be authorized. Please try again later.";
  }
  if (statusCode === 404) {
    return "The selected plan is unavailable. Please try another plan or contact support.";
  }
  if (statusCode === 422) {
    return "Polar rejected the checkout request. Check the server logs for the validation details.";
  }
  if (body) {
    return `Polar checkout failed (${statusCode}).`;
  }
  return `Polar checkout failed (${statusCode}).`;
}
