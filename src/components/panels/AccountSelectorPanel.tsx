import { useState } from 'react';
import { Search } from 'lucide-react';
import type { Account } from '../../types';

interface AccountSelectorPanelProps {
  accounts: Account[];
  selectedAccount: Account | null;
  onSelectAccount: (account: Account) => void;
}

/**
 * Panel 1: Account Selector
 * - Search bar with autocomplete
 * - Account list with T&C Opportunity Score badges
 * - Filters: segment, geo, industry, score range
 */
export function AccountSelectorPanel({
  accounts,
  selectedAccount,
  onSelectAccount,
}: AccountSelectorPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAccounts = accounts.filter((account) =>
    account.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
        Accounts
      </h2>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          placeholder="Search accounts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white placeholder:text-muted focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Account List */}
      <div className="space-y-2">
        {filteredAccounts.map((account) => (
          <button
            key={account.customer_name}
            onClick={() => onSelectAccount(account)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selectedAccount?.customer_name === account.customer_name
                ? 'bg-purple-500/10 border-purple-500/30'
                : 'bg-dark-700 border-dark-600 hover:border-dark-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {account.customer_name}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {account.industry} · {account.segment} · {account.geo}
                </p>
              </div>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                  account.tc_opportunity_score >= 8
                    ? 'bg-green-500'
                    : account.tc_opportunity_score >= 6
                    ? 'bg-orange-500'
                    : 'bg-blue-500'
                }`}
              >
                {account.tc_opportunity_score}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
