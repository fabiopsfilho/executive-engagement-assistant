import type { Account } from '../../types';

interface IntelligenceDashboardPanelProps {
  account: Account | null;
}

/**
 * Panel 2: Intelligence Dashboard
 * - Account overview card (industry, segment, spend, PPA)
 * - Salesforce data card (open opps, T2K, account plan priority)
 * - T&C current state card (Skill Builder seats, activation, certs, renewal)
 * - Signal severity table (Talent War, Board Pressure, Compliance, etc.)
 * - Public intelligence feed (earnings, jobs, social, Glassdoor, news)
 */
export function IntelligenceDashboardPanel({
  account,
}: IntelligenceDashboardPanelProps) {
  if (!account) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        <div className="text-center">
          <p className="text-lg font-medium">Select an account</p>
          <p className="text-sm mt-1">
            Choose an account from the left panel to view intelligence
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-semibold text-white">
        {account.customer_name} — Intelligence Dashboard
      </h2>

      {/* Account Overview */}
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-4">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Account Overview
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted">Industry</p>
            <p className="text-sm text-white font-medium">{account.industry}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Segment</p>
            <p className="text-sm text-white font-medium">{account.segment}</p>
          </div>
          <div>
            <p className="text-xs text-muted">AWS Spend (CY)</p>
            <p className="text-sm text-white font-medium">
              ${(account.aws_spend.current_year / 1_000_000).toFixed(1)}M
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">PPA</p>
            <p className="text-sm text-white font-medium">
              {account.aws_spend.ppa}
            </p>
          </div>
        </div>
      </div>

      {/* Salesforce Data */}
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-4">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Salesforce Data
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted">Open Opps</p>
            <p className="text-sm text-white font-medium">
              {account.sfdc_data.open_opps}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">T2K</p>
            <p className="text-sm text-white font-medium">
              {account.sfdc_data.t2k ? 'Yes' : 'No'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Priority</p>
            <p className="text-sm text-white font-medium">
              {account.sfdc_data.account_plan_priority}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">SMGS Phase</p>
            <p className="text-sm text-white font-medium">
              {account.sfdc_data.smgs_phase}
            </p>
          </div>
        </div>
      </div>

      {/* T&C Current State */}
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-4">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          T&C Current State
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted">Skill Builder</p>
            <p className="text-sm text-white font-medium">
              {account.tc_current_state.skill_builder
                ? `${account.tc_current_state.skill_builder_seats} seats`
                : 'None'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Activation</p>
            <p className="text-sm text-white font-medium">
              {account.tc_current_state.activation_rate}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Certifications</p>
            <p className="text-sm text-white font-medium">
              {account.tc_current_state.certifications}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Renewal</p>
            <p className="text-sm text-white font-medium">
              {account.tc_current_state.renewal_date || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Signal Severity */}
      {account.signals.length > 0 && (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-4">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Signals
          </h3>
          <div className="space-y-2">
            {account.signals.map((signal) => (
              <div
                key={signal.label}
                className="flex items-center gap-3 p-2 rounded-lg bg-dark-700"
              >
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    signal.severity === 'HIGH'
                      ? 'bg-red-500/15 text-red-400'
                      : signal.severity === 'MEDIUM'
                      ? 'bg-orange-500/15 text-orange-400'
                      : 'bg-blue-500/15 text-blue-400'
                  }`}
                >
                  {signal.severity}
                </span>
                <span className="text-sm text-white">{signal.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
