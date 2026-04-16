import { useState } from 'react';
import { MessageCircle, Lightbulb, DollarSign, Award, Copy, Check } from 'lucide-react';
import type { Account, Attendee, EngagementPlan } from '../types';

const personaGradients: Record<string, string> = {
  CEO: 'from-amber-500 to-orange-500',
  CFO: 'from-emerald-500 to-teal-500',
  CIO: 'from-sky-500 to-blue-500',
  CTO: 'from-violet-500 to-purple-500',
  CHRO: 'from-rose-500 to-pink-500',
  Other: 'from-slate-500 to-gray-500',
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-2 rounded-lg active:bg-navy-600 transition-colors"
      aria-label="Copy"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-500" />}
    </button>
  );
}

export function PersonaStory({ account, persona, plan }: { account: Account; persona: Attendee; plan: EngagementPlan }) {
  const gradient = personaGradients[persona.persona] || personaGradients.Other;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Persona Hero */}
      <div className={`bg-gradient-to-r ${gradient} p-[1px] rounded-xl`}>
        <div className="bg-navy-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold shrink-0`}>
              {persona.persona}
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-white">{plan.persona_name}</div>
              <div className="text-xs text-slate-400">{plan.persona_title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{account.industry} · EBC {account.ebc_data.meeting_dates[0]}</div>
            </div>
          </div>
        </div>
      </div>

      {/* The Narrative */}
      <section>
        <p className="text-slate-200 leading-relaxed text-[15px]">{plan.narrative}</p>
      </section>

      {/* Conversation Starters */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Conversation Starters</span>
        </div>
        <div className="space-y-2.5">
          {plan.conversation_starters.map((starter, i) => (
            <div key={i} className="bg-navy-800 border border-navy-600 rounded-xl p-3.5">
              <div className="flex items-start gap-2.5">
                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5`}>
                  {i + 1}
                </div>
                <p className="text-sm text-slate-200 leading-relaxed flex-1">"{starter}"</p>
                <CopyBtn text={starter} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recommended Plays */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recommended Approach</span>
        </div>
        <div className="space-y-2.5">
          {plan.recommended_plays.map((play, i) => (
            <div key={i} className="bg-navy-800 border border-navy-600 rounded-xl p-3.5">
              <div className="text-sm font-medium text-white mb-1">{play.play_name}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{play.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Revenue */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Revenue Opportunity</span>
          </div>
          <span className="text-sm font-semibold text-emerald-400">{plan.total_pipeline}</span>
        </div>
        <div className="space-y-2">
          {plan.revenue_estimate.map((item, i) => (
            <div key={i} className="bg-navy-800 border border-navy-600 rounded-xl p-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-200 truncate">{item.offering}</div>
                <div className="text-xs text-slate-500">{item.timeline}</div>
              </div>
              <span className="text-sm text-emerald-400 font-medium shrink-0 ml-3">{item.estimated_value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Proof Points */}
      <section className="pb-6">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Proof Points</span>
        </div>
        <div className="space-y-2.5">
          {plan.proof_points.map((pp, i) => (
            <div key={i} className="bg-navy-800 border border-navy-600 rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-white">{pp.customer}</span>
                <span className="text-[11px] text-slate-500">{pp.industry}</span>
              </div>
              <div className="text-base font-bold text-amber-400">{pp.metric}</div>
              <p className="text-xs text-slate-400 mt-0.5">{pp.demonstrates}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
