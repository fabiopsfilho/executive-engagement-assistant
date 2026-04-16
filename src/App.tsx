import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Account, Attendee } from './types';
import { accounts } from './data/accounts';
import { AccountSelector } from './components/AccountSelector';
import { AccountView } from './components/AccountView';
import { PersonaView } from './components/PersonaView';
import { ScoreExplainer } from './components/ScoreExplainer';
import { PersonaPickerSheet } from './components/PersonaPickerSheet';

export default function App() {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Attendee | null>(null);
  const [showScoreExplainer, setShowScoreExplainer] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);

  return (
    <div className="min-h-screen bg-navy-900 flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-navy-900 relative">
        {showScoreExplainer && selectedAccount && (
          <ScoreExplainer account={selectedAccount} onClose={() => setShowScoreExplainer(false)} />
        )}
        {showPersonaPicker && selectedAccount && (
          <PersonaPickerSheet
            account={selectedAccount}
            onSelect={(att) => { setShowPersonaPicker(false); setSelectedPersona(att); }}
            onClose={() => setShowPersonaPicker(false)}
          />
        )}

        {/* Header */}
        <header className="border-b border-navy-700 bg-navy-800/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="px-4 py-3 flex items-center gap-3">
            {selectedAccount && (
              <button
                onClick={() => { if (selectedPersona) setSelectedPersona(null); else setSelectedAccount(null); }}
                className="p-1.5 rounded-lg active:bg-navy-700"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
            )}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-navy-900 font-bold text-xs shrink-0">
                T&C
              </div>
              <div className="min-w-0">
                {!selectedAccount ? (
                  <>
                    <h1 className="text-sm font-semibold text-white leading-tight">Executive Engagement</h1>
                    <p className="text-[11px] text-slate-400">AWS Training & Certification</p>
                  </>
                ) : !selectedPersona ? (
                  <>
                    <h1 className="text-sm font-semibold text-white leading-tight truncate">{selectedAccount.customer_name}</h1>
                    <p className="text-[11px] text-slate-400">{selectedAccount.industry} · {selectedAccount.segment}</p>
                  </>
                ) : (
                  <>
                    <h1 className="text-sm font-semibold text-white leading-tight truncate">{selectedPersona.name}</h1>
                    <p className="text-[11px] text-slate-400 truncate">{selectedPersona.title}</p>
                  </>
                )}
              </div>
            </div>
            {selectedAccount && (
              <button onClick={() => setShowScoreExplainer(true)} className="flex flex-col items-center shrink-0 active:opacity-80" aria-label="AWS Score">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${selectedAccount.tc_opportunity_score >= 8 ? 'from-rose-500 to-orange-500' : selectedAccount.tc_opportunity_score >= 6 ? 'from-amber-500 to-yellow-500' : 'from-sky-500 to-cyan-500'} flex items-center justify-center text-white font-bold text-sm`}>
                  {selectedAccount.tc_opportunity_score}
                </div>
                <span className="text-[9px] text-slate-500 mt-0.5">AWS Score</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main>
          {!selectedAccount ? (
            <AccountSelector accounts={accounts} onSelect={setSelectedAccount} />
          ) : !selectedPersona ? (
            <AccountView account={selectedAccount} onEngagePersona={() => setShowPersonaPicker(true)} />
          ) : (
            <PersonaView account={selectedAccount} persona={selectedPersona} />
          )}
        </main>
      </div>
    </div>
  );
}
