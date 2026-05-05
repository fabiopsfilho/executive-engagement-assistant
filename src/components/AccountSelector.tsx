import { useState, useEffect } from 'react';
import { Search, Building2, MapPin, Calendar, Database, FlaskConical, Loader2 } from 'lucide-react';
import type { Account } from '../types';
import { parseEBCCsv, ebcRecordsToAccounts } from '../services/csvParser';
import { isBackendAvailable, loadEBCDataFromS3 } from '../services/api';

function AccountCard({ account, onSelect, isLive }: { account: Account; onSelect: (a: Account) => void; isLive: boolean }) {
  const nextEbc = account.ebc_data.meeting_dates[0];
  const daysUntilEbc = nextEbc ? Math.ceil((new Date(nextEbc).getTime() - Date.now()) / 86400000) : null;
  const ebcStart = account.ebc_data.meeting_dates[0];
  // Calculate EBC duration from the data if available
  const ebcDate = ebcStart ? new Date(ebcStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

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
            {isLive && <span className="text-[10px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded">LIVE</span>}
          </div>
        </div>
        <div className={`w-10 h-10 rounded-xl ${account.tc_opportunity_score >= 8 ? 'bg-green-500' : account.tc_opportunity_score >= 6 ? 'bg-orange-500' : 'bg-blue-500'} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
          {account.tc_opportunity_score}
        </div>
      </div>
      {/* EBC info bar */}
      {ebcDate && (
        <div className="flex items-center gap-3 mb-2 text-[11px]">
          <span className="flex items-center gap-1 text-blue-400"><Calendar className="w-3 h-3" />{ebcDate}</span>
          {daysUntilEbc !== null && <span className="text-muted">{daysUntilEbc > 0 ? `in ${daysUntilEbc} days` : daysUntilEbc === 0 ? 'Today' : `${Math.abs(daysUntilEbc)}d ago`}</span>}
          <span className="flex items-center gap-1 text-muted"><MapPin className="w-3 h-3" />{account.ebc_data.location}</span>
        </div>
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

type DataMode = 'demo' | 'live';

export function AccountSelector({ accounts, onSelect }: { accounts: Account[]; onSelect: (a: Account) => void }) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<DataMode>('demo');
  const [liveAccounts, setLiveAccounts] = useState<Account[]>([]);
  const [csvLoaded, setCsvLoaded] = useState(false);
  const [loadingLive, setLoadingLive] = useState(false);
  const [geoFilter, setGeoFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  const activeAccounts = mode === 'demo' ? accounts : liveAccounts;

  // Get unique geos — only show real geo names, not business units
  const validGeos = ['NAMER', 'EMEA', 'APJ', 'LATAM', 'GFS', 'GCR'];
  const geos = [...new Set(activeAccounts.map(a => a.geo))].filter(g => validGeos.includes(g)).sort();

  // Get briefing centers filtered by selected geo
  const locationsForGeo = geoFilter === 'all'
    ? [...new Set(activeAccounts.map(a => a.ebc_data.location))].sort()
    : [...new Set(activeAccounts.filter(a => a.geo === geoFilter).map(a => a.ebc_data.location))].sort();

  // Reset location filter when geo changes and current location isn't available
  useEffect(() => {
    if (locationFilter !== 'all' && !locationsForGeo.includes(locationFilter)) {
      setLocationFilter('all');
    }
  }, [geoFilter]);

  const filtered = activeAccounts.filter(a => {
    if (geoFilter !== 'all' && a.geo !== geoFilter) return false;
    if (locationFilter !== 'all' && a.ebc_data.location !== locationFilter) return false;
    if (search) {
      return a.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        a.industry.toLowerCase().includes(search.toLowerCase()) ||
        a.geo.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  // Auto-load EBC data from S3 when switching to Live mode
  useEffect(() => {
    if (mode !== 'live' || csvLoaded) return;
    setLoadingLive(true);
    if (isBackendAvailable()) {
      loadEBCDataFromS3().then(csv => {
        if (csv) {
          const records = parseEBCCsv(csv);
          const parsed = ebcRecordsToAccounts(records);
          setLiveAccounts(parsed);
          setCsvLoaded(true);
        }
      }).finally(() => setLoadingLive(false));
    } else {
      setLoadingLive(false);
    }
  }, [mode]);

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

      {/* Data Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('demo')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-colors ${
            mode === 'demo'
              ? 'bg-purple-500/20 border border-purple-500/40 text-purple-400'
              : 'bg-dark-800 border border-dark-600 text-muted'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Demo Mode
        </button>
        <button
          onClick={() => setMode('live')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-colors ${
            mode === 'live'
              ? 'bg-green-500/20 border border-green-500/40 text-green-400'
              : 'bg-dark-800 border border-dark-600 text-muted'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Live EBC Data
        </button>
      </div>

      {/* Loading state for Live mode */}
      {mode === 'live' && loadingLive && (
        <div className="flex items-center justify-center gap-2 py-6 mb-4">
          <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
          <span className="text-xs text-green-400">Loading EBC calendar...</span>
        </div>
      )}

      {mode === 'live' && csvLoaded && (
        <div className="flex items-center justify-between mb-4 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
          <span className="text-xs text-green-400 font-medium">✓ {liveAccounts.length} accounts loaded</span>
          <span className="text-[11px] text-muted">{filtered.length} shown</span>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input type="text" placeholder="Search accounts..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-muted text-sm focus:outline-none focus:border-purple-500/50" />
      </div>

      {/* Filters (Live mode only, when data is loaded) */}
      {mode === 'live' && csvLoaded && (
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
            <option value="all">All Briefing Centers</option>
            {locationsForGeo.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      )}

      {/* Account List */}
      {filtered.length === 0 && mode === 'live' && !csvLoaded && !loadingLive && (
        <div className="text-center py-8">
          <p className="text-sm text-muted">No EBC data available. Upload a CSV to the S3 bucket.</p>
        </div>
      )}

      <div className="space-y-2.5">
        {(() => {
          // Group by briefing center when no specific location is selected
          if (mode === 'live' && csvLoaded && locationFilter === 'all') {
            const grouped = new Map<string, typeof filtered>();
            for (const account of filtered) {
              const loc = account.ebc_data.location || 'Unknown';
              if (!grouped.has(loc)) grouped.set(loc, []);
              grouped.get(loc)!.push(account);
            }

            return [...grouped.entries()].map(([location, accts]) => (
              <div key={location}>
                <div className="flex items-center gap-2 mt-4 mb-2 first:mt-0">
                  <MapPin className="w-3.5 h-3.5 text-green-400" />
                  <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider">{location}</h3>
                  <span className="text-[10px] text-muted">({accts.length})</span>
                </div>
                {accts.map((account, idx) => (
                  <AccountCard key={`${account.customer_name}-${idx}`} account={account} onSelect={onSelect} isLive={true} />
                ))}
              </div>
            ));
          }

          // Default: flat list
          return filtered.map((account, idx) => (
            <AccountCard key={`${account.customer_name}-${idx}`} account={account} onSelect={onSelect} isLive={mode === 'live'} />
          ));
        })()}
      </div>
    </div>
  );
}
