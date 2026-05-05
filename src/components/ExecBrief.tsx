import { useState, useEffect } from 'react';
import { Copy, Check, Sparkles, ArrowRight, Globe, Users, MessageSquareText, Target, Search, CheckCircle2, Loader2 } from 'lucide-react';
import type { Account } from '../types';
import { engagementPlans } from '../data/engagementPlans';
import { generateAgenda, generateTrainingSessionAgenda } from '../data/agendas';
import { AgendaModal } from './AgendaModal';
import { isBackendAvailable, generateEngagementPlan } from '../services/api';


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

function ConnectionToggle({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="inline-block">
      <button onClick={() => setShow(!show)} className="p-0.5 rounded active:bg-dark-600 ml-1 align-middle">
        <Search className={`w-3 h-3 ${show ? 'text-purple-400' : 'text-dark-600'}`} />
      </button>
      {show && <span className="block mt-1 text-[10px] text-purple-400/80 pl-2 border-l-2 border-purple-500/30 leading-relaxed">🔗 {text}</span>}
    </span>
  );
}

function generateNextSteps(a: Account): { text: string; connection: string }[] {
  const isGreenfield = !a.tc_current_state.skill_builder;
  if (isGreenfield) return [
    { text: `Learning Needs Assessment for ${a.customer_name}`, connection: `Buzz: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles. Agenda: Workshop block.` },
    { text: `Phased pilot: 50-100 people in critical roles`, connection: `Now: Top signal. Skills Session: Technical Roles block.` },
    { text: `Executive AI Literacy for C-suite`, connection: `Buzz: ${a.public_intelligence.executive_social[0]?.name || 'Executive'} signals. Skills Session: Non-Technical block.` },
  ];
  return [
    { text: `Subscription Health Review & program redesign`, connection: `Buzz: Glassdoor "${a.public_intelligence.glassdoor_signals[0] || ''}". Skills Session: Engagement Model.` },
    { text: `Transition to structured workforce program`, connection: `Now: ${a.sfdc_data.account_plan_priority}. Agenda: Workshop block.` },
    { text: `Pilot redesign before renewal window`, connection: `Summary: Renewal approaching. Agenda: Investment Framework.` },
  ];
}

function generateKeyAsks(a: Account): { ask: string; connection: string }[] {
  const isGreenfield = !a.tc_current_state.skill_builder;
  const asks = [
    { ask: 'Executive sponsor commitment', connection: `Buzz: ${a.public_intelligence.executive_social[0]?.name || 'Executive'} is a potential champion. Agenda: Commitments block.` },
    { ask: 'Dedicated learning time (2-4 hrs/week)', connection: `Buzz: Glassdoor feedback. Skills Session: Engagement Model.` },
  ];
  if (isGreenfield) asks.push({ ask: 'Identify pilot team (50-100 people)', connection: `Buzz: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles. Agenda: Workshop.` });
  else asks.push({ ask: 'Share current usage data', connection: `Summary: ${a.tc_current_state.activation_rate}% activation. Skills Session: Engagement Model.` });
  asks.push({ ask: '90-day checkpoint agreement', connection: `Now: Creates urgency. Agenda: Commitments block.` });
  return asks;
}


