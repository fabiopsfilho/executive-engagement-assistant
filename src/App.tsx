import { useState } from 'react';
import { ArrowLeft, FileText, BookOpen, Bot, Zap, Megaphone } from 'lucide-react';
import type { Account, Attendee } from './types';
import { accounts } from './data/accounts';
import { AccountSelector } from './components/AccountSelector';
import { ExecBrief } from './components/ExecBrief';
import { SummaryView } from './components/SummaryView';
import { AdvisorChat } from './components/AdvisorChat';
import { PersonaView } from './components/PersonaView';
import { ScoreExplainer } from './components/ScoreExplainer';
import { PersonaPickerSheet } from './components/PersonaPickerSheet';

type MainTab = 'brief' | 'summary' | 'advisor';

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [persona, setPersona] = useState<Attendee | null>(null);
  const [tab, setTab] = useState<MainTab>('brief');
  const [showScore, setShowScore] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [insightPopup, setInsightPopup] = useState<'now' | 'buzz' | null>(null);

  if (!account) return (
    <div className="min-h-screen bg-dark-900 flex justify-center">
      <div className="w-full max-w-[430px]">
        <AccountSelector accounts={accounts} onSelect={a => { setAccount(a); setTab('brief'); }} />
      </div>
    </div>
  );

  if (persona) return (
    <div className="min-h-screen bg-dark-900 flex justify-center">
      <div className="w-full max-w-[430px]">
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
      <div className="w-full max-w-[430px] pb-16 relative">
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
              <p className="text-[10px] text-muted">{account.industry} · {account.segment}</p>
            </div>
            <button onClick={() => setShowScore(true)} className="flex flex-col items-center active:opacity-80">
              <div className={`w-8 h-8 rounded-xl ${account.tc_opportunity_score >= 8 ? 'bg-green-500' : account.tc_opportunity_score >= 6 ? 'bg-orange-500' : 'bg-blue-500'} flex items-center justify-center text-white font-bold text-sm`}>
                {account.tc_opportunity_score}
              </div>
              <span className="text-[8px] text-muted mt-0.5">Score</span>
            </button>
          </div>
          {/* Now & Buzz bar — inside the sticky header */}
          <div className="flex border-t border-dark-600">
            <button onClick={() => setInsightPopup(insightPopup === 'now' ? null : 'now')}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 ${insightPopup === 'now' ? 'text-blue-400' : 'text-muted'}`}>
              <Zap className="w-4 h-4" />
              <span className="text-[9px] font-medium">Now</span>
            </button>
            <button onClick={() => setInsightPopup(insightPopup === 'buzz' ? null : 'buzz')}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 ${insightPopup === 'buzz' ? 'text-orange-400' : 'text-muted'}`}>
              <Megaphone className="w-4 h-4" />
              <span className="text-[9px] font-medium">Buzz</span>
            </button>
          </div>
        </header>

        {/* Insight popup — Now / Buzz */}
        {insightPopup && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm" onClick={() => setInsightPopup(null)}>
            <div className="bg-dark-800 border border-dark-600 rounded-b-2xl w-full max-w-[430px] max-h-[70vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-white">{insightPopup === 'now' ? '⚡ What to focus on now' : '📢 What people are saying'}</h3>
                <button onClick={() => setInsightPopup(null)} className="p-2 rounded-lg active:bg-dark-700"><span className="text-muted text-lg">✕</span></button>
              </div>
              <div className="px-5 pb-5">
                {insightPopup === 'now' && (
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-semibold text-muted uppercase">Trends</span>
                      <p className="text-sm text-slate-300 pl-3 border-l-2 border-blue-500/30 mt-1.5">{account.public_intelligence.industry_context}</p>
                      {account.public_intelligence.news_signals.map((s, i) => (<p key={i} className="text-xs text-muted pl-3 border-l-2 border-dark-600 mt-1.5">{s}</p>))}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted uppercase">Focus</span>
                      <div className="bg-dark-700 rounded-lg p-3 mt-1.5"><span className="text-sm font-medium text-white">{account.sfdc_data.account_plan_priority}</span></div>
                      {account.signals.filter(s => s.severity === 'HIGH').map(s => (
                        <div key={s.label} className="flex items-start gap-2 mt-2"><span className="mt-1 w-2 h-2 rounded-full bg-red-400 shrink-0" /><div><span className="text-xs text-white font-medium">{s.label}</span><p className="text-[11px] text-muted">{s.evidence.split(';')[0]}</p></div></div>
                      ))}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted uppercase">Ask right now</span>
                      <p className="text-xs text-slate-300 mt-1">→ Who is the executive sponsor?</p>
                      <p className="text-xs text-slate-300 mt-1">→ Timeline pressure on {account.sfdc_data.account_plan_priority}?</p>
                      <p className="text-xs text-slate-300 mt-1">→ {!account.tc_current_state.skill_builder ? 'Which teams are most critical?' : 'Why has training stalled?'}</p>
                    </div>
                  </div>
                )}
                {insightPopup === 'buzz' && (
                  <div className="space-y-3">
                    {/* Common Themes — what connects what people are saying */}
                    {(() => {
                      const allText = [
                        ...account.public_intelligence.executive_social.map(e => e.post_theme),
                        ...account.public_intelligence.glassdoor_signals,
                        ...account.public_intelligence.earnings_call_signals,
                      ].join(' ').toLowerCase();
                      const themes: { label: string; found: boolean }[] = [
                        { label: 'Workforce & talent gaps', found: allText.includes('talent') || allText.includes('workforce') || allText.includes('hiring') || allText.includes('skill') },
                        { label: 'AI & cloud transformation', found: allText.includes('ai') || allText.includes('cloud') || allText.includes('genai') || allText.includes('digital') },
                        { label: 'Training & development needs', found: allText.includes('training') || allText.includes('learning') || allText.includes('upskill') || allText.includes('development') },
                        { label: 'ROI & investment pressure', found: allText.includes('roi') || allText.includes('invest') || allText.includes('cost') || allText.includes('budget') || allText.includes('board') },
                        { label: 'Retention & culture', found: allText.includes('retention') || allText.includes('culture') || allText.includes('losing') || allText.includes('growth opportunities') },
                        { label: 'Compliance & regulation', found: allText.includes('compliance') || allText.includes('regulation') || allText.includes('hipaa') || allText.includes('ai act') },
                      ];
                      const active = themes.filter(t => t.found);
                      return active.length > 0 ? (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3.5">
                          <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Common Themes</span>
                          <p className="text-xs text-slate-300 mt-1.5">Across executive posts, employee feedback, and earnings calls, the recurring themes are:</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {active.map(t => (
                              <span key={t.label} className="text-[11px] px-2.5 py-1 bg-purple-500/15 text-purple-400 rounded-full font-medium">{t.label}</span>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Executive voices */}
                    <div>
                      <span className="text-xs font-semibold text-muted uppercase">Executive voices</span>
                    </div>
                    {account.public_intelligence.executive_social.map(e => (
                      <div key={e.name} className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-dark-700 flex items-center justify-center text-[9px] text-slate-300 font-bold shrink-0">{e.name.split(' ').map(w => w[0]).join('')}</div>
                        <div><span className="text-xs font-medium text-white">{e.name}</span><span className="text-[10px] text-muted ml-1">{e.title}</span><p className="text-xs text-blue-400 italic mt-0.5">"{e.post_theme}"</p></div>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-dark-600">
                      <span className="text-xs font-semibold text-muted uppercase">LinkedIn hiring</span>
                      <div className="flex items-center gap-3 mt-1"><span className="text-xl font-bold text-white">{account.public_intelligence.linkedin_job_postings.cloud_ai_roles}</span><span className="text-xs text-muted">cloud/AI roles</span><span className="text-xs text-green-400">{account.public_intelligence.linkedin_job_postings.yoy_change} YoY</span></div>
                    </div>
                    <div className="pt-3 border-t border-dark-600">
                      <span className="text-xs font-semibold text-muted uppercase">Glassdoor</span>
                      {account.public_intelligence.glassdoor_signals.map((s, i) => (<p key={i} className="text-xs text-slate-300 pl-2.5 border-l-2 border-dark-600 mt-1.5">"{s}"</p>))}
                    </div>
                    <div className="pt-3 border-t border-dark-600">
                      <span className="text-xs font-semibold text-muted uppercase">Earnings</span>
                      {account.public_intelligence.earnings_call_signals.map((s, i) => (<p key={i} className="text-xs text-slate-300 pl-2.5 border-l-2 border-dark-600 mt-1.5">{s}</p>))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="px-4 py-4">
          {tab === 'brief' && <ExecBrief account={account} onEngagePersona={() => setShowPersonaPicker(true)} />}
          {tab === 'summary' && <SummaryView account={account} />}
          {tab === 'advisor' && <AdvisorChat account={account} />}
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-dark-800/95 backdrop-blur-md border-t border-dark-600 z-50">
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
