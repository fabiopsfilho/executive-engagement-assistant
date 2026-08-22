import { useState, useEffect } from 'react';
import { Copy, Check, Sparkles, ArrowRight, Globe, Users, MessageSquareText, Target, CheckCircle2, Loader2 } from 'lucide-react';
import type { Account } from '../types';
import { engagementPlans } from '../data/engagementPlans';
import { generateAgenda, generateTrainingSessionAgenda } from '../data/agendas';
import { AgendaModal } from './AgendaModal';
import { isBackendAvailable, generateEngagementPlan, generateAgenda as generateAgendaAPI, type TCAccountSummary, type UnifiedAnalysisResponse } from '../services/api';


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

function InsightItem({ icon: Icon, iconColor, title, summary, detail }: { icon: React.ComponentType<{ className?: string }>; iconColor: string; title: string; summary: string; detail?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex items-start gap-2.5">
      <Icon className={`w-4 h-4 ${iconColor} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-white">{title}</span>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">{summary}</p>
        {detail && detail.trim() && (
          <>
            {expanded && <p className="text-xs text-slate-400 mt-2 leading-relaxed border-l-2 border-purple-500/30 pl-2.5">{detail}</p>}
            <button onClick={() => setExpanded(!expanded)} className="text-[11px] text-purple-400 mt-1 active:text-purple-300">
              {expanded ? 'Show less' : 'More detail →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SayThisSection({ bestStarter, allStarters, followUps }: { account: Account; bestStarter: string; allStarters: string[]; followUps?: string[] }) {
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
            {followUps && followUps.length > 0 && (
              followUps.map((f, i) => (
                <li key={i} className="text-sm text-slate-300 flex items-start gap-2"><span className="text-muted">•</span>{f}</li>
              ))
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

export function ExecBrief({ account, onEngagePersona, tcData, analysis, analysisLoading }: { account: Account; onEngagePersona: () => void; tcData?: TCAccountSummary | null; analysis?: UnifiedAnalysisResponse | null; analysisLoading?: boolean }) {
  const a = account;
  const [showAgenda, setShowAgenda] = useState<'ebc' | 'training' | null>(null);
  const [heroTab, setHeroTab] = useState<'approach' | 'next-steps' | 'key-asks'>('approach');
  const [aiAgenda, setAiAgenda] = useState<any | null>(null);
  const [agendaLoading, setAgendaLoading] = useState<'ebc' | 'training' | false>(false);

  // All insights come from the single unified analysis passed in by the parent.
  const insights = analysis;
  const insightsLoading = !!analysisLoading;
  const nextStepsLoading = !!analysisLoading;

  // Handle agenda generation via Bedrock
  const handleGenerateAgenda = async (format: 'ebc' | 'training') => {
    if (isBackendAvailable()) {
      setAgendaLoading(format);
      try {
        const tcState = a.tc_current_state.skill_builder
          ? `Existing: ${a.tc_current_state.skill_builder_seats} Skill Builder seats, ${a.tc_current_state.activation_rate}% activation, ${a.tc_current_state.certifications} certs, renewal: ${a.tc_current_state.renewal_date || 'N/A'}`
          : `Greenfield: ${a.tc_current_state.certifications} organic certs, no structured program`;
        const signalsSummary = a.signals.map(s => `[${s.severity}] ${s.label}: ${s.evidence}`).join('; ');
        const piSummary = [
          a.public_intelligence.earnings_call_signals[0] || '',
          `LinkedIn: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} cloud/AI roles (${a.public_intelligence.linkedin_job_postings.yoy_change} YoY)`,
          a.public_intelligence.executive_social.map(e => `${e.name}: "${e.post_theme}"`).join(', '),
          a.public_intelligence.glassdoor_signals[0] || '',
          a.public_intelligence.industry_context,
        ].filter(Boolean).join('. ');

        const tcDataNotes = tcData ? [
          `T&C Pipeline: $${tcData.totalPipeline.toLocaleString()}, ${tcData.openOpportunities} open opps`,
          `Products: ${tcData.products.join(', ')}`,
          `${tcData.totalStudents} students trained, Closed Won: $${tcData.closedWonRevenue.toLocaleString()}`,
        ] : [];

        const result = await generateAgendaAPI(
          {
            customer_name: a.customer_name,
            industry: a.industry,
            account_plan_priority: a.sfdc_data.account_plan_priority,
            attendees: a.ebc_data.attendees,
            ebc_date: a.ebc_data.meeting_dates[0] || 'TBD',
            ebc_location: a.ebc_data.location || 'TBD',
            ebc_themes: a.ebc_data.themes,
            tc_state: tcState,
            signals_summary: signalsSummary,
            public_intelligence_summary: piSummary,
          },
          format === 'ebc' ? 'ebc' : 'training-session',
          undefined,
          tcDataNotes
        );
        setAiAgenda({
          title: result.title,
          subtitle: result.subtitle,
          format: result.format || (format === 'ebc' ? 'Half-Day EBC' : '1-Hour Training Session'),
          location: result.location || a.ebc_data.location,
          date: result.date || a.ebc_data.meeting_dates[0] || 'TBD',
          principles: result.principles || [],
          blocks: result.blocks || [],
          preparation_notes: result.preparation || [],
        });
        setShowAgenda(format);
      } catch (err) {
        console.warn('Failed to generate AI agenda, falling back to local:', err);
        setAiAgenda(null);
        setShowAgenda(format);
      } finally {
        setAgendaLoading(false);
      }
    } else {
      setAiAgenda(null);
      setShowAgenda(format);
    }
  };

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
    const topPersona = rankedPersonas[0] || a.ebc_data.attendees[0] || { name: "Executive", title: "Senior Leader", persona: "CEO" as const };

    generateEngagementPlan(
      a,
      { name: topPersona.name, title: topPersona.title, persona: topPersona.persona },
      tcData ? [
        `EXISTING T&C OPPORTUNITIES: ${tcData.products.join(', ')}`,
        `Pipeline: $${tcData.totalPipeline.toLocaleString()}, Closed Won: $${tcData.closedWonRevenue.toLocaleString()}`,
        `${tcData.openOpportunities} open opportunities, ${tcData.totalStudents} students trained`,
        tcData.isT2K ? 'This is a T2K account' : '',
      ].filter(Boolean) : undefined,
    ).then(result => {
      if (result.conversation_starters && result.conversation_starters.length > 0) {
        setAiStarters(result.conversation_starters);
      }
      // Generate follow-ups from the AI response
      if (result.conversation_starters && result.conversation_starters.length > 1) {
        setAiFollowUps(result.conversation_starters.slice(1, 4));
      } else if (result.recommended_plays?.length) {
        setAiFollowUps(result.recommended_plays.slice(0, 3).map(p => `Have you considered ${p.play_name}? ${p.description.slice(0, 60)}...`));
      }
    }).catch(err => {
      console.warn('Failed to generate engagement plan:', err);
    }).finally(() => {
      setLoadingQuote(false);
    });
  }, [a.customer_name, a.ebc_data.attendees.length]);

  const bestStarter = plan0?.conversation_starters[0] || aiStarters[0] || `How are you planning to close your ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} AI talent gaps in the next 12–18 months?`;
  const allStarters = plan0?.conversation_starters || (aiStarters.length > 0 ? aiStarters : [bestStarter]);

  const nextSteps = analysis?.next_steps || [];
  const keyAsks = analysis?.key_asks || [];

  // Show full loading state until insights are ready
  if (insightsLoading && !insights) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
        <span className="text-sm text-slate-400">Generating insights...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {showAgenda === 'ebc' && <AgendaModal agenda={aiAgenda || generateAgenda(a)} onClose={() => setShowAgenda(null)} />}
      {showAgenda === 'training' && <AgendaModal agenda={aiAgenda || generateTrainingSessionAgenda(a)} onClose={() => setShowAgenda(null)} />}

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
            insightsLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                <span className="text-xs text-muted">Generating insights...</span>
              </div>
            ) : (
            <div className="space-y-4">
          <InsightItem
            icon={Users} iconColor="text-orange-400"
            title="Who should we focus on?"
            summary={insights?.who_to_focus || (rankedPersonas.length > 0
              ? rankedPersonas.map(att => att.name + ' (' + att.persona + ')').join(', ')
              : 'Prioritize the CHRO and CFO for the workforce conversation.')}
            detail={insights?.who_to_focus_detail}
          />
          <InsightItem
            icon={MessageSquareText} iconColor="text-green-400"
            title="What conversations should we drive?"
            summary={insights?.what_conversations || `${a.signals[0] ? `Start with "${a.signals[0].label}". ` : ''}Ask where skills gaps are slowing down ${a.sfdc_data.account_plan_priority}.`}
            detail={insights?.what_conversations_detail}
          />
          <InsightItem
            icon={Target} iconColor="text-red-400"
            title="Where should we start?"
            summary={insights?.where_to_start || 'Understand their workforce reality first — the assessment is a tool, the conversation is the value.'}
            detail={insights?.where_to_start_detail}
          />
          <InsightItem
            icon={Globe} iconColor="text-blue-400"
            title="What's happening in their world?"
            summary={insights?.whats_happening || `${a.public_intelligence.industry_context.split(';')[0].split('.')[0]}.`}
            detail={insights?.whats_happening_detail}
          />
        </div>
          ))}


          {heroTab === 'next-steps' && (
            nextStepsLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                <span className="text-xs text-muted">Generating next steps...</span>
              </div>
            ) : nextSteps.length > 0 ? (
            <div className="space-y-2">
              {nextSteps.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ArrowRight className="w-3 h-3 text-purple-400 shrink-0 mt-1" />
                  <span className="text-xs text-slate-300">{s}</span>
                </div>
              ))}
            </div>
            ) : (
              <p className="text-xs text-muted text-center py-4">No next steps generated yet</p>
            )
          )}

          {heroTab === 'key-asks' && (
            nextStepsLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                <span className="text-xs text-muted">Generating key asks...</span>
              </div>
            ) : keyAsks.length > 0 ? (
            <div className="space-y-2">
              {keyAsks.map((k, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0 mt-1" />
                  <span className="text-xs text-slate-300">{k}</span>
                </div>
              ))}
            </div>
            ) : (
              <p className="text-xs text-muted text-center py-4">No key asks generated yet</p>
            )
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
          <button onClick={() => handleGenerateAgenda('ebc')} disabled={!!agendaLoading}
            className="flex-1 bg-gradient-to-br from-purple-500/30 to-purple-500/10 border border-purple-500/40 rounded-2xl p-4 active:opacity-80 text-left disabled:opacity-60">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center mb-3">
              {agendaLoading === 'ebc' ? <Loader2 className="w-5 h-5 text-purple-400 animate-spin" /> : <span className="text-lg">📋</span>}
            </div>
            <span className="text-xs font-semibold text-white block leading-tight">{agendaLoading === 'ebc' ? 'Generating...' : 'Suggest an Agenda'}</span>
            <ArrowRight className="w-4 h-4 text-purple-400 mt-2" />
          </button>
          <button onClick={() => handleGenerateAgenda('training')} disabled={!!agendaLoading}
            className="flex-1 bg-gradient-to-br from-blue-500/30 to-blue-500/10 border border-blue-500/40 rounded-2xl p-4 active:opacity-80 text-left disabled:opacity-60">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
              {agendaLoading === 'training' ? <Loader2 className="w-5 h-5 text-blue-400 animate-spin" /> : <span className="text-lg">🎓</span>}
            </div>
            <span className="text-xs font-semibold text-white block leading-tight">{agendaLoading === 'training' ? 'Generating...' : 'Skills Session'}</span>
            <ArrowRight className="w-4 h-4 text-blue-400 mt-2" />
          </button>
        </div>
      </div>

      <div className="h-16" />
    </div>
  );
}
