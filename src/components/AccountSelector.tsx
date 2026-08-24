import { useState, useEffect } from 'react';
import { Search, Building2, MapPin, Calendar, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import type { Account } from '../types';
import { parseEBCCsv, ebcRecordsToAccounts } from '../services/csvParser';
import { isBackendAvailable, loadEBCDataFromS3 } from '../services/api';

/**
 * Build a minimal Account from just a customer name. Used by the standalone
 * browser interface so a user can type ANY customer (even one without a
 * scheduled EBC agenda) and still get the full AI experience — the backend
 * enriches everything from the name + industry via Bedrock/search.
 */
export function blankAccountFromName(name: string, industry = 'Unknown'): Account {
  const clean = name.trim();
  return {
    customer_name: clean,
    industry,
    segment: 'Enterprise',
    geo: 'NAMER',
    externalDocs: [],
    aws_spend: { current_year: 0, prior_year: 0, ppa: 'None' },
    sfdc_data: { open_opps: 0, t2k: false, account_plan_priority: '', smgs_phase: 'Greenfield' },
    ebc_data: { ebc_id: '', meeting_dates: [], themes: [], attendees: [], location: '', requestor: '' },
    tc_current_state: {
      skill_builder: false, skill_builder_seats: 0, activation_rate: 0,
      certifications: 0, prior_engagement: '', renewal_date: '',
    },
    public_intelligence: {
      earnings_call_signals: [], linkedin_job_postings: { cloud_ai_roles: 0, yoy_change: '' },
      executive_social: [], glassdoor_signals: [], industry_context: '', news_signals: [],
    },
    tc_opportunity_score: 0,
    signals: [],
  };
}

function AccountCard({ account, onSelect }: { account: Account; onSelect: (a: Account) => void }) {
  const nextEbc = account.ebc_data.meeting_dates[0];
  const daysUntilEbc = nextEbc ? Math.ceil((new Date(nextEbc).getTime() - Date.now()) / 86400000) : null;
  const ebcDate = nextEbc ? new Date(nextEbc).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <button onClick={() => onSelect(account)}
      className="w-full text-left p-4 bg-dark-800 border border-dark-600 rounded-xl active:bg-dark-700 transition-colors mb-2.5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white truncate">{account.customer_name}</h3>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted flex-wrap">
            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{account.industry}</span>
            <span className="text-dark-600">·</span>
            <span>{account.segment}</span>
            <span className="text-dark-600">·</span>
            <span>{account.geo}</span>
          </div>
        </div>
        <div className={`w-10 h-10 rounded-xl ${account.tc_opportunity_score >= 8 ? 'bg-green-500' : account.tc_opportunity_score >= 6 ? 'bg-orange-500' : 'bg-blue-500'} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
          {account.tc_opportunity_score}
        </div>
      </div>
      {/* EBC info bar */}
      {ebcDate && (
        <div className="flex items-center gap-3 mb-2 text-[11px] flex-wrap">
          <span className="flex items-center gap-1 text-blue-400"><Calendar className="w-3 h-3" />{ebcDate}</span>
          {daysUntilEbc !== null && <span className="text-muted">{daysUntilEbc > 0 ? `in ${daysUntilEbc} days` : daysUntilEbc === 0 ? 'Today' : `${Math.abs(daysUntilEbc)}d ago`}</span>}
          <span className="flex items-center gap-1 text-muted"><MapPin className="w-3 h-3" />{account.ebc_data.location}</span>
        </div>
      )}
      {/* EBC Title */}
      {account.ebc_data.themes[0] && (
        <p className="text-[11px] text-purple-400 font-medium mb-2 truncate">{account.ebc_data.themes[0]}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {account.signals.slice(0, 3).map(s => (
          <span key={s.label} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            s.severity === 'HIGH' ? 'bg-red-500/15 text-red-400' : 'bg-orange-500/15 text-orange-400'
          }`}>{s.label}</span>
        ))}
        {!account.tc_current_state.skill_builder && account.sfdc_data.smgs_phase === 'Greenfield' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 font-medium">Greenfield</span>}
      </div>
    </button>
  );
}

