import { useState, useRef, useEffect } from 'react';
import { Search, Building2, MapPin, Calendar, Upload, Database, FlaskConical } from 'lucide-react';
import type { Account } from '../types';
import { parseEBCCsv, ebcRecordsToAccounts } from '../services/csvParser';
import { isBackendAvailable, loadEBCDataFromS3 } from '../services/api';

function fmt(n: number) {
  if (n === 0) return '—';
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : `${n}`;
}

type DataMode = 'demo' | 'live';

export function AccountSelector({ accounts, onSelect }: { accounts: Account[]; onSelect: (a: Account) => void }) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<DataMode>('demo');
  const [liveAccounts, setLiveAccounts] = useState<Account[]>([]);
  const [csvLoaded, setCsvLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeAccounts = mode === 'demo' ? accounts : liveAccounts;
  const filtered = activeAccounts.filter(a =>
    a.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    a.industry.toLowerCase().includes(search.toLowerCase()) ||
    a.geo.toLowerCase().includes(search.toLowerCase())
  );

  // Auto-load EBC data from S3 when switching to Live mode
  useEffect(() => {
    if (mode !== 'live' || csvLoaded || !isBackendAvailable()) return;
    loadEBCDataFromS3().then(csv => {
      if (csv) {
        const records = parseEBCCsv(csv);
        const parsed = ebcRecordsToAccounts(records);
        setLiveAccounts(parsed);
        setCsvLoaded(true);
      }
    });
  }, [mode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const records = parseEBCCsv(text);
      const parsed = ebcRecordsToAccounts(records);
      setLiveAccounts(parsed);
      setCsvLoaded(true);
    };
    reader.readAsText(file);
  };

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

      {/* CSV Upload (Live mode) */}
      {mode === 'live' && !csvLoaded && (
        <div className="mb-5">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex flex-col items-center gap-2 py-6 border-2 border-dashed border-green-500/30 rounded-xl bg-green-500/5 active:bg-green-500/10"
          >
            <Upload className="w-6 h-6 text-green-400" />
            <span className="text-sm text-green-400 font-medium">Upload EBC Calendar CSV</span>
            <span className="text-[11px] text-muted">Export from QuickSight → drop here</span>
          </button>
        </div>
      )}

      {mode === 'live' && csvLoaded && (
        <div className="flex items-center justify-between mb-4 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
          <span className="text-xs text-green-400 font-medium">✓ {liveAccounts.length} accounts loaded from EBC calendar</span>
          <button onClick={() => { setCsvLoaded(false); setLiveAccounts([]); }} className="text-[11px] text-muted active:text-white">Reset</button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input type="text" placeholder="Search accounts..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-muted text-sm focus:outline-none focus:border-purple-500/50" />
      </div>

      {/* Account List */}
      {filtered.length === 0 && mode === 'live' && !csvLoaded && (
        <div className="text-center py-8">
          <p className="text-sm text-muted">Upload an EBC calendar CSV to see real accounts</p>
        </div>
      )}

      <div className="space-y-2.5">
        {filtered.map((account, idx) => {
          const nextEbc = account.ebc_data.meeting_dates[0];
          const daysUntilEbc = nextEbc ? Math.ceil((new Date(nextEbc).getTime() - Date.now()) / 86400000) : null;
          const isLive = mode === 'live';

          return (
            <button key={`${account.customer_name}-${idx}`} onClick={() => onSelect(account)}
              className="w-full text-left p-4 bg-dark-800 border border-dark-600 rounded-xl active:bg-dark-700 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white truncate">{account.customer_name}</h3>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{account.industry}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{account.geo}</span>
                    {isLive && <span className="text-[10px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded">LIVE</span>}
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
                {account.aws_spend.current_year > 0 && <span>{fmt(account.aws_spend.current_year)} spend</span>}
                <span>{account.segment}</span>
                {daysUntilEbc !== null && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />EBC {daysUntilEbc > 0 ? `in ${daysUntilEbc}d` : 'today'}</span>}
                {!account.tc_current_state.skill_builder && account.sfdc_data.smgs_phase === 'Greenfield' && <span className="text-orange-400">Greenfield</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
