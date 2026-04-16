import { Lightbulb, TrendingUp, ArrowRight, CheckCircle2, Users, AlertTriangle, MessageSquareText, Target, Globe, Zap, CalendarCheck, BookOpenCheck, Search } from 'lucide-react';
import { useState } from 'react';
import type { Account } from '../types';
import { generateAgenda, generateTrainingSessionAgenda } from '../data/agendas';
import type { UserNote } from '../data/agendas';
import { AgendaModal } from './AgendaModal';

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

function generateNextSteps(a: Account, userNotes: UserNote[]): { text: string; connection: string }[] {
  const isGreenfield = !a.tc_current_state.skill_builder;
  const steps: { text: string; connection: string }[] = [];
  if (isGreenfield) {
    steps.push({ text: `Conduct a Learning Needs Assessment to map the skills gap across ${a.customer_name}'s workforce against their ${a.sfdc_data.account_plan_priority} transformation goals.`, connection: `Now: Top initiative. Agenda: Featured in Working Backwards Workshop. Buzz: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles confirm the gap.` });
    steps.push({ text: `Design a phased training program starting with a 50-100 person pilot aligned to the most critical roles for the ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} cloud/AI roles they can't fill externally.`, connection: `Buzz: LinkedIn hiring data (${a.public_intelligence.linkedin_job_postings.yoy_change} YoY). Skills Session: Covered in Technical Roles block.` });
    steps.push({ text: `Develop an Executive AI Literacy program for the C-suite and board.`, connection: `Now: Executive sponsor is a key ask. Buzz: ${a.public_intelligence.executive_social[0] ? `${a.public_intelligence.executive_social[0].name} is already thinking about this` : 'Executive signals detected'}. Skills Session: Non-Technical Roles block.` });
  } else {
    steps.push({ text: `Complete a Subscription Health Review to understand why activation has plateaued — then redesign the program with dedicated learning time and manager accountability.`, connection: `Buzz: Glassdoor says "${a.public_intelligence.glassdoor_signals[0] || 'employee feedback'}". Summary: ${a.tc_current_state.activation_rate}% activation. Skills Session: Engagement Model block.` });
    steps.push({ text: `Transition from a subscription model to a structured workforce development program with role-based tracks and measurable outcomes tied to ${a.sfdc_data.account_plan_priority}.`, connection: `Now: Strategic priority. Agenda: Working Backwards Workshop. Summary: ${a.sfdc_data.smgs_phase} phase.` });
    steps.push({ text: `Launch a program redesign pilot with the highest-priority teams before the renewal window.`, connection: `Summary: Renewal approaching. Now: Urgency signal. Agenda: Investment Framework block.` });
  }
  steps.push({ text: `Establish a quarterly business review cadence to track training ROI and certification progress.`, connection: `Agenda: Commitments & Next Steps block. Summary: ${a.sfdc_data.open_opps} open opportunities to connect to.` });
  steps.push({ text: `Build a long-term Skills Transformation Roadmap scaling from pilot to enterprise-wide over 12-18 months.`, connection: `Now: Think big, start small. Agenda: Working Backwards Workshop. Trend: ${a.public_intelligence.industry_context.split(';')[0]}.` });
  userNotes.forEach(n => steps.push({ text: `Address: ${n.text}${n.url ? ` (ref: ${n.url})` : ''}`, connection: `Added topic. Agenda: Included in Additional Topics block. Skills Session: Included in Additional Topics block.` }));
  return steps;
}

function generateKeyAsks(a: Account, userNotes: UserNote[]): { ask: string; why: string; connection: string }[] {
  const isGreenfield = !a.tc_current_state.skill_builder;
  const asks: { ask: string; why: string; connection: string }[] = [
    { ask: 'Executive sponsor', why: 'Without a C-level champion, training programs become optional.', connection: `Now: Key ask. Buzz: ${a.public_intelligence.executive_social[0] ? `${a.public_intelligence.executive_social[0].name} is a potential champion` : 'Executive signals detected'}. Agenda: Commitments block.` },
    { ask: 'Dedicated learning time', why: `${a.customer_name} must commit 2-4 hours/week of protected learning time. This is the #1 success factor.`, connection: `Buzz: Glassdoor says "${a.public_intelligence.glassdoor_signals.find(s => s.toLowerCase().includes('time') || s.toLowerCase().includes('learning')) || a.public_intelligence.glassdoor_signals[0] || 'employee feedback'}". Skills Session: Engagement Model block.` },
  ];
  if (isGreenfield) {
    asks.push({ ask: 'Identify pilot team (50-100 people)', why: `Roles most critical to ${a.sfdc_data.account_plan_priority}.`, connection: `Buzz: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles show where demand is. Skills Session: Technical Roles block. Agenda: Workshop block.` });
  } else {
    asks.push({ ask: 'Share usage data and feedback', why: 'Essential for redesigning the program to drive real adoption.', connection: `Summary: ${a.tc_current_state.activation_rate}% activation needs investigation. Buzz: Glassdoor signals reveal root causes. Skills Session: Engagement Model block.` });
  }
  asks.push({ ask: 'Measurable success criteria', why: 'Activation rates, certification targets, skill uplift, business impact.', connection: `Agenda: Investment Framework block. Now: 90-day checkpoint is critical. Summary: ${a.tc_current_state.certifications} certs as baseline.` });
  asks.push({ ask: '90-day checkpoint', why: 'Concrete review point to evaluate results and plan expansion.', connection: `Now: Creates urgency. Agenda: Commitments block. Skills Session: Next Steps block.` });
  userNotes.forEach(n => asks.push({ ask: n.text, why: n.url ? `Reference: ${n.url}` : 'Flagged for engagement.', connection: `Added topic. Included in both Agenda and Skills Session.` }));
  return asks;
}

