import { Suspense } from "react";
import { BreachLog } from "../../components/breach/breach-log.tsx";

// The log reads `?id=` through useSearchParams, which a static export needs inside Suspense.
export default function BreachesPage() {
  return (
    <Suspense>
      <BreachLog />
    </Suspense>
  );
}
