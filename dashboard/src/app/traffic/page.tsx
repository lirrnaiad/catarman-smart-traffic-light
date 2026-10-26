import { Suspense } from "react";
import { TrafficPeaks } from "../../components/traffic/traffic-peaks.tsx";

// TrafficPeaks reads `?date=` through useSearchParams, which a static export needs inside Suspense.
export default function TrafficPage() {
  return (
    <Suspense>
      <TrafficPeaks />
    </Suspense>
  );
}