export function AccountStory({ account, notes = [], onEngagePersona }: { account: Account; notes?: UserNote[]; onEngagePersona?: () => void }) {
  const a = account;
  const [showAgendaType, setShowAgendaType] = useState<'ebc' | 'training' | null>(null);
  const [topTab, setTopTab] = useState<TopTab>('approach');
  const [insightTab, setInsightTab] = useState<'now' | 'buzz' | null>(null);
  const isGreenfield = !a.tc_current_state.skill_builder;
  const spendGrowth = Math.round(((a.aws_spend.current_year - a.aws_spend.prior_year) / a.aws_spend.prior_year) * 100);

  const ebcAgenda = generateAgenda(a, notes);
  const trainingAgenda = generateTrainingSessionAgenda(a, notes);
  const nextSteps = generateNextSteps(a, notes);
  const keyAsks = generateKeyAsks(a, notes);

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      {showAgendaType === 'ebc' && <AgendaModal agenda={ebcAgenda} onClose={() => setShowAgendaType(null)} />}
      {showAgendaType === 'training' && <AgendaModal agenda={trainingAgenda} onClose={() => setShowAgendaType(null)} />}

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
                <div className="flex items-start gap-2.5">
                  <Users className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-white">Who should we focus on?</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.ebc_data.attendees.filter(att => a.public_intelligence.executive_social.find(e => e.name === att.name) || att.persona === 'CHRO' || att.persona === 'CEO')
                        .map(att => att.name + ' (' + att.title + ')').join(', ')} — strongest signals for workforce conversations.
                    </p>
                    <ConnectionToggle text={`Buzz: ${a.public_intelligence.executive_social[0] ? `${a.public_intelligence.executive_social[0].name} posted about "${a.public_intelligence.executive_social[0].post_theme}"` : 'Executive social signals detected'}. Agenda: These personas are featured in the suggested EBC agenda Welcome & Vision blocks.`} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MessageSquareText className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-white">What conversations should we drive?</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.signals[0] ? `Start with "${a.signals[0].label}" — ${a.signals[0].evidence}. ` : ''}
                      Lead with what we know: {a.public_intelligence.earnings_call_signals[0] ? `"${a.public_intelligence.earnings_call_signals[0].split(': ')[1] || a.public_intelligence.earnings_call_signals[0]}". ` : ''}
                      Ask where skills gaps are slowing down {a.sfdc_data.account_plan_priority}. Let them define the problem.
                    </p>
                    <ConnectionToggle text={`Now: ${a.signals[0]?.label || 'Top signal'} is the priority. Buzz: Earnings call signals and Glassdoor data support this angle. Skills Session: The Workforce Landscape block covers this data story.`} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Target className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-white">Where should we start?</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isGreenfield
                        ? `No structured training — ${a.tc_current_state.certifications} organic certs. Understand their workforce reality: who are the ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} roles they can't fill? The assessment is just a tool — the conversation is the value.`
                        : `Adoption stalled. Glassdoor says "${a.public_intelligence.glassdoor_signals[0]}". The conversation isn't about renewal — it's about redesigning how they develop people.`}
                    </p>
                    <ConnectionToggle text={`Summary: ${isGreenfield ? `${a.tc_current_state.certifications} organic certs, greenfield opportunity` : `Existing engagement at ${a.tc_current_state.activation_rate}% activation`}. Buzz: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles (${a.public_intelligence.linkedin_job_postings.yoy_change} YoY). Skills Session: Connects to the Non-Technical & Technical Roles blocks.`} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Globe className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-white">What's happening in their world?</span>
                    <p className="text-xs text-slate-400 mt-0.5">{a.public_intelligence.industry_context}. {a.public_intelligence.news_signals[0] || ''}</p>
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
                {nextSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <ArrowRight className="w-3 h-3 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-200 leading-relaxed">{step.text}</p>
                      <ConnectionToggle text={step.connection} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {topTab === 'key-asks' && (
              <div className="space-y-2.5">
                {keyAsks.map((item, i) => (
                  <div key={i} className="bg-navy-800/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs font-medium text-white">{item.ask}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed ml-[22px]">{item.why}</p>
                    <div className="ml-[22px]"><ConnectionToggle text={item.connection} /></div>
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
                  {/* Trends */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Trends to leverage</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-slate-300 pl-3 border-l-2 border-sky-500">{a.public_intelligence.industry_context}</p>
                      {a.public_intelligence.news_signals.map((s, i) => (
                        <p key={i} className="text-sm text-slate-400 pl-3 border-l-2 border-navy-600">{s}</p>
                      ))}
                    </div>
                  </div>
                  {/* Initiatives to focus on */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Initiatives to focus on</span>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-navy-700/50 rounded-lg p-3">
                        <span className="text-sm font-medium text-white">{a.sfdc_data.account_plan_priority}</span>
                        <p className="text-xs text-slate-400 mt-1">{a.sfdc_data.open_opps} open opportunities · {a.sfdc_data.smgs_phase} phase</p>
                      </div>
                      {a.signals.filter(s => s.severity === 'HIGH').map(s => (
                        <div key={s.label} className="flex items-start gap-2">
                          <span className="mt-1 w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                          <div>
                            <span className="text-xs font-medium text-white">{s.label}</span>
                            <p className="text-[11px] text-slate-400">{s.evidence}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Key asks right now */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Key asks for this moment</span>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm text-slate-300">→ Who is the executive sponsor for workforce development?</p>
                      <p className="text-sm text-slate-300">→ What's the timeline pressure on {a.sfdc_data.account_plan_priority}?</p>
                      <p className="text-sm text-slate-300">→ {isGreenfield ? 'Which teams are most critical to the transformation?' : 'Why has the current training engagement stalled?'}</p>
                      <p className="text-sm text-slate-300">→ What does success look like in 90 days?</p>
                    </div>
                  </div>
                  {/* Opening move */}
                  {a.public_intelligence.executive_social[0] && (
                    <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-3">
                      <span className="text-xs font-semibold text-sky-400">💡 Your opening</span>
                      <p className="text-sm text-slate-300 mt-1">{a.public_intelligence.executive_social[0].name} posted about "{a.public_intelligence.executive_social[0].post_theme}" — reference this to show you've done your homework.</p>
                    </div>
                  )}
                </div>
              )}
              {insightTab === 'buzz' && (
                <div className="space-y-4">
                  {/* Executive social */}
                  <div>
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Executive voices on LinkedIn</span>
                    <div className="space-y-3 mt-2">
                      {a.public_intelligence.executive_social.map(e => (
                        <div key={e.name} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-[10px] text-slate-300 font-bold shrink-0">{e.name.split(' ').map(w => w[0]).join('')}</div>
                          <div>
                            <span className="text-sm font-medium text-white">{e.name}</span>
                            <span className="text-xs text-slate-500 ml-1.5">{e.title}</span>
                            <p className="text-sm text-sky-400 italic mt-0.5">"{e.post_theme}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* LinkedIn trends */}
                  <div className="pt-3 border-t border-navy-600">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">LinkedIn hiring trends</span>
                    <div className="flex items-center gap-4 mt-2">
                      <div>
                        <span className="text-2xl font-bold text-white">{a.public_intelligence.linkedin_job_postings.cloud_ai_roles}</span>
                        <span className="text-xs text-slate-400 ml-1">cloud/AI roles</span>
                      </div>
                      <span className="text-sm text-emerald-400 font-semibold">{a.public_intelligence.linkedin_job_postings.yoy_change} YoY</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">This signals massive demand for cloud skills — they can't hire fast enough.</p>
                  </div>
                  {/* Industry news */}
                  <div className="pt-3 border-t border-navy-600">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Industry & news trends</span>
                    <div className="space-y-2 mt-2">
                      <p className="text-sm text-slate-300 pl-3 border-l-2 border-amber-500/50">{a.public_intelligence.industry_context}</p>
                      {a.public_intelligence.news_signals.map((s, i) => (
                        <p key={i} className="text-sm text-slate-400 pl-3 border-l-2 border-navy-600">{s}</p>
                      ))}
                    </div>
                  </div>
                  {/* Glassdoor */}
                  <div className="pt-3 border-t border-navy-600">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Employee sentiment (Glassdoor)</span>
                    <div className="space-y-2 mt-2">
                      {a.public_intelligence.glassdoor_signals.map((s, i) => (
                        <p key={i} className="text-sm text-slate-400 pl-3 border-l-2 border-navy-600">"{s}"</p>
                      ))}
                    </div>
                  </div>
                  {/* Earnings */}
                  <div className="pt-3 border-t border-navy-600">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Earnings call signals</span>
                    <div className="space-y-2 mt-2">
                      {a.public_intelligence.earnings_call_signals.map((s, i) => (
                        <p key={i} className="text-sm text-slate-400 pl-3 border-l-2 border-navy-600">{s}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={() => setShowAgendaType('ebc')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-navy-900 font-semibold text-xs active:opacity-90">
          <CalendarCheck className="w-4 h-4" />Suggest an Agenda
        </button>
        <button onClick={() => setShowAgendaType('training')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold text-xs active:opacity-90">
          <BookOpenCheck className="w-4 h-4" />Skills Session
        </button>
      </div>

      <div className="h-4" />
    </div>
  );
}
