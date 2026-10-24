import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { ClassLabel } from "./class-label.tsx";

const car = { id: "car", label: "Car", pcu: 1 };
const tricycle = { id: "tricycle", label: "Tricycle", pcu: 0.8 };

it("shows the file's label with its class chip", () => {
  const { container } = render(
    <ClassLabel id="tricycle" classes={[car, tricycle]} />,
  );
  expect(container.textContent).toBe("Tricycle");
  expect(
    container.querySelector("[data-token]")?.getAttribute("data-token"),
  ).toBe("class-tricycle");
});

it("an unknown id shows raw with the class-unknown chip", () => {
  const { container } = render(<ClassLabel id="bus" classes={[car]} />);
  expect(container.textContent).toBe("bus");
  const chip = container.querySelector<HTMLElement>("[data-token]");
  expect(chip?.getAttribute("data-token")).toBe("class-unknown");
  expect(chip?.style.background).toBe("var(--color-class-unknown)");
});
