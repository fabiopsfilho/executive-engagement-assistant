import { useState } from 'react';
import type { Account, Attendee } from '../types';
import { accounts } from '../data/accounts';
import { AccountSelectorPanel } from '../components/panels/AccountSelectorPanel';
import { IntelligenceDashboardPanel } from '../components/panels/IntelligenceDashboardPanel';
import { EngagementPlanPanel } from '../components/panels/EngagementPlanPanel';

/**
 * Dashboard page with three-panel layout:
 * - Panel 1: Account Selector (left)
 * - Panel 2: Intelligence Dashboard (center)
 * - Panel 3: Engagement Plan Generator (right)
 */
export function Dashboard() {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Attendee | null>(null);

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Panel 1: Account Selector */}
      <div className="w-80 border-r border-dark-600 overflow-y-auto bg-dark-800">
        <AccountSelectorPanel
          accounts={accounts}
          selectedAccount={selectedAccount}
          onSelectAccount={(account) => {
            setSelectedAccount(account);
            setSelectedPersona(null);
          }}
        />
      </div>

      {/* Panel 2: Intelligence Dashboard */}
      <div className="flex-1 overflow-y-auto">
        <IntelligenceDashboardPanel account={selectedAccount} />
      </div>

      {/* Panel 3: Engagement Plan Generator */}
      <div className="w-96 border-l border-dark-600 overflow-y-auto bg-dark-800">
        <EngagementPlanPanel
          account={selectedAccount}
          selectedPersona={selectedPersona}
          onSelectPersona={setSelectedPersona}
        />
      </div>
    </div>
  );
}
