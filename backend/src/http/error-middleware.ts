import type { ApiError, ErrorCode } from "@stl/contracts";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, errorStatus } from "../services/errors.ts";

/** The one error middleware: AppError → its status, ZodError or bad JSON → 400, else 500. */
export const errorMiddleware: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  let code: ErrorCode = "INTERNAL";
  let message = "Internal server error";
  if (err instanceof AppError) {
    code = err.code;
    message = err.message;
  } else if (err instanceof ZodError) {
    code = "VALIDATION_FAILED";
    message = err.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
  } else if (err?.type === "entity.parse.failed") {
    code = "VALIDATION_FAILED";
    message = "Malformed JSON body";
  } else if (
    typeof err?.type === "string" &&
    typeof err.status === "number" &&
    err.status >= 400 &&
    err.status < 500
  ) {
    // Other body-parser errors: too large, bad charset, ...
    code = "VALIDATION_FAILED";
    message = err.message;
  } else {
    console.error("[http] unhandled error:", err);
  }

  const body: ApiError = { error: { code, message } };
  res.status(errorStatus[code]).json(body);
};
