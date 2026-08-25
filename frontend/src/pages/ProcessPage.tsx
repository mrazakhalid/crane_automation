import { ProcessWorkspace } from '../components/ProcessWorkspace.js';

/**
 * Process page.
 *
 * Purpose: The manager workspace for the recipe → divide → run flow. Upload or
 *   pick a recipe, divide its tasks across ALL lines/PLCs automatically (the
 *   summary shows which PLC receives which tasks), resolve any ambiguous tanks,
 *   then start a live simulated run. No PLC is contacted yet — the run is a
 *   time-based simulation of the eventual flow. The workspace itself lives in
 *   `ProcessWorkspace`, shared with the manager Dashboard.
 */
export function ProcessPage() {
  return (
    <div className="page">
      <div className="page-body">
        <div className="page-body__inner page-body__inner--wide process-page">
          <p className="eyebrow">Process</p>
          <ProcessWorkspace />
        </div>
      </div>
    </div>
  );
}
