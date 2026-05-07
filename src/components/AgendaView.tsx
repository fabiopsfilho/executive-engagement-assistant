import { useState, useEffect } from 'react';
import { Clock, MapPin, Calendar, BookOpen, Copy, Check, Download, ChevronDown, ChevronUp, StickyNote, Link2, Loader2 } from 'lucide-react';
import type { Account, Attendee, EngagementPlan } from '../types';
import type { AgendaBlock } from '../data/agendas';
import type { PersonaNote } from './PersonaView';
import { isBackendAvailable, generateAgenda as generateAgendaAPI } from '../services/api';

const typeColors: Record<AgendaBlock['type'], string> = {
  welcome: 'border-l-amber-500',
  discovery: 'border-l-sky-500',
  insight: 'border-l-violet-500',
  demo: 'border-l-emerald-500',
  workshop: 'border-l-rose-500',
  action: 'border-l-amber-500',
  break: 'border-l-slate-500',
};

function generatePersonaAgenda(account: Account, persona: Attendee, plan: EngagementPlan, userNotes: PersonaNote[] = []) {
  const a = account;
  const isGreenfield = !a.tc_current_state.skill_builder;

  const blocks: AgendaBlock[] = [
    {
      time: '9:00 AM', duration: '10 min', title: 'Welcome & Context Setting',
      description: `Open with ${plan.persona_name}'s own words — reference their public statements and social posts. Establish this as a strategic conversation about ${a.customer_name}'s workforce future, not a product discussion.`,
      owner: 'AWS Account Lead', type: 'welcome'
    },
    {
      time: '9:10 AM', duration: '20 min', title: `${plan.persona_name}'s Vision — Working Backwards`,
      description: `Ask: "If we fast-forward 18 months and your ${persona.persona === 'CFO' ? 'workforce investment has delivered measurable ROI' : persona.persona === 'CEO' ? 'transformation vision has been realized' : persona.persona === 'CHRO' ? 'talent strategy has closed the skills gap' : 'teams are fully cloud-capable'}, what does that look like?" Let ${plan.persona_name} paint the picture. Listen for the gap between vision and current reality.`,
      owner: plan.persona_name, type: 'discovery'
    },
    {
      time: '9:30 AM', duration: '15 min', title: 'The Intelligence Briefing',
      description: `Present the data story tailored to ${persona.persona}: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open cloud/AI roles (${a.public_intelligence.linkedin_job_postings.yoy_change} YoY), ${isGreenfield ? `only ${a.tc_current_state.certifications} organic certifications` : `${a.tc_current_state.activation_rate}% activation on ${a.tc_current_state.skill_builder_seats} seats`}. Frame as shared challenge using "Day 1" mindset.`,
      owner: 'AWS T&C Team', type: 'insight'
    },
    {
      time: '9:45 AM', duration: '20 min', title: 'The Conversation',
      description: plan.conversation_starters.map((s, i) => `${i + 1}. "${s.slice(0, 120)}..."`).join('\n'),
      owner: 'AWS T&C BDM', type: 'insight'
    },
    {
      time: '10:05 AM', duration: '10 min', title: 'Break',
      description: `Use for 1:1 with ${plan.persona_name}. The most valuable insights often come during informal moments.`,
      owner: 'All', type: 'break'
    },
    {
      time: '10:15 AM', duration: '20 min', title: 'Proof Points & Customer Stories',
      description: plan.proof_points.map(pp => `${pp.customer} (${pp.industry}): ${pp.metric} — ${pp.demonstrates}`).join('. ') + `. These are matched to ${plan.persona_name}'s role and ${a.industry} context.`,
      owner: 'AWS T&C Team', type: 'insight'
    },
    {
      time: '10:35 AM', duration: '20 min', title: 'Recommended Approach & Program Design',
      description: plan.recommended_plays.map(p => `${p.play_name}: ${p.description}`).join('. '),
      owner: 'AWS T&C BDM', type: 'demo'
    },
    {
      time: '10:55 AM', duration: '15 min', title: 'Investment Framework',
      description: `Present the phased investment: ${plan.revenue_estimate.map(r => `${r.offering} (${r.estimated_value})`).join(', ')}. Total pipeline: ${plan.total_pipeline}. Use "two-way door" framing — the pilot is reversible and low-risk.`,
      owner: 'AWS T&C BDM', type: 'insight'
    },
    {
      time: '11:10 AM', duration: '15 min', title: 'Commitments & Next Steps',
      description: `Secure specific commitments: AWS delivers detailed proposal in 2 weeks, schedules technical deep-dive, provides custom ROI model. ${plan.persona_name} identifies pilot team, secures executive sponsor, allocates learning time. Use "bias for action" — move fast on reversible decisions.`,
      owner: 'AWS Account Lead', type: 'action'
    },
  ];

  const result = {
    title: `Executive Meeting: ${plan.persona_name}`,
    subtitle: `${plan.persona_title} · ${a.customer_name}`,
    date: a.ebc_data.meeting_dates[0],
    location: a.ebc_data.location,
    duration: '2 hours',
    blocks,
    principles: [
      'Customer Obsession — Start with their vision, not our products',
      'Working Backwards — Define success first, then design the path',
      'Earn Trust — Be transparent, including uncomfortable truths',
      'Bias for Action — Leave with specific commitments',
    ],
    preparation: [
      `Review ${plan.persona_name}'s LinkedIn activity and public statements`,
      `Prepare custom data visualizations for ${persona.persona} perspective`,
      `Print leave-behind: ${persona.persona === 'CFO' ? '"The Training ROI Calculator"' : persona.persona === 'CEO' ? '"The Workforce of 2030" vision brief' : persona.persona === 'CHRO' ? '"The Workforce Readiness Imperative"' : '"Build Your Cloud Capability" one-pager'}`,
      `Pre-brief AWS team on ${a.sfdc_data.account_plan_priority}`,
      `Prepare ${plan.recommended_plays[0].play_name} proposal draft`,
      ...userNotes.map(n => `ADDED TOPIC: ${n.text}${n.url ? ` (ref: ${n.url})` : ''}`)
    ]
  };

  // Inject user notes as an agenda block
  if (userNotes.length > 0) {
    const noteTopics = userNotes.map(n => n.text).join('; ');
    const noteUrls = userNotes.filter(n => n.url).map(n => n.url).join(', ');
    const insertIdx = result.blocks.findIndex(b => b.title.includes('Commitments'));
    const noteBlock: AgendaBlock = {
      time: '11:00 AM', duration: '10 min',
      title: 'Additional Topics & Discussion',
      description: `Address the following topics: ${noteTopics}.${noteUrls ? ` Reference materials: ${noteUrls}.` : ''} Integrate these naturally into the conversation with ${plan.persona_name}.`,
      owner: 'AWS Account Team', type: 'discovery'
    };
    if (insertIdx >= 0) result.blocks.splice(insertIdx, 0, noteBlock);
    else result.blocks.splice(result.blocks.length - 1, 0, noteBlock);
  }

  return result;
}

