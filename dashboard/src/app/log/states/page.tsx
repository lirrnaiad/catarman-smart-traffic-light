import { StateHistory } from "../../../components/state-history/state-history.tsx";

/** `/log/states/`: signal-state changes (CAP-2). */
export default function StateHistoryPage() {
  return (
    <div className="px-page-margin pt-[20px] pb-page-margin">
      <StateHistory />
    </div>
  );
}
