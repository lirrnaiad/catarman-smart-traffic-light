import type { VehicleClass } from "@stl/contracts";
import vehicleClasses from "@stl/contracts/vehicle-classes.json" with {
  type: "json",
};
import { Router } from "express";

const body: VehicleClass[] = vehicleClasses;

/** GET /api/vehicle-classes: the file as-is, in file order (AD-12). */
export default () =>
  Router().get("/vehicle-classes", (_req, res) => {
    res.json(body);
  });