function SayThisSection({ account, bestStarter, allStarters, followUps }: { account: Account; bestStarter: string; allStarters: string[]; followUps?: string[] }) {
  const a = account;
  const [expanded, setExpanded] = useState(false);
  const [showMore, setShowMore] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Here is a Quote</h3>
        <button onClick={() => setShowMore(!showMore)} className="text-[11px] text-purple-400 active:text-purple-300">
          {showMore ? 'Hide angles' : 'See more angles'}
        </button>
      </div>

      {/* Quote card — matching Figma: purple left border, quote inside, follow-ups inside */}
      <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden border-l-4 border-l-purple-500">
        {/* Quote section */}
        <div className="p-5">
          <div className="text-3xl text-purple-500 leading-none mb-3 font-serif">"</div>
          <button onClick={() => setExpanded(!expanded)} className="text-left w-full">
            <p className="text-xl text-white font-semibold leading-snug">
              {expanded ? bestStarter : (bestStarter.length > 100 ? bestStarter.slice(0, 100) + '...' : bestStarter)}
            </p>
            {bestStarter.length > 100 && !expanded && (
              <span className="text-[11px] text-purple-400 mt-2 block">Tap to read full ▾</span>
            )}
          </button>
          <div className="flex gap-2.5 mt-4">
            <CopyBtn text={bestStarter} />
            <button className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-purple-500 text-sm text-white font-medium active:bg-purple-400">
              <Sparkles className="w-3.5 h-3.5" />Improve with AI
            </button>
          </div>
        </div>

        {/* Follow-ups — inside the same card */}
        <div className="mx-4 mb-4 p-3.5 border border-dark-600 rounded-xl">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Follow-ups</span>
          <ul className="mt-2 space-y-1.5">
            {followUps && followUps.length > 0 ? (
              followUps.map((f, i) => (
                <li key={i} className="text-sm text-slate-300 flex items-start gap-2"><span className="text-muted">•</span>{f}</li>
              ))
            ) : (
              <>
                <li className="text-sm text-slate-300 flex items-start gap-2"><span className="text-muted">•</span>Are {a.industry === 'Financial Services' ? 'GenAI' : 'cloud'} skills part of your hiring strategy?</li>
                <li className="text-sm text-slate-300 flex items-start gap-2"><span className="text-muted">•</span>Build vs. buy vs. train — what's the plan?</li>
                <li className="text-sm text-slate-300 flex items-start gap-2"><span className="text-muted">•</span>Where are you seeing the biggest delays?</li>
              </>
            )}
          </ul>
        </div>
      </div>

      {/* More angles */}
      {showMore && (
        <div className="mt-3 space-y-2">
          {allStarters.slice(1).map((s, i) => (
            <div key={i} className="bg-dark-800 border border-dark-600 rounded-xl p-3 flex items-start gap-2">
              <span className="text-xs text-purple-400 font-bold shrink-0 mt-0.5">{i + 2}</span>
              <p className="text-xs text-slate-300 leading-relaxed flex-1">{s}</p>
              <CopyBtn text={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExecBrief({ account, onEngagePersona }: { account: Account; onEngagePersona: () => void }) {
  const a = account;
  const [showAgenda, setShowAgenda] = useState<'ebc' | 'training' | null>(null);
  const [heroTab, setHeroTab] = useState<'approach' | 'next-steps' | 'key-asks'>('approach');
  const isGreenfield = !a.tc_current_state.skill_builder;

  const topSignal = a.signals[0];
  const primaryPlay = topSignal?.label.includes('Talent') ? 'AI Talent Gap' : topSignal?.label.includes('Compliance') ? 'Compliance Readiness' : topSignal?.label.includes('Subscription') ? 'Engagement Revival' : 'Workforce Transformation';
  const primaryArrow = topSignal?.label.includes('Talent') ? 'Workforce Transformation' : topSignal?.label.includes('Compliance') ? 'Regulatory Advantage' : 'Strategic Partnership';

  const rankedPersonas = a.ebc_data.attendees
    .filter(att => ['CEO', 'CFO', 'CTO', 'CIO', 'CHRO'].includes(att.persona))
    .sort((x, y) => { const o = ['CHRO', 'CTO', 'CIO', 'CEO', 'CFO']; return o.indexOf(x.persona) - o.indexOf(y.persona); })
    .slice(0, 3);

  const plan0 = engagementPlans[`${a.customer_name}::${rankedPersonas[0]?.persona}`];
  const [aiStarters, setAiStarters] = useState<string[]>([]);
  const [aiFollowUps, setAiFollowUps] = useState<string[]>([]);
  const [loadingQuote, setLoadingQuote] = useState(false);

  // Fetch AI-generated conversation starters for live accounts without pre-built plans
  useEffect(() => {
    if (plan0 || !isBackendAvailable()) return;
    if (aiStarters.length > 0) return; // Already fetched

    setLoadingQuote(true);
    const topPersona = rankedPersonas[0] || a.ebc_data.attendees[0];
    if (!topPersona) { setLoadingQuote(false); return; }

    generateEngagementPlan(
      a,
      { name: topPersona.name, title: topPersona.title, persona: topPersona.persona },
    ).then(result => {
      if (result.conversation_starters && result.conversation_starters.length > 0) {
        setAiStarters(result.conversation_starters);
      }
      // Generate follow-ups from the narrative
      if (result.narrative) {
        setAiFollowUps([
          `What's your biggest skills bottleneck on ${a.sfdc_data.account_plan_priority}?`,
          result.recommended_plays?.[0] ? `Have you explored ${result.recommended_plays[0].play_name.toLowerCase()}?` : 'Build vs. buy vs. train — what\'s the plan?',
          `What does success look like in 90 days for your workforce?`,
        ]);
      }
    }).catch(err => {
      console.warn('Failed to generate engagement plan:', err);
    }).finally(() => {
      setLoadingQuote(false);
    });
  }, [a.customer_name]);

  const bestStarter = plan0?.conversation_starters[0] || aiStarters[0] || `How are you planning to close your ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} AI talent gaps in the next 12–18 months?`;
  const allStarters = plan0?.conversation_starters || (aiStarters.length > 0 ? aiStarters : [bestStarter]);

  const nextSteps = generateNextSteps(a);
  const keyAsks = generateKeyAsks(a);

  return (
    <div className="space-y-5 animate-fade-in">
      {showAgenda === 'ebc' && <AgendaModal agenda={generateAgenda(a)} onClose={() => setShowAgenda(null)} />}
      {showAgenda === 'training' && <AgendaModal agenda={generateTrainingSessionAgenda(a)} onClose={() => setShowAgenda(null)} />}

      {/* Hero — Primary Play with tabs */}
      <section className="relative">
        <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/10 border border-purple-500/30 rounded-2xl overflow-hidden relative">
        {/* Brain illustration — clickable to engage a persona */}
        <button onClick={onEngagePersona}
          className="absolute top-2 right-2 w-20 h-20 flex flex-col items-center justify-center active:scale-95 transition-transform z-10 group"
          aria-label="Engage a persona"
        >
          <img src="/brain.svg" alt="" className="w-14 h-14 group-active:opacity-70" />
          <span className="text-[8px] font-bold text-purple-400 mt-0.5">Engage a Persona</span>
        </button>

        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Primary Play</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{primaryPlay}</h3>
          <p className="text-sm text-muted">→ {primaryArrow}</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 font-medium">High Confidence</span>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 font-medium">Immediate Action</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-purple-500/20">
          {([
            { id: 'approach' as const, label: 'Approach' },
            { id: 'next-steps' as const, label: 'Next Steps' },
            { id: 'key-asks' as const, label: 'Key Asks' },
          ]).map(t => (
            <button key={t.id} onClick={() => setHeroTab(t.id)}
              className={`flex-1 py-2.5 text-[11px] font-medium transition-colors ${heroTab === t.id ? 'text-purple-400 bg-purple-500/10' : 'text-muted'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5 pt-3">
          {heroTab === 'approach' && (
            <div className="space-y-4">
          <div className="flex items-start gap-2.5">
            <Users className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-white">Who should we focus on?</span>
              <p className="text-xs text-muted mt-0.5">
                {rankedPersonas.map(att => att.name + ' (' + att.persona + ')').join(', ')} — strongest signals for workforce conversations.
              </p>
              <ConnectionToggle text={`Buzz: ${a.public_intelligence.executive_social[0] ? `${a.public_intelligence.executive_social[0].name} posted about "${a.public_intelligence.executive_social[0].post_theme}"` : 'Executive signals'}. Agenda: Featured in Welcome & Vision blocks.`} />
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <MessageSquareText className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-white">What conversations should we drive?</span>
              <p className="text-xs text-muted mt-0.5">
                {a.signals[0] ? `Start with "${a.signals[0].label}" — ${a.signals[0].evidence.split(';')[0]}. ` : ''}
                Ask where skills gaps are slowing down {a.sfdc_data.account_plan_priority}.
              </p>
              <ConnectionToggle text={`Now: ${a.signals[0]?.label || 'Top signal'} is the priority. Buzz: Earnings & Glassdoor support this. Skills Session: Workforce Landscape block.`} />
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Target className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-white">Where should we start?</span>
              <p className="text-xs text-muted mt-0.5">
                {isGreenfield
                  ? `No structured training — ${a.tc_current_state.certifications} organic certs. Understand their workforce reality. The assessment is just a tool — the conversation is the value.`
                  : `Adoption stalled. Glassdoor: "${a.public_intelligence.glassdoor_signals[0]}". Redesign how they develop people.`}
              </p>
              <ConnectionToggle text={`Summary: ${isGreenfield ? 'Greenfield' : `${a.tc_current_state.activation_rate}% activation`}. Buzz: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles. Skills Session: Technical & Non-Technical blocks.`} />
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Globe className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-white">What's happening in their world?</span>
              <p className="text-xs text-muted mt-0.5">{a.public_intelligence.industry_context.split(';')[0].split('.')[0]}.</p>
              <ConnectionToggle text={`Buzz: Industry trends & news. Agenda: Welcome & Intelligence Briefing. Now: Frames urgency.`} />
            </div>
          </div>
        </div>
          )}

          {heroTab === 'next-steps' && (
            <div className="space-y-2">
              {nextSteps.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ArrowRight className="w-3 h-3 text-purple-400 shrink-0 mt-1" />
                  <div>
                    <span className="text-xs text-slate-300">{s.text}</span>
                    <ConnectionToggle text={s.connection} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {heroTab === 'key-asks' && (
            <div className="space-y-2">
              {keyAsks.map((k, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0 mt-1" />
                  <div>
                    <span className="text-xs text-slate-300">{k.ask}</span>
                    <ConnectionToggle text={k.connection} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </section>

      {/* Say This */}
      {loadingQuote ? (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
          <span className="text-xs text-muted">Generating conversation starters...</span>
        </div>
      ) : (
        <SayThisSection account={a} bestStarter={bestStarter} allStarters={allStarters} followUps={aiFollowUps} />
      )}

      {/* Next Best Move — Figma style colored cards */}
      <div>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Next Best Move</h3>
        <div className="flex gap-2.5">
          <button onClick={() => setShowAgenda('ebc')}
            className="flex-1 bg-gradient-to-br from-purple-500/30 to-purple-500/10 border border-purple-500/40 rounded-2xl p-4 active:opacity-80 text-left">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center mb-3">
              <span className="text-lg">📋</span>
            </div>
            <span className="text-xs font-semibold text-white block leading-tight">Suggest an Agenda</span>
            <ArrowRight className="w-4 h-4 text-purple-400 mt-2" />
          </button>
          <button onClick={() => setShowAgenda('training')}
            className="flex-1 bg-gradient-to-br from-blue-500/30 to-blue-500/10 border border-blue-500/40 rounded-2xl p-4 active:opacity-80 text-left">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
              <span className="text-lg">🎓</span>
            </div>
            <span className="text-xs font-semibold text-white block leading-tight">Skills Session</span>
            <ArrowRight className="w-4 h-4 text-blue-400 mt-2" />
          </button>
        </div>
      </div>

      <div className="h-16" />
    </div>
  );
}
