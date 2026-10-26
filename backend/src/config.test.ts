import { describe, expect, it } from "vitest";
import { Env } from "./config.ts";

// Parses explicit objects: the loaded config always carries .env.test's exact value.
const DATABASE_URL = "mysql://stl:stl@127.0.0.1:3306/stl_test";

describe("DASHBOARD_ORIGINS", () => {
  it("trims each origin, drops empty entries and freezes the list", () => {
    const { DASHBOARD_ORIGINS } = Env.parse({
      DATABASE_URL,
      DASHBOARD_ORIGINS: " http://a:1 , ,http://b:2 ",
    });
    expect(DASHBOARD_ORIGINS).toEqual(["http://a:1", "http://b:2"]);
    expect(Object.isFrozen(DASHBOARD_ORIGINS)).toBe(true);
  });

  it("defaults to the dashboard dev server on localhost and 127.0.0.1:3000", () => {
    const { DASHBOARD_ORIGINS } = Env.parse({ DATABASE_URL });
    expect(DASHBOARD_ORIGINS).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
    expect(Object.isFrozen(DASHBOARD_ORIGINS)).toBe(true);
  });
});
