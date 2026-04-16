import type { Account, Attendee } from '../types';
import { engagementPlans } from '../data/engagementPlans';

const personaColors: Record<string, string> = {
  CEO: 'from-amber-500 to-orange-500',
  CFO: 'from-emerald-500 to-teal-500',
  CIO: 'from-sky-500 to-blue-500',
  CTO: 'from-violet-500 to-purple-500',
  CHRO: 'from-rose-500 to-pink-500',
  Other: 'from-slate-500 to-gray-500',
};

export function PersonaSelector({ account, onSelect }: { account: Account; onSelect: (a: Attendee) => void }) {
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <p className="text-sm text-slate-400 mb-4">Select an executive to build a tailored engagement story, pitch, and agenda.</p>
      <div className="space-y-3">
        {account.ebc_data.attendees.map(att => {
          const key = `${account.customer_name}::${att.persona}`;
          const hasPlan = !!engagementPlans[key];
          const social = account.public_intelligence.executive_social.find(e => e.name === att.name);

          return (
            <button
              key={att.name}
              onClick={() => onSelect(att)}
              className="w-full flex items-start gap-3 p-4 bg-navy-800 border border-navy-600 rounded-xl active:bg-navy-700 transition-all text-left"
              aria-label={`Select ${att.name}`}
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${personaColors[att.persona] || personaColors.Other} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                {att.persona === 'Other' ? att.title.split(' ').map(w => w[0]).join('').slice(0, 3) : att.persona}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{att.name}</div>
                <div className="text-xs text-slate-400">{att.title}</div>
                {social && (
                  <p className="text-xs text-sky-400 mt-1 italic truncate">"{social.post_theme}"</p>
                )}
                {!hasPlan && (
                  <span className="text-[10px] text-slate-500 mt-1 inline-block">Engagement plan available with Bedrock</span>
                )}
              </div>
              {hasPlan && (
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full shrink-0 mt-1">Ready</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
