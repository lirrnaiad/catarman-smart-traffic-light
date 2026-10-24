import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

let useVehicleClasses: typeof import("./use-vehicle-classes.ts").useVehicleClasses;

function Classes({ name }: { name: string }) {
  const { classes, error } = useVehicleClasses();
  return (
    <p>{`${name}:${classes?.map((c) => c.id).join(",") ?? "-"}:${error?.code ?? "-"}`}</p>
  );
}

async function setup(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  // A fresh module per test, so its one-request cache starts empty.
  ({ useVehicleClasses } = await import("./use-vehicle-classes.ts"));
  return fetchMock;
}

it("loads once and shares the list with every caller", async () => {
  const fetchMock = await setup(200, [
    { id: "car", label: "Car", pcu: 1 },
    { id: "tricycle", label: "Tricycle", pcu: 0.5 },
  ]);
  const view = render(
    <>
      <Classes name="a" />
      <Classes name="b" />
    </>,
  );
  expect(await screen.findByText("a:car,tricycle:-")).toBeTruthy();
  expect(await screen.findByText("b:car,tricycle:-")).toBeTruthy();
  view.unmount();
  render(<Classes name="c" />);
  expect(await screen.findByText("c:car,tricycle:-")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("/api/vehicle-classes", undefined);
});

it("returns the error code when the request fails, and the next mount retries", async () => {
  const fetchMock = await setup(500, {
    error: { code: "INTERNAL", message: "x" },
  });
  const view = render(<Classes name="a" />);
  expect(await screen.findByText("a:-:INTERNAL")).toBeTruthy();
  view.unmount();

  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify([{ id: "car", label: "Car", pcu: 1 }]), {
        status: 200,
      }),
  );
  render(<Classes name="b" />);
  expect(await screen.findByText("b:car:-")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
