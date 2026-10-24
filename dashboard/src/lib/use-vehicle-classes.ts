"use client";

import { VehicleClass } from "@stl/contracts";
import { useEffect, useState } from "react";
import { z } from "zod";
import { type ApiRequestError, apiGet } from "./api/client.ts";

type Result = {
  classes: VehicleClass[] | null;
  error: ApiRequestError | null;
};

// One request per page load, shared by every caller; a failed request is dropped so the next mount retries.
let pending: Promise<VehicleClass[]> | undefined;

/** The class list from `GET /api/vehicle-classes`, in file order. `classes` is null until it loads. */
export function useVehicleClasses(): Result {
  const [result, setResult] = useState<Result>({ classes: null, error: null });
  useEffect(() => {
    let mounted = true;
    pending ??= apiGet("/api/vehicle-classes", z.array(VehicleClass)).catch(
      (error: unknown) => {
        pending = undefined;
        throw error;
      },
    );
    pending.then(
      (classes) => mounted && setResult({ classes, error: null }),
      (error: ApiRequestError) =>
        mounted && setResult({ classes: null, error }),
    );
    return () => {
      mounted = false;
    };
  }, []);
  return result;
}
