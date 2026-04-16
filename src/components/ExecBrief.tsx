import { useState } from 'react';
import { ChevronRight, Copy, Check, Sparkles, ArrowRight, Globe } from 'lucide-react';
import type { Account, Attendee } from '../types';
import { engagementPlans } from '../data/engagementPlans';
import { generateAgenda, generateTrainingSessionAgenda } from '../data/agendas';
import { AgendaModal } from './AgendaModal';

const personaGradients: Record<string, string> = {
  CEO: 'from-orange-500 to-red-500',
  CFO: 'from-green-500 to-emerald-500',
  CIO: 'from-blue-500 to-cyan-500',
  CTO: 'from-purple-500 to-violet-500',
  CHRO: 'from-pink-500 to-rose-500',
  Other: 'from-slate-500 to-gray-500',
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-dark-600 text-sm text-white active:bg-dark-700">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function ExecBrief({ account, onSelectPersona }: { account: Account; onSelectPersona: (a: Attendee) => void }) {
  const a = account;
  const [showAgenda, setShowAgenda] = useState<'ebc' | 'training' | null>(null);

  // Determine primary play
  const topSignal = a.signals[0];
  const primaryPlay = topSignal?.label.includes('Talent') ? 'AI Talent Gap' : topSignal?.label.includes('Compliance') ? 'Compliance Readiness' : topSignal?.label.includes('Subscription') ? 'Engagement Revival' : 'Workforce Transformation';
  const primaryArrow = topSignal?.label.includes('Talent') ? 'Workforce Transformation' : topSignal?.label.includes('Compliance') ? 'Regulatory Advantage' : 'Strategic Partnership';

  // Rank personas by signal strength
  const rankedPersonas = a.ebc_data.attendees
    .filter(att => ['CEO', 'CFO', 'CTO', 'CIO', 'CHRO'].includes(att.persona))
    .sort((x, y) => {
      const order = ['CHRO', 'CTO', 'CIO', 'CEO', 'CFO'];
      return order.indexOf(x.persona) - order.indexOf(y.persona);
    })
    .slice(0, 3);

  // Best conversation starter
  const plan0 = engagementPlans[`${a.customer_name}::${rankedPersonas[0]?.persona}`];
  const bestStarter = plan0?.conversation_starters[0] || `How are you planning to close your ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} AI talent gaps in the next 12–18 months?`;

  // Follow-ups
  const followUps = [
    `Are ${a.industry === 'Financial Services' ? 'GenAI' : 'cloud'} skills part of your hiring strategy?`,
    `Build vs. buy vs. train — what's the plan?`,
    `Where are you seeing the biggest delays?`,
  ];

  const personaTags: Record<string, string[]> = {
    CHRO: ['Talent Gap', 'Workforce Strategy'],
    CTO: ['AI Readiness', 'Cloud & GenAI'],
    CIO: ['Migration Skills', 'Delivery Speed'],
    CEO: ['Strategic Risk', 'Competitive Advantage'],
    CFO: ['ROI & Investment', 'Build vs. Buy'],
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {showAgenda === 'ebc' && <AgendaModal agenda={generateAgenda(a)} onClose={() => setShowAgenda(null)} />}
      {showAgenda === 'training' && <AgendaModal agenda={generateTrainingSessionAgenda(a)} onClose={() => setShowAgenda(null)} />}

      {/* Title */}
      <h2 className="text-xl font-bold text-white">Exec Brief</h2>

      {/* Hero Card — Primary Play */}
      <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/10 border border-purple-500/30 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Primary Play</span>
        </div>
        <h3 className="text-2xl font-bold text-white mb-1">{primaryPlay}</h3>
        <p className="text-sm text-muted flex items-center gap-1.5">→ {primaryArrow}</p>
        <div className="flex items-center gap-2 mt-4">
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 font-medium">High Confidence</span>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 font-medium">Immediate Action</span>
        </div>
      </div>

      {/* Talk to First */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Talk to First</h3>
          <span className="text-[11px] text-purple-400">Why this order?</span>
        </div>
        <div className="space-y-2">
          {rankedPersonas.map((att, i) => {
            const gradient = personaGradients[att.persona] || personaGradients.Other;
            const tags = personaTags[att.persona] || ['Engagement'];
            return (
              <button key={att.name} onClick={() => onSelectPersona(att)}
                className="w-full flex items-center gap-3 p-3 bg-dark-800 border border-dark-600 rounded-xl active:bg-dark-700 text-left">
                <div className="relative">
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold`}>
                    {att.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{att.name}</div>
                  <div className="text-[11px] text-muted">{att.persona}</div>
                  <div className="flex gap-1.5 mt-1">
                    {tags.map(t => (
                      <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        t.includes('Talent') || t.includes('Risk') ? 'bg-orange-500/15 text-orange-400' :
                        t.includes('AI') || t.includes('Cloud') || t.includes('Migration') ? 'bg-blue-500/15 text-blue-400' :
                        t.includes('ROI') || t.includes('Build') ? 'bg-green-500/15 text-green-400' :
                        'bg-purple-500/15 text-purple-400'
                      }`}>{t}</span>
                    ))}
                  </div>
                  {i === 0 && <span className="text-[10px] text-muted mt-1 block">Strongest entry point</span>}
                </div>
                <ChevronRight className="w-4 h-4 text-muted shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Say This */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Say This</h3>
          <span className="text-[11px] text-purple-400">See more angles</span>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <p className="text-base text-white font-medium leading-relaxed mb-4">
            {bestStarter.length > 120 ? bestStarter.slice(0, 120) + '...' : bestStarter}
          </p>
          <div className="flex gap-2">
            <CopyBtn text={bestStarter} />
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-500 text-sm text-white font-medium active:bg-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
              Improve with AI
            </button>
          </div>
        </div>
      </div>

      {/* Follow-ups */}
      <div>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Follow-ups</h3>
        <ul className="space-y-1.5">
          {followUps.map((f, i) => (
            <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
              <span className="text-muted mt-0.5">•</span>{f}
            </li>
          ))}
        </ul>
      </div>

      {/* Next Best Move */}
      <div>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Next Best Move</h3>
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          <button onClick={() => setShowAgenda('ebc')}
            className="flex-shrink-0 w-[140px] bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 rounded-xl p-3 active:opacity-80 text-left">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mb-2">
              <span className="text-base">📋</span>
            </div>
            <span className="text-xs font-semibold text-white block mb-0.5">Suggest an Agenda</span>
            <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
          </button>
          <button onClick={() => setShowAgenda('training')}
            className="flex-shrink-0 w-[140px] bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 rounded-xl p-3 active:opacity-80 text-left">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mb-2">
              <span className="text-base">🎓</span>
            </div>
            <span className="text-xs font-semibold text-white block mb-0.5">Skills Session</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
          </button>
          <button className="flex-shrink-0 w-[140px] bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 rounded-xl p-3 active:opacity-80 text-left">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center mb-2">
              <span className="text-base">📊</span>
            </div>
            <span className="text-xs font-semibold text-white block mb-0.5">Share Competitor Benchmarks</span>
            <ArrowRight className="w-3.5 h-3.5 text-green-400" />
          </button>
        </div>
      </div>

      {/* Market Context */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-3 flex items-center gap-3">
        <Globe className="w-5 h-5 text-blue-400 shrink-0" />
        <p className="text-xs text-muted flex-1 truncate">{a.public_intelligence.industry_context}</p>
        <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
      </div>

      {/* Testimonial */}
      <div className="bg-dark-800/50 rounded-xl p-4">
        <div className="text-2xl text-purple-400 mb-2">"</div>
        <p className="text-sm text-slate-300 italic mb-3">"This changed how I run executive meetings. I show up ready."</p>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold">AM</div>
          <div>
            <span className="text-xs font-medium text-white">Alex Morgan</span>
            <span className="text-[10px] text-muted block">Senior Account Manager</span>
          </div>
        </div>
      </div>

      <div className="h-16" />
    </div>
  );
}
