import { useState } from 'react';
import { ArrowLeft, FileText, BarChart3, Bot, Sparkles } from 'lucide-react';
import type { Account, Attendee } from './types';
import { accounts } from './data/accounts';
import { AccountSelector } from './components/AccountSelector';
import { ExecBrief } from './components/ExecBrief';
import { AccountData } from './components/AccountData';
import { AdvisorChat } from './components/AdvisorChat';
import { PersonaView } from './components/PersonaView';
import { ScoreExplainer } from './components/ScoreExplainer';

type MainTab = 'brief' | 'data' | 'advisor' | 'ask-ai';

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [persona, setPersona] = useState<Attendee | null>(null);
  const [tab, setTab] = useState<MainTab>('brief');
  const [showScore, setShowScore] = useState(false);

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
    { id: 'data', label: 'Data', icon: BarChart3 },
    { id: 'advisor', label: 'Advisor', icon: Bot },
    { id: 'ask-ai', label: 'Ask AI', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-dark-900 flex justify-center">
      <div className="w-full max-w-[430px] pb-16 relative">
        {showScore && <ScoreExplainer account={account} onClose={() => setShowScore(false)} />}

        {/* Header */}
        <header className="sticky top-0 z-50 bg-dark-800/90 backdrop-blur-md border-b border-dark-600 px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setAccount(null); setTab('brief'); }} className="p-1 active:opacity-70">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-white truncate">{account.customer_name}</h1>
            <p className="text-[11px] text-muted">{account.industry} · {account.segment}</p>
          </div>
          <button onClick={() => setShowScore(true)} className="flex flex-col items-center active:opacity-80">
            <div className={`w-9 h-9 rounded-xl ${account.tc_opportunity_score >= 8 ? 'bg-green-500' : account.tc_opportunity_score >= 6 ? 'bg-orange-500' : 'bg-blue-500'} flex items-center justify-center text-white font-bold text-sm`}>
              {account.tc_opportunity_score}
            </div>
            <span className="text-[9px] text-muted mt-0.5">AWS Score</span>
          </button>
        </header>

        {/* Content */}
        <main className="px-4 py-4">
          {tab === 'brief' && <ExecBrief account={account} onSelectPersona={setPersona} />}
          {tab === 'data' && <AccountData account={account} />}
          {tab === 'advisor' && <AdvisorChat account={account} />}
          {tab === 'ask-ai' && <AdvisorChat account={account} />}
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

        {/* Stats bar */}
        <div className="fixed bottom-[52px] left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-dark-900 border-t border-dark-700 flex items-center justify-center gap-8 py-1.5 z-40">
          <div className="flex items-center gap-1.5">
            <span className="text-purple-500 font-bold text-sm">3 min</span>
            <span className="text-[10px] text-muted">Prep Time</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-green-500 font-bold text-sm">87%</span>
            <span className="text-[10px] text-muted">Win Rate Lift</span>
          </div>
        </div>
      </div>
    </div>
  );
}
