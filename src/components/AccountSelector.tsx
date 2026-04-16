import { useState } from 'react';
import { Search, Building2, MapPin, Calendar } from 'lucide-react';
import type { Account } from '../types';

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;
}

export function AccountSelector({ accounts, onSelect }: { accounts: Account[]; onSelect: (a: Account) => void }) {
  const [search, setSearch] = useState('');
  const filtered = accounts.filter(a =>
    a.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    a.industry.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 py-8">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-3">
          <span className="text-xl">⚡</span>
        </div>
        <h1 className="text-xl font-bold text-white mb-1">Executive Brief</h1>
        <p className="text-sm text-muted">Win the Meeting.</p>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input type="text" placeholder="Search accounts..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-muted text-sm focus:outline-none focus:border-purple-500/50" />
      </div>

      <div className="space-y-2.5">
        {filtered.map(account => {
          const nextEbc = account.ebc_data.meeting_dates[0];
          const daysUntilEbc = nextEbc ? Math.ceil((new Date(nextEbc).getTime() - Date.now()) / 86400000) : null;

          return (
            <button key={account.customer_name} onClick={() => onSelect(account)}
              className="w-full text-left p-4 bg-dark-800 border border-dark-600 rounded-xl active:bg-dark-700 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white truncate">{account.customer_name}</h3>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{account.industry}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{account.geo}</span>
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-xl ${account.tc_opportunity_score >= 8 ? 'bg-green-500' : account.tc_opportunity_score >= 6 ? 'bg-orange-500' : 'bg-blue-500'} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                  {account.tc_opportunity_score}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {account.signals.slice(0, 3).map(s => (
                  <span key={s.label} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    s.severity === 'HIGH' ? 'bg-red-500/15 text-red-400' : 'bg-orange-500/15 text-orange-400'
                  }`}>{s.label}</span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted">
                <span>{fmt(account.aws_spend.current_year)} spend</span>
                {daysUntilEbc !== null && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />EBC in {daysUntilEbc}d</span>}
                {!account.tc_current_state.skill_builder && <span className="text-orange-400">Greenfield</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
