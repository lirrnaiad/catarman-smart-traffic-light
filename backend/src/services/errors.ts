import type { ErrorCode } from "@stl/contracts";

export const errorStatus: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  CONTROLLER_OFFLINE: 409,
  INTERNAL: 500,
};

/** Thrown by services and routes; the error middleware maps it to `ApiError`. */
export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}