function exportAgendaHTML(agenda: ReturnType<typeof generatePersonaAgenda>) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${agenda.title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a1628;color:#e2e8f0;padding:2rem;max-width:700px;margin:0 auto}
h1{font-size:1.5rem;color:#fff;margin-bottom:.25rem}
.sub{color:#94a3b8;font-size:.85rem;margin-bottom:1.5rem}
.meta{display:flex;gap:1rem;color:#64748b;font-size:.75rem;margin-bottom:2rem;flex-wrap:wrap}
.block{border-left:3px solid #334155;padding:.75rem 1rem;margin-bottom:1rem;background:rgba(17,29,53,.8);border-radius:0 .5rem .5rem 0}
.block .time{font-family:monospace;color:#fbbf24;font-size:.8rem}
.block .dur{color:#64748b;font-size:.75rem;margin-left:.5rem}
.block h3{font-size:.9rem;color:#fff;margin:.25rem 0}
.block p{font-size:.8rem;color:#94a3b8;line-height:1.5}
.block .owner{font-size:.7rem;color:#475569;margin-top:.25rem}
.section{font-size:.7rem;color:#fbbf24;text-transform:uppercase;letter-spacing:.1em;margin:1.5rem 0 .5rem}
.prep li{font-size:.8rem;color:#94a3b8;margin-bottom:.25rem;padding-left:.5rem}
@media print{body{background:#fff;color:#1e293b}.block{background:#f8fafc;border-color:#e2e8f0}.block h3{color:#0f172a}.block p,.prep li{color:#475569}}
</style></head><body>
<h1>${agenda.title}</h1>
<div class="sub">${agenda.subtitle}</div>
<div class="meta"><span>📅 ${agenda.date}</span><span>📍 ${agenda.location}</span><span>⏱ ${agenda.duration}</span></div>
<div class="section">Agenda</div>
${agenda.blocks.map(b => `<div class="block"><span class="time">${b.time}</span><span class="dur">${b.duration}</span><h3>${b.title}</h3><p>${b.description}</p><div class="owner">Owner: ${b.owner}</div></div>`).join('')}
<div class="section">Preparation Checklist</div>
<ul class="prep">${agenda.preparation.map(p => `<li>${p}</li>`).join('')}</ul>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${agenda.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AgendaView({ account, persona, plan, notes = [] }: { account: Account; persona: Attendee; plan: EngagementPlan; notes?: PersonaNote[] }) {
  const localAgenda = generatePersonaAgenda(account, persona, plan, notes);
  const [agenda, setAgenda] = useState(localAgenda);
  const [loading, setLoading] = useState(false);
  const [showPrep, setShowPrep] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch AI-generated agenda from backend
  useEffect(() => {
    if (!isBackendAvailable()) return;
    setLoading(true);
    const a = account;
    const isGreenfield = !a.tc_current_state.skill_builder;
    const tcState = isGreenfield
      ? `Greenfield: ${a.tc_current_state.certifications} organic certs, no structured program`
      : `Existing: ${a.tc_current_state.skill_builder_seats} Skill Builder seats, ${a.tc_current_state.activation_rate}% activation, renewal: ${a.tc_current_state.renewal_date || 'N/A'}`;
    const signalsSummary = a.signals.map(s => `[${s.severity}] ${s.label}: ${s.evidence}`).join('; ');
    const piSummary = [
      a.public_intelligence.earnings_call_signals[0] || '',
      `LinkedIn: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} cloud/AI roles (${a.public_intelligence.linkedin_job_postings.yoy_change} YoY)`,
      a.public_intelligence.executive_social.map(e => `${e.name}: "${e.post_theme}"`).join(', '),
      a.public_intelligence.glassdoor_signals[0] || '',
      a.public_intelligence.industry_context,
    ].filter(Boolean).join('. ');

    generateAgendaAPI(
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
      'ebc',
      { name: persona.name, title: persona.title, persona: persona.persona },
      notes.map(n => n.text)
    ).then(result => {
      if (result.blocks && result.blocks.length > 0) {
        setAgenda({
          title: result.title || localAgenda.title,
          subtitle: result.subtitle || localAgenda.subtitle,
          date: result.date || localAgenda.date,
          location: result.location || localAgenda.location,
          duration: result.duration || localAgenda.duration,
          blocks: result.blocks.map(b => ({
            time: b.time,
            duration: b.duration,
            title: b.title,
            description: b.description,
            owner: b.owner,
            type: b.type as AgendaBlock['type'],
          })),
          principles: result.principles || localAgenda.principles,
          preparation: result.preparation || localAgenda.preparation,
        });
      }
    }).catch(err => {
      console.warn('Failed to generate AI agenda, using local:', err);
    }).finally(() => {
      setLoading(false);
    });
  }, [account.customer_name, persona.name]);

  const fullText = [
    agenda.title, agenda.subtitle,
    `Date: ${agenda.date} | Location: ${agenda.location} | Duration: ${agenda.duration}`,
    '', 'AGENDA:',
    ...agenda.blocks.map(b => `${b.time} (${b.duration}) — ${b.title}\n${b.description}\nOwner: ${b.owner}`),
    '', 'PREPARATION:', ...agenda.preparation.map(p => `• ${p}`)
  ].join('\n');

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <span className="text-sm text-slate-400">Generating AI-powered agenda...</span>
        <span className="text-xs text-slate-500">Grounding in real data from LinkedIn, Glassdoor, news & AWS Knowledge Base</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Notes from persona */}
      {notes.length > 0 && (
        <div className="mb-4 bg-violet-500/5 border border-violet-500/15 rounded-xl p-3">
          <span className="text-[11px] text-violet-400 font-semibold uppercase tracking-wider">Your Notes for This Agenda</span>
          <div className="space-y-1.5 mt-2">
            {notes.map(n => (
              <div key={n.id} className="flex items-start gap-2">
                <StickyNote className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-200">{n.text}</p>
                  {n.url && <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-400 flex items-center gap-1 truncate"><Link2 className="w-3 h-3 shrink-0" />{n.url}</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{agenda.date}</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{agenda.location}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{agenda.duration}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { navigator.clipboard.writeText(fullText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 border border-navy-600 text-xs text-slate-300 active:bg-navy-700"
            aria-label="Copy agenda"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => exportAgendaHTML(agenda)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-xs text-navy-900 font-semibold active:opacity-90"
            aria-label="Export agenda"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Principles */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Leadership Principles</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {agenda.principles.map(p => (
            <span key={p} className="text-[11px] px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-lg">{p.split(' — ')[0]}</span>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2.5 mb-5">
        {agenda.blocks.map((block, i) => (
          <div key={i} className={`border-l-2 ${typeColors[block.type]} bg-navy-800 rounded-r-xl p-3.5`}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono text-amber-400">{block.time}</span>
              <span className="text-[11px] text-slate-500">{block.duration}</span>
            </div>
            <h4 className="text-sm font-medium text-white mb-1">{block.title}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{block.description}</p>
            <div className="text-[11px] text-slate-500 mt-1.5">Owner: {block.owner}</div>
          </div>
        ))}
      </div>

      {/* Preparation */}
      <button
        onClick={() => setShowPrep(!showPrep)}
        className="flex items-center gap-2 w-full text-left mb-3"
        aria-expanded={showPrep}
      >
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Preparation Checklist</span>
        {showPrep ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {showPrep && (
        <div className="space-y-2 pb-6">
          {agenda.preparation.map((note, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
              <span className="w-5 h-5 rounded bg-navy-700 flex items-center justify-center text-[11px] text-slate-400 shrink-0 mt-0.5">{i + 1}</span>
              {note}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
