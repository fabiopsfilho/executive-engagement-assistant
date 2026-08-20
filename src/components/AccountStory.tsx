import { Lightbulb, TrendingUp, ArrowRight, CheckCircle2, Users, AlertTriangle, MessageSquareText, Target, Globe, Zap, CalendarCheck, BookOpenCheck, Search, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Account } from '../types';
import { generateAgenda, generateTrainingSessionAgenda } from '../data/agendas';
import type { UserNote } from '../data/agendas';
import { AgendaModal } from './AgendaModal';
import { generateAccountInsights, generateAgenda as generateAgendaAPI, generateBuzzNow, generateNextStepsAndAsks, isBackendAvailable, type AccountInsightsResponse, type TCAccountSummary, type BuzzNowResponse, type NextStepsResponse } from '../services/api';

function ConnectionToggle({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="inline-block relative">
      <button onClick={() => setShow(!show)} className="p-1 rounded active:bg-navy-700 ml-1 align-middle" aria-label="View connections">
        <Search className={`w-3 h-3 ${show ? 'text-sky-400' : 'text-slate-600'}`} />
      </button>
      {show && (
        <div className="mt-1 text-[10px] text-sky-400/80 pl-2 border-l-2 border-sky-500/30 leading-relaxed">🔗 {text}</div>
      )}
    </div>
  );
}

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;
}

type TopTab = 'approach' | 'summary' | 'next-steps' | 'key-asks';



