import { OverrideLog } from "../../../components/override-log/override-log.tsx";

/** `/log/overrides/`: override commands and their outcomes (CAP-5). */
export default function OverrideLogPage() {
  return (
    <div className="px-page-margin pt-[20px] pb-page-margin">
      <OverrideLog />
    </div>
  );
}
