import { X, ExternalLink } from 'lucide-react';
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

// Generate a deterministic avatar URL using UI Avatars (no external photos needed)
function avatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a2a4a&color=e2e8f0&size=96&font-size=0.35&bold=true`;
}

// Generate a LinkedIn search URL for the persona
function linkedinUrl(name: string, company: string) {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name + ' ' + company)}`;
}

export function PersonaPickerSheet({ account, onSelect, onClose }: {
  account: Account;
  onSelect: (a: Attendee) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-navy-800 border-b border-navy-600 rounded-b-2xl w-full max-w-[430px] max-h-[85vh] overflow-y-auto animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-navy-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <div>
            <h3 className="text-base font-semibold text-white">Select a Persona</h3>
            <p className="text-xs text-slate-400">EBC: {account.ebc_data.meeting_dates[0]} · {account.ebc_data.location}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg active:bg-navy-700" aria-label="Close">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Persona List */}
        <div className="px-4 pb-6 space-y-2">
          {account.ebc_data.attendees.map(att => {
            const key = `${account.customer_name}::${att.persona}`;
            const hasPlan = !!engagementPlans[key];
            const social = account.public_intelligence.executive_social.find(e => e.name === att.name);
            const gradient = personaColors[att.persona] || personaColors.Other;

            return (
              <button
                key={att.name}
                onClick={() => onSelect(att)}
                className="w-full flex items-center gap-3 p-3.5 bg-navy-900/50 border border-navy-600 rounded-xl active:bg-navy-700 transition-all text-left"
                aria-label={`Select ${att.name}`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <img
                    src={avatarUrl(att.name)}
                    alt={att.name}
                    className="w-12 h-12 rounded-xl object-cover"
                    loading="lazy"
                  />
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[8px] font-bold`}>
                    {att.persona === 'Other' ? '...' : att.persona.slice(0, 2)}
                  </div>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{att.name}</span>
                    {hasPlan && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full shrink-0">Ready</span>}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{att.title}</div>
                  {social && (
                    <p className="text-[11px] text-sky-400 mt-0.5 italic truncate">"{social.post_theme}"</p>
                  )}
                </div>

                {/* LinkedIn link */}
                <a
                  href={linkedinUrl(att.name, account.customer_name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="p-2 rounded-lg active:bg-navy-600 shrink-0"
                  aria-label={`View ${att.name} on LinkedIn`}
                >
                  <ExternalLink className="w-4 h-4 text-slate-500" />
                </a>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
