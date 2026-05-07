import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, BookOpen, Bot, Zap, Megaphone, Loader2 } from 'lucide-react';
import type { Account, Attendee } from './types';
import { accounts } from './data/accounts';
import { AccountSelector } from './components/AccountSelector';
import { ExecBrief } from './components/ExecBrief';
import { SummaryView } from './components/SummaryView';
import { AdvisorChat } from './components/AdvisorChat';
import { PersonaView } from './components/PersonaView';
import { ScoreExplainer } from './components/ScoreExplainer';
import { PersonaPickerSheet } from './components/PersonaPickerSheet';
import { isBackendAvailable, getIntelligence, getTCData, generateBuzzNow, type TCAccountSummary, type BuzzNowResponse } from './services/api';

type MainTab = 'brief' | 'summary' | 'advisor';

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [persona, setPersona] = useState<Attendee | null>(null);
  const [tab, setTab] = useState<MainTab>('brief');
  const [showScore, setShowScore] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [insightPopup, setInsightPopup] = useState<'now' | 'buzz' | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [tcData, setTcData] = useState<TCAccountSummary | null>(null);
  const [buzzNow, setBuzzNow] = useState<BuzzNowResponse | null>(null);
  const [buzzNowLoading, setBuzzNowLoading] = useState(false);

  // Check URL params for direct account selection (used by Chrome extension)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accountName = params.get('account');
    if (accountName) {
      // Try exact match first, then partial match
      const found = accounts.find(a => a.customer_name.toLowerCase() === accountName.toLowerCase()) ||
        accounts.find(a => a.customer_name.toLowerCase().includes(accountName.toLowerCase()) || accountName.toLowerCase().includes(a.customer_name.toLowerCase()));
      if (found) {
        setAccount(found);
      }
    }
  }, []);

  // When a live account is selected with empty intelligence, fetch from Bedrock
  useEffect(() => {
    if (!account) return;

    // Fetch T&C opportunity data
    if (isBackendAvailable()) {
      const sfdcId = account.sfdcAccountId;
      if (sfdcId) {
        getTCData(sfdcId).then(result => {
          if (result.summary) setTcData(result.summary);
        }).catch(() => {});
      } else {
        getTCData().then(result => {
          if (result.summaries) {
            const match = result.summaries.find(s =>
              s.accountName.toLowerCase().includes(account.customer_name.toLowerCase()) ||
              account.customer_name.toLowerCase().includes(s.accountName.toLowerCase())
            );
            if (match) setTcData(match);
          }
        }).catch(() => {});
      }
    }

    // Check if this account has real intelligence (more than just CSV-derived data)
    const hasRealIntel = account.public_intelligence.executive_social.length > 0 ||
      account.public_intelligence.linkedin_job_postings.cloud_ai_roles > 0 ||
      account.public_intelligence.glassdoor_signals.length > 0;

    if (!hasRealIntel && isBackendAvailable()) {
      setLoadingIntel(true);
      getIntelligence(
        account.customer_name,
        account.industry,
        account.aws_spend.current_year,
        account.ebc_data.attendees.map(a => `${a.name} (${a.title})`).join(', ')
      ).then(intel => {
        setAccount(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            public_intelligence: {
              earnings_call_signals: intel.earnings_call_signals && intel.earnings_call_signals.length > 0 ? intel.earnings_call_signals : prev.public_intelligence.earnings_call_signals,
              linkedin_job_postings: intel.linkedin_job_postings && intel.linkedin_job_postings.cloud_ai_roles > 0 ? intel.linkedin_job_postings : prev.public_intelligence.linkedin_job_postings,
              executive_social: intel.executive_social && intel.executive_social.length > 0 ? intel.executive_social : prev.public_intelligence.executive_social,
              glassdoor_signals: intel.glassdoor_signals && intel.glassdoor_signals.length > 0 ? intel.glassdoor_signals : prev.public_intelligence.glassdoor_signals,
              industry_context: intel.industry_context || prev.public_intelligence.industry_context,
              news_signals: intel.news_signals && intel.news_signals.length > 0 ? intel.news_signals : prev.public_intelligence.news_signals,
            },
            signals: intel.signals && intel.signals.length > 0 ? intel.signals : prev.signals,
            tc_opportunity_score: intel.tc_opportunity_score ? Math.min(10, intel.tc_opportunity_score) : prev.tc_opportunity_score,
            ebc_data: {
              ...prev.ebc_data,
              attendees: intel.executive_social && intel.executive_social.length > 0
                ? intel.executive_social.map(e => ({
                    name: e.name,
                    title: e.title,
                    persona: (e.title.toLowerCase().includes('ceo') || e.title.toLowerCase().includes('chief executive') ? 'CEO' :
                      e.title.toLowerCase().includes('cfo') || e.title.toLowerCase().includes('chief financial') ? 'CFO' :
                      e.title.toLowerCase().includes('cto') || e.title.toLowerCase().includes('chief technology') ? 'CTO' :
                      e.title.toLowerCase().includes('cio') || e.title.toLowerCase().includes('chief information') ? 'CIO' :
                      e.title.toLowerCase().includes('chro') || e.title.toLowerCase().includes('people') || e.title.toLowerCase().includes('human') ? 'CHRO' :
                      'Other') as 'CEO' | 'CFO' | 'CTO' | 'CIO' | 'CHRO' | 'Other',
                  }))
                : prev.ebc_data.attendees,
            },
          };
        });
      }).catch(err => {
        console.error('Failed to fetch intelligence:', err);
      }).finally(() => {
        setLoadingIntel(false);
      });
    }
  }, [account?.customer_name]);

  if (!account) return (
    <div className="min-h-screen bg-dark-900 flex justify-center">
      <div className="w-full max-w-[430px] md:max-w-[800px] lg:max-w-[1000px]">
        <AccountSelector accounts={accounts} onSelect={a => { setAccount(a); setTab('brief'); setBuzzNow(null); }} />
      </div>
    </div>
  );

  if (persona) return (
    <div className="min-h-screen bg-dark-900 flex justify-center">
      <div className="w-full max-w-[430px] md:max-w-[700px]">
        <header className="sticky top-0 z-50 bg-dark-800/90 backdrop-blur-md border-b border-dark-600 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setPersona(null)} className="p-1 active:opacity-70"><ArrowLeft className="w-5 h-5 text-muted" /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-white truncate">{persona.name}</h1>
            <p className="text-[11px] text-muted">{persona.title}</p>
          </div>
        </header>
        <PersonaView account={account} persona={persona} />
      </div>
    </div>
  );

  const tabs: { id: MainTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'brief', label: 'Brief', icon: FileText },
    { id: 'summary', label: 'Summary', icon: BookOpen },
    { id: 'advisor', label: 'Advisor', icon: Bot },
  ];

  return (
    <div className="min-h-screen bg-dark-900 flex justify-center">
      <div className="w-full max-w-[430px] md:max-w-[700px] pb-16 relative">
        {showScore && <ScoreExplainer account={account} onClose={() => setShowScore(false)} />}
        {showPersonaPicker && (
          <PersonaPickerSheet account={account} onSelect={(att) => { setShowPersonaPicker(false); setPersona(att); }} onClose={() => setShowPersonaPicker(false)} />
        )}

        {/* Header */}
        <header className="sticky top-0 z-50 bg-dark-800/90 backdrop-blur-md border-b border-dark-600">
          <div className="px-4 py-2.5 flex items-center gap-2">
            <button onClick={() => { setAccount(null); setTab('brief'); }} className="p-1 active:opacity-70">
              <ArrowLeft className="w-5 h-5 text-muted" />
            </button>
            <img src="/aws-logo.svg" alt="AWS" className="h-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-xs font-semibold text-white truncate">{account.customer_name}</h1>
              <p className="text-[10px] text-muted">{account.industry} · {account.segment} · {account.geo}</p>
            </div>
            <button onClick={() => setShowScore(true)} className="flex flex-col items-center active:opacity-80">
              <div className={`w-8 h-8 rounded-xl ${account.tc_opportunity_score >= 8 ? 'bg-green-500' : account.tc_opportunity_score >= 6 ? 'bg-orange-500' : 'bg-blue-500'} flex items-center justify-center text-white font-bold text-sm`}>
                {account.tc_opportunity_score}
              </div>
              <span className="text-[8px] text-muted mt-0.5">Score</span>
            </button>
          </div>
          {/* EBC info bar */}
          {account.ebc_data.meeting_dates[0] && (() => {
            const ebcDate = new Date(account.ebc_data.meeting_dates[0]);
            const daysUntil = Math.ceil((ebcDate.getTime() - Date.now()) / 86400000);
            return (
              <div className="px-4 py-1.5 flex items-center gap-3 text-[10px] text-muted border-t border-dark-700 flex-wrap">
                <span className="text-blue-400">📅 {ebcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span>{daysUntil > 0 ? `in ${daysUntil} days` : daysUntil === 0 ? 'Today' : `${Math.abs(daysUntil)}d ago`}</span>
                <span>📍 {account.ebc_data.location}</span>
                {account.ebc_data.status && <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${account.ebc_data.status === 'InProgress' ? 'bg-blue-500/15 text-blue-400' : 'bg-green-500/15 text-green-400'}`}>{account.ebc_data.status}</span>}
              </div>
            );
          })()}
          {/* Signal badges */}
          {account.signals.length > 0 && (
            <div className="px-4 py-1.5 flex flex-wrap gap-1.5 border-t border-dark-700">
              {account.signals.slice(0, 3).map(s => (
                <span key={s.label} className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${s.severity === 'HIGH' ? 'bg-red-500/15 text-red-400' : 'bg-orange-500/15 text-orange-400'}`}>{s.label}</span>
              ))}
            </div>
          )}
          {/* Now & Buzz bar — inside the sticky header */}
          <div className="flex border-t border-dark-600">
            {loadingIntel && (
              <div className="absolute top-full left-0 right-0 flex items-center justify-center gap-2 py-1.5 bg-blue-500/10 border-b border-blue-500/20 z-10">
                <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                <span className="text-[10px] text-blue-400">Researching {account.customer_name}...</span>
              </div>
            )}
            <button onClick={() => { setInsightPopup(insightPopup === 'now' ? null : 'now'); if (!buzzNow && !buzzNowLoading && account && isBackendAvailable()) { setBuzzNowLoading(true); generateBuzzNow(account, tcData).then(r => setBuzzNow(r)).catch(() => {}).finally(() => setBuzzNowLoading(false)); } }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 ${insightPopup === 'now' ? 'text-blue-400' : 'text-muted'}`}>
              <Zap className="w-4 h-4" />
              <span className="text-[9px] font-medium">Now</span>
            </button>
            <button onClick={() => { setInsightPopup(insightPopup === 'buzz' ? null : 'buzz'); if (!buzzNow && !buzzNowLoading && account && isBackendAvailable()) { setBuzzNowLoading(true); generateBuzzNow(account, tcData).then(r => setBuzzNow(r)).catch(() => {}).finally(() => setBuzzNowLoading(false)); } }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 ${insightPopup === 'buzz' ? 'text-orange-400' : 'text-muted'}`}>
              <Megaphone className="w-4 h-4" />
              <span className="text-[9px] font-medium">Buzz</span>
            </button>
          </div>
        </header>

        {/* Insight popup — Now / Buzz */}
        {insightPopup && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm" onClick={() => setInsightPopup(null)}>
            <div className="bg-dark-800 border border-dark-600 rounded-b-2xl w-full max-w-[430px] md:max-w-[700px] max-h-[70vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-white">{insightPopup === 'now' ? '⚡ What to focus on now' : '📢 What people are saying'}</h3>
                <button onClick={() => setInsightPopup(null)} className="p-2 rounded-lg active:bg-dark-700"><span className="text-muted text-lg">✕</span></button>
              </div>
              <div className="px-5 pb-5">
                {insightPopup === 'now' && (
                  <div className="space-y-3">
                    {buzzNowLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        <span>Searching online & analyzing signals...</span>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-semibold text-muted uppercase">Focus</span>
                      <p className="text-sm text-slate-200 pl-3 border-l-2 border-blue-500/30 mt-1.5">
                        {buzzNow?.now_focus || account.sfdc_data.account_plan_priority}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted uppercase">Initiatives to drive</span>
                      <div className="space-y-1.5 mt-1.5">
                        {(buzzNow?.now_initiatives || account.signals.filter(s => s.severity === 'HIGH').map(s => `${s.label}: ${s.evidence.split(';')[0]}`)).map((item, i) => (
                          <div key={i} className="flex items-start gap-2"><span className="mt-1 w-2 h-2 rounded-full bg-blue-400 shrink-0" /><p className="text-xs text-slate-300">{item}</p></div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted uppercase">Ask right now</span>
                      <div className="space-y-1 mt-1.5">
                        {(buzzNow?.now_key_asks || [
                          `What's driving the urgency on ${account.sfdc_data.account_plan_priority}?`,
                          'Who on your leadership team is championing workforce development?',
                          'Where are the skills gaps slowing down delivery right now?',
                        ]).map((ask, i) => (
                          <p key={i} className="text-xs text-slate-300">→ {ask}</p>
                        ))}
                      </div>
                    </div>
                    {buzzNow?.now_opening_move && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <span className="text-[10px] font-semibold text-blue-400 uppercase">💡 Your opening move</span>
                        <p className="text-xs text-slate-300 mt-1">{buzzNow.now_opening_move}</p>
                      </div>
                    )}
                  </div>
                )}
                {insightPopup === 'buzz' && (
                  <div className="space-y-3">
                    {buzzNowLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                        <span>Searching LinkedIn, Glassdoor, news & analyzing...</span>
                      </div>
                    )}
                    {/* AI Summary */}
                    {buzzNow?.buzz_summary && (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3.5">
                        <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Signal Synthesis</span>
                        <p className="text-xs text-slate-200 mt-1.5">{buzzNow.buzz_summary}</p>
                      </div>
                    )}
                    {/* AI Executive Insights */}
                    <div>
                      <span className="text-xs font-semibold text-muted uppercase">Executive voices</span>
                      <div className="space-y-2 mt-1.5">
                        {buzzNow?.buzz_executive_insights ? (
                          buzzNow.buzz_executive_insights.map((insight, i) => (
                            <p key={i} className="text-xs text-slate-300 pl-2.5 border-l-2 border-purple-500/30">{insight}</p>
                          ))
                        ) : (
                          account.public_intelligence.executive_social.map(e => (
                            <div key={e.name} className="flex items-start gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-dark-700 flex items-center justify-center text-[9px] text-slate-300 font-bold shrink-0">{e.name.split(' ').map(w => w[0]).join('')}</div>
                              <div>
                                <span className="text-xs font-medium text-white">{e.name}</span>
                                <span className="text-[10px] text-muted ml-1">{e.title}</span>
                                <p className="text-xs text-blue-400 italic mt-0.5">"{e.post_theme}"</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    {/* AI Hiring Analysis */}
                    <div className="pt-3 border-t border-dark-600">
                      <span className="text-xs font-semibold text-muted uppercase">Hiring & Skills Gap</span>
                      <div className="flex items-center gap-3 mt-1"><span className="text-xl font-bold text-white">{account.public_intelligence.linkedin_job_postings.cloud_ai_roles}</span><span className="text-xs text-muted">cloud/AI roles</span><span className="text-xs text-green-400">{account.public_intelligence.linkedin_job_postings.yoy_change} YoY</span></div>
                      {buzzNow?.buzz_hiring_analysis && <p className="text-xs text-slate-300 mt-1.5">{buzzNow.buzz_hiring_analysis}</p>}
                    </div>
                    {/* AI Sentiment */}
                    <div className="pt-3 border-t border-dark-600">
                      <span className="text-xs font-semibold text-muted uppercase">Employee Sentiment</span>
                      {buzzNow?.buzz_sentiment_analysis ? (
                        <p className="text-xs text-slate-300 mt-1.5">{buzzNow.buzz_sentiment_analysis}</p>
                      ) : (
                        account.public_intelligence.glassdoor_signals.map((s, i) => (<p key={i} className="text-xs text-slate-300 pl-2.5 border-l-2 border-dark-600 mt-1.5">"{s}"</p>))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="px-4 py-4">
          {tab === 'brief' && <ExecBrief account={account} onEngagePersona={() => setShowPersonaPicker(true)} tcData={tcData} />}
          {tab === 'summary' && <SummaryView account={account} />}
          {tab === 'advisor' && <AdvisorChat account={account} tcData={tcData} />}
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:max-w-[700px] bg-dark-800/95 backdrop-blur-md border-t border-dark-600 z-50">
          <div className="flex">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 ${tab === t.id ? 'text-purple-500' : 'text-muted'}`}>
                <t.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>

      </div>
    </div>
  );
}