export function AccountStory({ account, notes = [], onEngagePersona, tcData }: { account: Account; notes?: UserNote[]; onEngagePersona?: () => void; tcData?: TCAccountSummary | null }) {
  const a = account;
  const [showAgendaType, setShowAgendaType] = useState<'ebc' | 'training' | null>(null);
  const [topTab, setTopTab] = useState<TopTab>('approach');
  const [insightTab, setInsightTab] = useState<'now' | 'buzz' | null>(null);
  const [insights, setInsights] = useState<AccountInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [buzzNow, setBuzzNow] = useState<BuzzNowResponse | null>(null);
  const [buzzNowLoading, setBuzzNowLoading] = useState(false);
  const [aiAgenda, setAiAgenda] = useState<any | null>(null);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [aiNextSteps, setAiNextSteps] = useState<NextStepsResponse | null>(null);
  const [nextStepsLoading, setNextStepsLoading] = useState(false);
  const isGreenfield = !a.tc_current_state.skill_builder;
  const spendGrowth = Math.round(((a.aws_spend.current_year - a.aws_spend.prior_year) / a.aws_spend.prior_year) * 100);

  // Fetch AI-generated insights and buzz/now when account changes
  useEffect(() => {
    if (!isBackendAvailable()) return;
    setInsightsLoading(true);
    setInsights(null);
    setBuzzNowLoading(true);
    setBuzzNow(null);
    setNextStepsLoading(true);
    setAiNextSteps(null);
    generateAccountInsights(a, tcData)
      .then(result => setInsights(result))
      .catch(err => console.warn('Failed to generate insights:', err))
      .finally(() => setInsightsLoading(false));
    generateBuzzNow(a, tcData)
      .then(result => setBuzzNow(result))
      .catch(err => console.warn('Failed to generate buzz/now:', err))
      .finally(() => setBuzzNowLoading(false));
    generateNextStepsAndAsks(a, tcData)
      .then(result => setAiNextSteps(result))
      .catch(err => console.warn('Failed to generate next steps:', err))
      .finally(() => setNextStepsLoading(false));
  }, [a.customer_name, a.ebc_data.attendees.length]);

  // Handle agenda generation via Bedrock
  const handleGenerateAgenda = async (format: 'ebc' | 'training') => {
    if (isBackendAvailable()) {
      setAgendaLoading(true);
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
          [...notes.map(n => n.text), ...tcDataNotes]
        );
        // Convert API response to Agenda format for the modal
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
        setShowAgendaType(format);
      } catch (err) {
        console.warn('Failed to generate AI agenda, falling back to local:', err);
        setAiAgenda(null);
        setShowAgendaType(format);
      } finally {
        setAgendaLoading(false);
      }
    } else {
      setAiAgenda(null);
      setShowAgendaType(format);
    }
  };

  const ebcAgenda = generateAgenda(a, notes);
  const trainingAgenda = generateTrainingSessionAgenda(a, notes);
  const nextSteps = aiNextSteps?.next_steps || [];
  const keyAsks = aiNextSteps?.key_asks || [];

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      {showAgendaType === 'ebc' && <AgendaModal agenda={aiAgenda || ebcAgenda} onClose={() => setShowAgendaType(null)} />}
      {showAgendaType === 'training' && <AgendaModal agenda={aiAgenda || trainingAgenda} onClose={() => setShowAgendaType(null)} />}

      {/* ── Approach box with side ribbon tabs ── */}
      <section className="relative mx-8">
        {/* Left ribbon tab — Engage a Persona */}
        {onEngagePersona && (
          <div className="absolute -left-8 top-0 bottom-0 z-10 flex items-center">
            <button onClick={onEngagePersona}
              className="bg-rose-500 active:bg-rose-600 rounded-l-lg shadow-lg w-8 py-2 flex flex-col items-center justify-center gap-2 transition-colors"
            >
              <Users className="w-4 h-4 text-white" />
              <span className="text-[10px] font-bold text-white leading-tight text-center" style={{ writingMode: 'vertical-lr' }}>Engage a Persona</span>
            </button>
          </div>
        )}
        {/* Right ribbon tabs — Buzz & Now */}
        <div className="absolute -right-8 top-0 bottom-0 z-10 flex flex-col items-center justify-center gap-2">
          <button onClick={() => setInsightTab('buzz')}
            className="bg-amber-500 active:bg-amber-600 rounded-r-lg shadow-lg w-8 py-2 flex flex-col items-center justify-center gap-2 transition-colors"
          >
            <MessageSquareText className="w-4 h-4 text-white" />
            <span className="text-[10px] font-bold text-white leading-tight text-center" style={{ writingMode: 'vertical-lr' }}>Buzz</span>
          </button>
          <button onClick={() => setInsightTab('now')}
            className="bg-sky-500 active:bg-sky-600 rounded-r-lg shadow-lg w-8 py-2 flex flex-col items-center justify-center gap-2 transition-colors"
          >
            <Zap className="w-4 h-4 text-white" />
            <span className="text-[10px] font-bold text-white leading-tight text-center" style={{ writingMode: 'vertical-lr' }}>Now</span>
          </button>
        </div>

        {/* Main box */}
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl overflow-hidden">
          <div className="flex border-b border-amber-500/15">
            {([
              { id: 'approach' as TopTab, label: 'Approach' },
              { id: 'summary' as TopTab, label: 'Summary' },
              { id: 'next-steps' as TopTab, label: 'Next Steps' },
              { id: 'key-asks' as TopTab, label: 'Key Asks' },
            ]).map(t => (
              <button key={t.id} onClick={() => setTopTab(t.id)}
                className={`flex-1 py-2.5 text-[11px] font-medium transition-colors ${topTab === t.id ? 'text-amber-400 bg-amber-500/5' : 'text-slate-500'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-4">
            {topTab === 'approach' && (
              <div className="space-y-4">
                {insightsLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Generating AI insights for {a.customer_name}...</span>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <Users className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-white">Who should we focus on?</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {insights?.who_to_focus
                        || (a.ebc_data.attendees.filter(att => a.public_intelligence.executive_social.find(e => e.name === att.name) || att.persona === 'CHRO' || att.persona === 'CEO')
                          .map(att => att.name + ' (' + att.title + ')').join(', ') + ' — strongest signals for workforce conversations.')}
                    </p>
                    <ConnectionToggle text={`Buzz: ${a.public_intelligence.executive_social[0] ? `${a.public_intelligence.executive_social[0].name} posted about "${a.public_intelligence.executive_social[0].post_theme}"` : 'Executive social signals detected'}. Agenda: These personas are featured in the suggested EBC agenda Welcome & Vision blocks.`} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MessageSquareText className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-white">What conversations should we drive?</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {insights?.what_conversations
                        || `${a.signals[0] ? `Start with "${a.signals[0].label}" — ${a.signals[0].evidence}. ` : ''}Lead with what we know: ${a.public_intelligence.earnings_call_signals[0] ? `"${a.public_intelligence.earnings_call_signals[0].split(': ')[1] || a.public_intelligence.earnings_call_signals[0]}". ` : ''}Ask where skills gaps are slowing down ${a.sfdc_data.account_plan_priority}. Let them define the problem.`}
                    </p>
                    <ConnectionToggle text={`Now: ${a.signals[0]?.label || 'Top signal'} is the priority. Buzz: Earnings call signals and Glassdoor data support this angle. Skills Session: The Workforce Landscape block covers this data story.`} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Target className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-white">Where should we start?</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {insights?.where_to_start
                        || (isGreenfield
                          ? `No structured training — ${a.tc_current_state.certifications} organic certs. Understand their workforce reality: who are the ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} roles they can't fill? The assessment is just a tool — the conversation is the value.`
                          : `Adoption stalled. Glassdoor says "${a.public_intelligence.glassdoor_signals[0]}". The conversation isn't about renewal — it's about redesigning how they develop people.`)}
                    </p>
                    <ConnectionToggle text={`Summary: ${isGreenfield ? `${a.tc_current_state.certifications} organic certs, greenfield opportunity` : `Existing engagement at ${a.tc_current_state.activation_rate}% activation`}. Buzz: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles (${a.public_intelligence.linkedin_job_postings.yoy_change} YoY). Skills Session: Connects to the Non-Technical & Technical Roles blocks.`} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Globe className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-white">What's happening in their world?</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {insights?.whats_happening
                        || `${a.public_intelligence.industry_context}. ${a.public_intelligence.news_signals[0] || ''}`}
                    </p>
                    <ConnectionToggle text={`Buzz: Industry trends and news signals. Agenda: Referenced in the Welcome & Workforce Intelligence Briefing blocks. Now: Frames the urgency of the engagement.`} />
                  </div>
                </div>
              </div>
            )}

            {topTab === 'summary' && (
              <div className="space-y-4">
                <div>
                  <p className="text-slate-200 leading-relaxed text-sm">
                    <span className="text-white font-semibold">{a.customer_name}</span> is a{' '}
                    <span className="text-amber-400">{a.segment}</span> account in{' '}
                    <span className="text-sky-400">{a.industry}</span> ({a.geo}) with{' '}
                    <span className="text-white font-medium">{fmt(a.aws_spend.current_year)}</span> spend,{' '}
                    up <span className="text-emerald-400">{spendGrowth}%</span> YoY.
                    {a.aws_spend.ppa && <> PPA: <span className="text-emerald-400">{a.aws_spend.ppa}</span>.</>}
                  </p>
                </div>
                <div className="bg-navy-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-slate-300">Strategic Priority</span>
                  </div>
                  <p className="text-sm text-white">{a.sfdc_data.account_plan_priority}</p>
                  <p className="text-xs text-slate-400 mt-1">{a.sfdc_data.open_opps} opps · {a.sfdc_data.smgs_phase} · {a.sfdc_data.t2k ? 'T2K' : 'Non-T2K'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-xs font-semibold text-slate-300">Signals</span>
                  </div>
                  {a.signals.map(s => (
                    <div key={s.label} className="flex items-start gap-2 mb-2">
                      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${s.severity === 'HIGH' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                      <div>
                        <span className="text-xs text-white font-medium">{s.label}</span>
                        <p className="text-[11px] text-slate-400">{s.evidence}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-navy-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-300">T&C Engagement History</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {isGreenfield
                      ? `Minimal engagement — ${a.tc_current_state.certifications} organic certs, no structured program. Significant greenfield opportunity.`
                      : `Existing relationship but adoption plateaued. Renewal window approaching — moment to reimagine as strategic workforce partnership.`}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs font-semibold text-slate-300">Executive Voices</span>
                  </div>
                  {a.public_intelligence.executive_social.map(e => (
                    <div key={e.name} className="mb-2">
                      <span className="text-xs text-white font-medium">{e.name}</span>
                      <span className="text-[10px] text-slate-500 ml-1">{e.title}</span>
                      <p className="text-xs text-sky-400 italic">"{e.post_theme}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {topTab === 'next-steps' && (
              <div className="space-y-3">
                {nextStepsLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Generating AI next steps...</span>
                  </div>
                )}
                {nextSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <ArrowRight className="w-3 h-3 text-amber-400" />
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            )}
            {topTab === 'key-asks' && (
              <div className="space-y-2.5">
                {nextStepsLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Generating AI key asks...</span>
                  </div>
                )}
                {keyAsks.map((item, i) => (
                  <div key={i} className="bg-navy-800/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs font-medium text-white">{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Insight popup */}
      {insightTab && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm" onClick={() => setInsightTab(null)}>
          <div className="bg-navy-800 border border-navy-600 rounded-b-2xl w-full max-w-[430px] max-h-[70vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                {insightTab === 'now' ? <Zap className="w-4 h-4 text-sky-400" /> : <MessageSquareText className="w-4 h-4 text-amber-400" />}
                <h3 className="text-sm font-semibold text-white">{insightTab === 'now' ? 'What to focus on now' : 'What people are saying'}</h3>
              </div>
              <button onClick={() => setInsightTab(null)} className="p-2 rounded-lg active:bg-navy-700"><span className="text-slate-400 text-lg">✕</span></button>
            </div>
            <div className="px-5 pb-5">
              {insightTab === 'now' && (
                <div className="space-y-4">
                  {buzzNowLoading && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                      <span>Analyzing signals for {a.customer_name}...</span>
                    </div>
                  )}
                  {/* AI Focus */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">What to focus on now</span>
                    </div>
                    <p className="text-sm text-slate-200 pl-3 border-l-2 border-sky-500">
                      {buzzNow?.now_focus || `${a.sfdc_data.account_plan_priority} — ${a.signals[0]?.evidence || 'Priority engagement'}`}
                    </p>
                  </div>
                  {/* AI Initiatives */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Initiatives to drive</span>
                    </div>
                    <div className="space-y-2">
                      {(buzzNow?.now_initiatives || [`Focus on ${a.sfdc_data.account_plan_priority}`, ...a.signals.filter(s => s.severity === 'HIGH').map(s => s.label)]).map((initiative, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="mt-1 w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          <p className="text-sm text-slate-300">{initiative}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* AI Key Asks */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Key asks for this moment</span>
                    </div>
                    <div className="space-y-1.5">
                      {(buzzNow?.now_key_asks || [
                        'Who is the executive sponsor for workforce development?',
                        `What's the timeline pressure on ${a.sfdc_data.account_plan_priority}?`,
                        isGreenfield ? 'Which teams are most critical to the transformation?' : 'Why has the current training engagement stalled?',
                        'What does success look like in 90 days?',
                      ]).map((ask, i) => (
                        <p key={i} className="text-sm text-slate-300">→ {ask}</p>
                      ))}
                    </div>
                  </div>
                  {/* AI Opening Move */}
                  <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-3">
                    <span className="text-xs font-semibold text-sky-400">💡 Your opening move</span>
                    <p className="text-sm text-slate-300 mt-1">
                      {buzzNow?.now_opening_move || (a.public_intelligence.executive_social[0]
                        ? `${a.public_intelligence.executive_social[0].name} posted about "${a.public_intelligence.executive_social[0].post_theme}" — reference this to show you've done your homework.`
                        : `Lead with their ${a.sfdc_data.account_plan_priority} priority and ask how workforce readiness fits into their timeline.`)}
                    </p>
                  </div>
                </div>
              )}
              {insightTab === 'buzz' && (
                <div className="space-y-4">
                  {buzzNowLoading && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span>Analyzing market signals...</span>
                    </div>
                  )}
                  {/* AI Buzz Summary */}
                  {buzzNow?.buzz_summary && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      <span className="text-xs font-semibold text-amber-400">📊 Signal Synthesis</span>
                      <p className="text-sm text-slate-200 mt-1">{buzzNow.buzz_summary}</p>
                    </div>
                  )}
                  {/* AI Executive Insights */}
                  <div>
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Executive voices</span>
                    <div className="space-y-3 mt-2">
                      {buzzNow?.buzz_executive_insights ? (
                        buzzNow.buzz_executive_insights.map((insight, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-[10px] text-slate-300 font-bold shrink-0">💡</div>
                            <p className="text-sm text-slate-300">{insight}</p>
                          </div>
                        ))
                      ) : (
                        a.public_intelligence.executive_social.map(e => (
                          <div key={e.name} className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-[10px] text-slate-300 font-bold shrink-0">{e.name.split(' ').map(w => w[0]).join('')}</div>
                            <div>
                              <span className="text-sm font-medium text-white">{e.name}</span>
                              <span className="text-xs text-slate-500 ml-1.5">{e.title}</span>
                              <p className="text-sm text-sky-400 italic mt-0.5">"{e.post_theme}"</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {/* AI Hiring Analysis */}
                  <div className="pt-3 border-t border-navy-600">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Hiring & Skills Gap Analysis</span>
                    <div className="mt-2">
                      <div className="flex items-center gap-4 mb-2">
                        <div>
                          <span className="text-2xl font-bold text-white">{a.public_intelligence.linkedin_job_postings.cloud_ai_roles}</span>
                          <span className="text-xs text-slate-400 ml-1">cloud/AI roles</span>
                        </div>
                        <span className="text-sm text-emerald-400 font-semibold">{a.public_intelligence.linkedin_job_postings.yoy_change} YoY</span>
                      </div>
                      <p className="text-sm text-slate-300">{typeof buzzNow?.buzz_hiring_analysis === 'string' ? buzzNow.buzz_hiring_analysis : (buzzNow?.buzz_hiring_analysis?.why_this_matters || 'Signals demand for cloud skills — they can\'t hire fast enough.')}</p>
                    </div>
                  </div>
                  {/* AI Sentiment Analysis */}
                  <div className="pt-3 border-t border-navy-600">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Employee Sentiment & Culture</span>
                    <p className="text-sm text-slate-300 mt-2">{typeof buzzNow?.buzz_sentiment_analysis === 'string' ? buzzNow.buzz_sentiment_analysis : (buzzNow?.buzz_sentiment_analysis?.why_this_matters || (a.public_intelligence.glassdoor_signals[0] ? `"${a.public_intelligence.glassdoor_signals[0]}"` : 'No sentiment data available'))}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={() => handleGenerateAgenda('ebc')} disabled={agendaLoading} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-navy-900 font-semibold text-xs active:opacity-90 disabled:opacity-60">
          {agendaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}{agendaLoading ? 'Generating...' : 'Suggest an Agenda'}
        </button>
        <button onClick={() => handleGenerateAgenda('training')} disabled={agendaLoading} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold text-xs active:opacity-90 disabled:opacity-60">
          {agendaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpenCheck className="w-4 h-4" />}{agendaLoading ? 'Generating...' : 'Skills Session'}
        </button>
      </div>

      <div className="h-4" />
    </div>
  );
}