export function AccountSelector({ accounts, onSelect }: { accounts: Account[]; onSelect: (a: Account) => void }) {
  const [search, setSearch] = useState('');
  const [allAccounts, setAllAccounts] = useState<Account[]>(accounts);
  const [loading, setLoading] = useState(true);
  const [noAgendaAccount, setNoAgendaAccount] = useState<string | null>(null);
  const [geoFilter, setGeoFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  // Auto-load EBC data from S3 on startup
  useEffect(() => {
    if (!isBackendAvailable()) {
      setAllAccounts(accounts);
      setLoading(false);
      return;
    }
    loadEBCDataFromS3().then(csv => {
      if (csv) {
        const records = parseEBCCsv(csv);
        const parsed = ebcRecordsToAccounts(records);
        setAllAccounts(parsed);

        // Check if URL has an account param to auto-select
        const params = new URLSearchParams(window.location.search);
        const accountName = params.get('account');
        if (accountName) {
          const found = parsed.find(a => a.customer_name.toLowerCase() === accountName.toLowerCase()) ||
            parsed.find(a => a.customer_name.toLowerCase().includes(accountName.toLowerCase()) || accountName.toLowerCase().includes(a.customer_name.toLowerCase()));
          if (found) {
            onSelect(found);
          } else {
            setNoAgendaAccount(accountName);
          }
        }
      } else {
        setAllAccounts(accounts);
        // Check URL param against demo data
        const params = new URLSearchParams(window.location.search);
        const accountName = params.get('account');
        if (accountName) {
          const found = accounts.find(a => a.customer_name.toLowerCase() === accountName.toLowerCase()) ||
            accounts.find(a => a.customer_name.toLowerCase().includes(accountName.toLowerCase()) || accountName.toLowerCase().includes(a.customer_name.toLowerCase()));
          if (found) {
            onSelect(found);
          } else {
            setNoAgendaAccount(accountName);
          }
        }
      }
    }).catch(() => {
      setAllAccounts(accounts);
    }).finally(() => setLoading(false));
  }, []);

  // Get unique geos — only show real geo names
  const validGeos = ['NAMER', 'EMEA', 'APJ', 'LATAM', 'GFS', 'GCR'];
  const geos = [...new Set(allAccounts.map(a => a.geo))].filter(g => validGeos.includes(g)).sort();

  // Get briefing centers filtered by selected geo
  const locationsForGeo = geoFilter === 'all'
    ? [...new Set(allAccounts.map(a => a.ebc_data.location))].sort()
    : [...new Set(allAccounts.filter(a => a.geo === geoFilter).map(a => a.ebc_data.location))].sort();

  // Get unique months from EBC dates
  const months = [...new Set(allAccounts.map(a => {
    const d = a.ebc_data.meeting_dates[0];
    if (!d) return '';
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }).filter(Boolean))].sort();

  const monthLabels: Record<string, string> = {};
  months.forEach(m => {
    const [y, mo] = m.split('-');
    const date = new Date(Number(y), Number(mo) - 1);
    monthLabels[m] = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });

  // Reset location filter when geo changes
  useEffect(() => {
    if (locationFilter !== 'all' && !locationsForGeo.includes(locationFilter)) {
      setLocationFilter('all');
    }
  }, [geoFilter]);

  const filtered = allAccounts.filter(a => {
    if (geoFilter !== 'all' && a.geo !== geoFilter) return false;
    if (locationFilter !== 'all' && a.ebc_data.location !== locationFilter) return false;
    if (monthFilter !== 'all') {
      const d = a.ebc_data.meeting_dates[0];
      if (d) {
        const date = new Date(d);
        const m = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (m !== monthFilter) return false;
      } else return false;
    }
    if (search) {
      return a.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        a.industry.toLowerCase().includes(search.toLowerCase()) ||
        a.geo.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  return (
    <div className="px-4 py-6">
      {/* Header banner */}
      <div className="flex items-center gap-3 mb-6">
        <img src="/aws-logo.svg" alt="AWS" className="h-7" />
        <div>
          <h1 className="text-sm font-semibold text-white leading-tight">Executive Engagement Advisor</h1>
          <p className="text-[11px] text-muted">AWS Training & Certification</p>
        </div>
      </div>

      <div className="text-center mb-5">
        <h2 className="text-xl font-bold text-white mb-1">Who are you meeting with?</h2>
        <p className="text-sm text-muted">Select an account to build your engagement story</p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
          <span className="text-xs text-muted">Loading...</span>
        </div>
      )}

      {/* No scheduled agenda for the requested account — offer to continue anyway
          with just the name (the standalone experience works for any customer). */}
      {noAgendaAccount && !loading && (
        <div className="text-center py-8 px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-800 border border-dark-600 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-purple-400" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">{noAgendaAccount}</h3>
          <p className="text-sm text-muted mb-5">No scheduled EBC agenda — but you can still build the full engagement story from the name.</p>
          <button
            onClick={() => onSelect(blankAccountFromName(noAgendaAccount))}
            className="inline-flex items-center gap-2 px-5 py-3 bg-purple-600 active:bg-purple-700 text-white rounded-xl text-sm font-medium">
            Continue with {noAgendaAccount} <ArrowRight className="w-4 h-4" />
          </button>
          <div className="mt-4">
            <button onClick={() => setNoAgendaAccount(null)} className="text-xs text-muted underline">
              or browse the account list
            </button>
          </div>
        </div>
      )}

      {!loading && !noAgendaAccount && (
        <>
          {/* Search — also doubles as free-text customer entry */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input type="text" placeholder="Search or type any customer name..." value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                // Enter on a non-matching name → proceed with that name directly.
                if (e.key === 'Enter' && search.trim().length > 1 && filtered.length === 0) {
                  onSelect(blankAccountFromName(search.trim()));
                }
              }}
              className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-muted text-sm focus:outline-none focus:border-purple-500/50" />
          </div>

          {/* Free-text customer: if the typed name doesn't match any scheduled
              account, let the user proceed with just the name (works for any customer). */}
          {search.trim().length > 1 && filtered.length === 0 && (
            <button
              onClick={() => onSelect(blankAccountFromName(search.trim()))}
              className="w-full flex items-center justify-between gap-3 mb-4 p-4 bg-purple-600/10 border border-purple-500/30 rounded-xl active:bg-purple-600/20 text-left">
              <span className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-sm text-white truncate">Build engagement story for <span className="font-semibold">"{search.trim()}"</span></span>
              </span>
              <ArrowRight className="w-4 h-4 text-purple-400 shrink-0" />
            </button>
          )}

          {/* Filters */}
          <div className="flex gap-2 mb-4">
            <select
              value={geoFilter}
              onChange={e => setGeoFilter(e.target.value)}
              className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="all">All Geos</option>
              {geos.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="all">All Centers</option>
              {locationsForGeo.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="all">All Months</option>
              {months.map(m => <option key={m} value={m}>{monthLabels[m]}</option>)}
            </select>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[11px] text-muted">{filtered.length} accounts</span>
          </div>

          {/* Account List grouped by briefing center */}
          <div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {(() => {
              if (locationFilter === 'all' && filtered.length > 0) {
                const grouped = new Map<string, typeof filtered>();
                for (const account of filtered) {
                  const loc = account.ebc_data.location || 'Unknown';
                  if (!grouped.has(loc)) grouped.set(loc, []);
                  grouped.get(loc)!.push(account);
                }

                return [...grouped.entries()].map(([location, accts]) => (
                  <div key={location} className="md:col-span-2">
                    <div className="flex items-center gap-2 mt-4 mb-2 first:mt-0">
                      <MapPin className="w-3.5 h-3.5 text-green-400" />
                      <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider">{location}</h3>
                      <span className="text-[10px] text-muted">({accts.length})</span>
                    </div>
                    <div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                      {accts.map((account, idx) => (
                        <AccountCard key={`${account.customer_name}-${idx}`} account={account} onSelect={onSelect} />
                      ))}
                    </div>
                  </div>
                ));
              }

              return filtered.map((account, idx) => (
                <AccountCard key={`${account.customer_name}-${idx}`} account={account} onSelect={onSelect} />
              ));
            })()}
          </div>
        </>
      )}
    </div>
  );
}
