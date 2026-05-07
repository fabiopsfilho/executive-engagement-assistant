import { useState, useEffect, useRef } from 'react';
import { BookOpen, Presentation, CalendarClock, Plus, X, Link2, StickyNote, RefreshCw, Send, MessageCircle, Zap, Loader2 } from 'lucide-react';
import type { Account, Attendee } from '../types';
import { engagementPlans } from '../data/engagementPlans';
import { PersonaStory } from './PersonaStory';
import { PitchView } from './PitchView';
import { AgendaView } from './AgendaView';
import { isBackendAvailable, sendRolePlayMessage, getPersonaIntel, type PersonaIntelResponse } from '../services/api';

type Tab = 'conversation' | 'story' | 'pitch' | 'agenda';

export interface PersonaNote {
  id: string;
  text: string;
  url?: string;
}

const personaGradients: Record<string, string> = {
  CEO: 'from-amber-500 to-orange-500',
  CFO: 'from-emerald-500 to-teal-500',
  CIO: 'from-sky-500 to-blue-500',
  CTO: 'from-violet-500 to-purple-500',
  CHRO: 'from-rose-500 to-pink-500',
  Other: 'from-slate-500 to-gray-500',
};

interface ChatMsg { role: 'you' | 'persona'; text: string }

function getRolePlayResponse(q: string, a: Account, persona: Attendee): string {
  const social = a.public_intelligence.executive_social.find(e => e.name === persona.name);
  const lq = q.toLowerCase();

  if (persona.persona === 'CEO') {
    if (lq.includes('training') || lq.includes('workforce') || lq.includes('skills') || lq.includes('people'))
      return `"I appreciate you raising this. We're making a big bet on ${a.sfdc_data.account_plan_priority}, and I know our people need to keep pace. But I've seen training programs come and go — what makes this different?"\n\n💡 They're engaged. Address "what's different" with proof points and program design specifics.`;
    if (lq.includes('roi') || lq.includes('invest') || lq.includes('cost'))
      return `"The board is watching every dollar. I need this to be a multiplier on our ${a.aws_spend.ppa} commitment, not an additional cost. Show me how it connects to our timeline."\n\n💡 Use Forrester 229% ROI. Connect training to ${a.sfdc_data.account_plan_priority} delivery acceleration.`;
    return `"${social ? `As I mentioned in my recent talk about '${social.post_theme}', ` : ''}we're at a critical point. How does workforce development fit into the competitive landscape? What are our peers doing?"\n\n💡 They want competitive context. Reference what similar ${a.industry} organizations are doing.`;
  }
  if (persona.persona === 'CFO') {
    if (lq.includes('roi') || lq.includes('return') || lq.includes('number'))
      return `"229% ROI sounds impressive, but that's a benchmark. I need the math for ${a.customer_name} specifically. What are the assumptions?"\n\n💡 Offer to build a custom ROI model. Use their ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles as the starting point.`;
    return `"Every dollar needs to justify itself. We have ${a.sfdc_data.open_opps} open opportunities and a major transformation. What's the payback period?"\n\n💡 Lead with phased approach — pilot is low-risk, reversible. CFOs love optionality.`;
  }
  if (persona.persona === 'CHRO') {
    if (lq.includes('retention') || lq.includes('talent') || lq.includes('people') || lq.includes('culture'))
      return `"You're speaking my language. We're losing people to competitors who offer better growth. ${social ? `I've been vocal about '${social.post_theme}'. ` : ''}But I need a program, not just a platform."\n\n💡 They're your champion. Focus on program design. Holcim's 85% participation came from dedicated learning time.`;
    return `"I've been pushing for more investment in our people, but I need to show results. What does success look like in 90 days?"\n\n💡 Give them ammunition for internal advocacy. Define clear 90-day metrics.`;
  }
  if (persona.persona === 'CTO' || persona.persona === 'CIO') {
    if (lq.includes('technical') || lq.includes('engineer') || lq.includes('skill') || lq.includes('team'))
      return `"My teams are smart but stretched thin. We have ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles. ${social ? `As I wrote about — '${social.post_theme}'. ` : ''}I need something that accelerates delivery, not just checks a training box."\n\n💡 Frame everything as delivery acceleration. UNSW's 70% skill uplift is your proof point.`;
    return `"I've seen too many training programs that don't connect to real work. If we do this, it needs to map to our actual ${a.sfdc_data.account_plan_priority} workstreams."\n\n💡 Propose role-based learning paths aligned to their transformation. This differentiates from generic training.`;
  }
  return `"From my perspective as ${persona.title}, I'm most concerned about how this impacts my team's ability to deliver. Can you be specific?"\n\n💡 Ask about their team's specific skills gaps and connect to their functional goals.`;
}

export function PersonaView({ account, persona }: { account: Account; persona: Attendee }) {
  const [tab, setTab] = useState<Tab>('conversation');
  const [notes, setNotes] = useState<PersonaNote[]>([]);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteUrl, setNoteUrl] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showPersonaNow, setShowPersonaNow] = useState(false);
  const [personaIntel, setPersonaIntel] = useState<PersonaIntelResponse | null>(null);
  const [personaIntelLoading, setPersonaIntelLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const key = `${account.customer_name}::${persona.persona}`;
  const plan = engagementPlans[key];
  const gradient = personaGradients[persona.persona] || personaGradients.Other;
  const social = account.public_intelligence.executive_social.find(e => e.name === persona.name);

  // Initial greeting from persona
  useEffect(() => {
    setChatMessages([{
      role: 'persona',
      text: `[${persona.name}]: "Thanks for making time. ${social ? `As you may have seen, I've been thinking a lot about '${social.post_theme}'. ` : ''}I'm curious what AWS has in mind for ${account.customer_name}. What's on your agenda today?"\n\n💡 Start with their priorities, not yours. Reference something specific about them.`
    }]);
  }, [persona.name]);

  // Fetch persona intelligence when persona is selected
  useEffect(() => {
    if (!isBackendAvailable()) return;
    setPersonaIntelLoading(true);
    getPersonaIntel(persona.name, persona.title, account.customer_name, account.industry)
      .then(intel => setPersonaIntel(intel))
      .catch(() => setPersonaIntel(null))
      .finally(() => setPersonaIntelLoading(false));
  }, [persona.name, account.customer_name]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages]);

  const sendChat = () => {
    const q = chatInput.trim();
    if (!q) return;
    setChatMessages(prev => [...prev, { role: 'you', text: q }]);
    setChatInput('');

    if (isBackendAvailable()) {
      // Use real Bedrock-powered role-play
      const social = account.public_intelligence.executive_social.find(e => e.name === persona.name);
      const history = chatMessages.map(m => ({
        role: m.role === 'you' ? 'user' as const : 'assistant' as const,
        content: m.text,
      }));
      sendRolePlayMessage(
        q,
        history,
        { name: persona.name, title: persona.title, persona: persona.persona },
        {
          customer_name: account.customer_name,
          industry: account.industry,
          aws_spend_current: account.aws_spend.current_year,
          ppa: account.aws_spend.ppa,
          account_plan_priority: account.sfdc_data.account_plan_priority,
          open_opps: account.sfdc_data.open_opps,
          linkedin_roles: account.public_intelligence.linkedin_job_postings.cloud_ai_roles,
          linkedin_yoy: account.public_intelligence.linkedin_job_postings.yoy_change,
          executive_social_theme: social?.post_theme,
          glassdoor_signals: account.public_intelligence.glassdoor_signals,
          earnings_signals: account.public_intelligence.earnings_call_signals,
          tc_state: account.tc_current_state.skill_builder
            ? `${account.tc_current_state.skill_builder_seats} Skill Builder seats at ${account.tc_current_state.activation_rate}% activation`
            : `Greenfield — ${account.tc_current_state.certifications} organic certs, no structured program`,
          industry_context: account.public_intelligence.industry_context,
        }
      ).then(result => {
        setChatMessages(prev => [...prev, { role: 'persona', text: result.response }]);
      }).catch(() => {
        // Fallback to mock
        setChatMessages(prev => [...prev, { role: 'persona', text: getRolePlayResponse(q, account, persona) }]);
      });
    } else {
      // Use mock role-play
      setTimeout(() => {
        setChatMessages(prev => [...prev, { role: 'persona', text: getRolePlayResponse(q, account, persona) }]);
      }, 400);
    }
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    setNotes(prev => [...prev, { id: Date.now().toString(), text: noteText.trim(), url: noteUrl.trim() || undefined }]);
    setNoteText('');
    setNoteUrl('');
    setShowNoteInput(false);
  };
  const removeNote = (id: string) => setNotes(prev => prev.filter(n => n.id !== id));

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'conversation', label: 'Talk', icon: MessageCircle },
    { id: 'story', label: 'Story', icon: BookOpen },
    { id: 'pitch', label: 'Pitch', icon: Presentation },
    { id: 'agenda', label: 'Agenda', icon: CalendarClock },
  ];

  if (!plan) {
    return (
      <div>
        {/* Persona hero */}
        <div className="px-4 pt-4 pb-3">
          <div className={`bg-gradient-to-r ${gradient} p-[1px] rounded-xl`}>
            <div className="bg-navy-800 rounded-xl p-3 flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                {persona.persona}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{persona.name}</div>
                <div className="text-[11px] text-slate-400">{persona.title}</div>
              </div>
            </div>
          </div>
        </div>
        {/* Chat-only mode for live accounts without pre-built plans */}
        {/* Persona Intelligence Panel */}
        {(personaIntelLoading || personaIntel) && (
          <div className="px-4 py-3">
            <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5 space-y-2.5">
              {personaIntelLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  <span>Researching {persona.name} online...</span>
                </div>
              ) : personaIntel && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Intel</span>
                    {personaIntel.is_aws_champion && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-orange-500/15 text-orange-400 rounded-full font-medium">AWS Champion</span>
                    )}
                  </div>
                  {personaIntel.linkedin_summary && personaIntel.linkedin_summary !== 'No LinkedIn data found' && (
                    <p className="text-xs text-slate-300">{personaIntel.linkedin_summary}</p>
                  )}
                  {personaIntel.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {personaIntel.interests.slice(0, 5).map((interest, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">{interest}</span>
                      ))}
                    </div>
                  )}
                  {personaIntel.recent_activity.length > 0 && (
                    <div>
                      <span className="text-[10px] text-muted uppercase">Recent activity</span>
                      <div className="space-y-1 mt-1">
                        {personaIntel.recent_activity.slice(0, 3).map((activity, i) => (
                          <p key={i} className="text-[11px] text-slate-400 pl-2 border-l-2 border-purple-500/20">{activity}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {personaIntel.engagement_angle && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
                      <span className="text-[10px] font-semibold text-blue-400 uppercase">💡 Engagement angle</span>
                      <p className="text-xs text-slate-300 mt-1">{personaIntel.engagement_angle}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <div className="px-4 py-3">
          <div ref={chatRef} className="space-y-3 max-h-[55vh] overflow-y-auto mb-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'you' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                  msg.role === 'you'
                    ? 'bg-amber-500/15 text-amber-200 rounded-br-md'
                    : `bg-dark-800 border border-dark-600 text-slate-200 rounded-bl-md`
                }`}>
                  <p className="text-xs leading-relaxed whitespace-pre-line">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder={`Talk to ${persona.persona} at ${account.customer_name}...`}
              className="flex-1 px-3.5 py-2.5 bg-dark-800 border border-dark-600 rounded-full text-sm text-white placeholder-muted focus:outline-none focus:border-purple-400/50" />
            <button onClick={sendChat}
              className={`w-10 h-10 rounded-full bg-gradient-to-r ${gradient} flex items-center justify-center active:opacity-80 shrink-0`}>
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Persona hero */}
      <div className="px-4 pt-4 pb-3">
        <div className={`bg-gradient-to-r ${gradient} p-[1px] rounded-xl`}>
          <div className="bg-navy-800 rounded-xl p-3 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
              {persona.persona}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">{persona.name}</div>
              <div className="text-[11px] text-slate-400">{persona.title}</div>
              {social && <div className="text-[10px] text-sky-400 mt-0.5 italic truncate">"{social.post_theme}"</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Persona Intelligence Panel */}
      {(personaIntelLoading || personaIntel) && (
        <div className="px-4 pb-3">
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-3.5 space-y-2.5">
            {personaIntelLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                <span>Researching {persona.name} online...</span>
              </div>
            ) : personaIntel && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Intel</span>
                  {personaIntel.is_aws_champion && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-orange-500/15 text-orange-400 rounded-full font-medium">AWS Champion</span>
                  )}
                </div>
                {personaIntel.linkedin_summary && personaIntel.linkedin_summary !== 'No LinkedIn data found' && (
                  <p className="text-xs text-slate-300">{personaIntel.linkedin_summary}</p>
                )}
                {personaIntel.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {personaIntel.interests.slice(0, 5).map((interest, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">{interest}</span>
                    ))}
                  </div>
                )}
                {personaIntel.recent_activity.length > 0 && (
                  <div>
                    <span className="text-[10px] text-muted uppercase">Recent activity</span>
                    <div className="space-y-1 mt-1">
                      {personaIntel.recent_activity.slice(0, 3).map((activity, i) => (
                        <p key={i} className="text-[11px] text-slate-400 pl-2 border-l-2 border-purple-500/20">{activity}</p>
                      ))}
                    </div>
                  </div>
                )}
                {personaIntel.engagement_angle && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
                    <span className="text-[10px] font-semibold text-blue-400 uppercase">💡 Engagement angle</span>
                    <p className="text-xs text-slate-300 mt-1">{personaIntel.engagement_angle}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="sticky top-[53px] z-40 bg-navy-900 border-b border-navy-700">
        <div className="flex">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors relative ${
                tab === t.id ? 'text-amber-400' : 'text-slate-400 active:text-slate-300'
              }`} role="tab" aria-selected={tab === t.id}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
              {tab === t.id && <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-amber-400 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation tab — role-play chat */}
      {tab === 'conversation' && (
        <div className="px-4 py-3">
          <div ref={chatRef} className="space-y-3 max-h-[55vh] overflow-y-auto mb-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'you' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                  msg.role === 'you'
                    ? 'bg-amber-500/15 text-amber-200 rounded-br-md'
                    : `bg-dark-800 border border-dark-600 text-slate-200 rounded-bl-md`
                }`}>
                  <p className="text-xs leading-relaxed whitespace-pre-line">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder={`Say something to ${persona.name.split(' ')[0]}...`}
              className="flex-1 px-3.5 py-2.5 bg-dark-800 border border-dark-600 rounded-full text-sm text-white placeholder-muted focus:outline-none focus:border-purple-400/50" />
            <button onClick={sendChat}
              className={`w-10 h-10 rounded-full bg-gradient-to-r ${gradient} flex items-center justify-center active:opacity-80 shrink-0`}>
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Now button for this persona */}
          <button onClick={() => setShowPersonaNow(!showPersonaNow)}
            className={`w-full flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl border ${showPersonaNow ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-dark-800 border-dark-600 text-muted'} text-xs font-medium active:opacity-80`}>
            <Zap className="w-4 h-4" />
            {showPersonaNow ? 'Hide Now' : `Now — What to know about ${persona.name.split(' ')[0]}`}
          </button>

          {/* Persona-specific Now panel */}
          {showPersonaNow && (
            <div className="mt-3 bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 space-y-3 animate-fade-in">
              {/* Their social activity */}
              {social && (
                <div>
                  <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Their latest post</span>
                  <p className="text-sm text-white italic mt-1">"{social.post_theme}"</p>
                  <p className="text-[11px] text-muted mt-0.5">Use this as your opening — it shows you've done your homework.</p>
                </div>
              )}

              {/* What they care about based on persona */}
              <div>
                <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">What {persona.name.split(' ')[0]} cares about</span>
                <div className="space-y-1.5 mt-1.5">
                  {persona.persona === 'CEO' && <>
                    <p className="text-xs text-slate-300">→ Competitive positioning and market leadership</p>
                    <p className="text-xs text-slate-300">→ Transformation timeline and execution speed</p>
                    <p className="text-xs text-slate-300">→ Board confidence in the cloud investment</p>
                  </>}
                  {persona.persona === 'CFO' && <>
                    <p className="text-xs text-slate-300">→ ROI on cloud and training investments</p>
                    <p className="text-xs text-slate-300">→ Build vs. buy economics for talent</p>
                    <p className="text-xs text-slate-300">→ Board-ready data and payback periods</p>
                  </>}
                  {persona.persona === 'CHRO' && <>
                    <p className="text-xs text-slate-300">→ Talent retention and employer brand</p>
                    <p className="text-xs text-slate-300">→ Scaling workforce development programs</p>
                    <p className="text-xs text-slate-300">→ Dedicated learning time and manager accountability</p>
                  </>}
                  {(persona.persona === 'CTO' || persona.persona === 'CIO') && <>
                    <p className="text-xs text-slate-300">→ Time-to-competency and delivery speed</p>
                    <p className="text-xs text-slate-300">→ Filling the {account.public_intelligence.linkedin_job_postings.cloud_ai_roles} open cloud/AI roles</p>
                    <p className="text-xs text-slate-300">→ Role-based skills aligned to {account.sfdc_data.account_plan_priority}</p>
                  </>}
                  {persona.persona === 'Other' && <>
                    <p className="text-xs text-slate-300">→ Their team's specific skills gaps</p>
                    <p className="text-xs text-slate-300">→ How training connects to their functional goals</p>
                  </>}
                </div>
              </div>

              {/* Relevant signals */}
              <div>
                <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Signals relevant to {persona.persona}</span>
                <div className="space-y-1.5 mt-1.5">
                  {account.signals.filter(s => {
                    if (persona.persona === 'CHRO') return s.label.includes('Talent') || s.label.includes('Subscription');
                    if (persona.persona === 'CFO') return s.label.includes('Board') || s.label.includes('ROI');
                    if (persona.persona === 'CEO') return s.severity === 'HIGH';
                    if (persona.persona === 'CTO' || persona.persona === 'CIO') return s.label.includes('Talent') || s.label.includes('Greenfield');
                    return true;
                  }).slice(0, 3).map(s => (
                    <div key={s.label} className="flex items-start gap-2">
                      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${s.severity === 'HIGH' ? 'bg-red-400' : 'bg-orange-400'}`} />
                      <div><span className="text-xs text-white font-medium">{s.label}</span><p className="text-[11px] text-muted">{s.evidence.split(';')[0]}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key ask for this persona */}
              <div>
                <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Key ask for {persona.name.split(' ')[0]}</span>
                <p className="text-xs text-slate-300 mt-1">
                  {persona.persona === 'CEO' ? `"What does the workforce of 2030 look like for ${account.customer_name}?"` :
                   persona.persona === 'CFO' ? `"How are you factoring workforce readiness into your transformation financial model?"` :
                   persona.persona === 'CHRO' ? `"What would it take to make training work for your teams at scale?"` :
                   persona.persona === 'CTO' || persona.persona === 'CIO' ? `"Which roles are the biggest bottleneck on your transformation timeline?"` :
                   `"What skills does your team need most to deliver on ${account.sfdc_data.account_plan_priority}?"`}
                </p>
              </div>

              {/* Industry context */}
              <div className="pt-2 border-t border-blue-500/10">
                <span className="text-[10px] text-muted uppercase">Industry context</span>
                <p className="text-xs text-slate-300 mt-1">{account.public_intelligence.industry_context.split(';')[0]}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Other tabs */}
      {tab !== 'conversation' && (
        <>
          {/* Notes */}
          <div className="px-4 pt-3">
            {notes.length > 0 && (
              <div className="space-y-2 mb-2">
                {notes.map(n => (
                  <div key={n.id} className="flex items-start gap-2 bg-navy-800 border border-navy-600 rounded-lg p-2.5">
                    <StickyNote className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-200">{n.text}</p>
                      {n.url && <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-400 flex items-center gap-1 mt-0.5 truncate"><Link2 className="w-3 h-3 shrink-0" />{n.url}</a>}
                    </div>
                    <button onClick={() => removeNote(n.id)} className="p-1 rounded active:bg-navy-700 shrink-0"><X className="w-3 h-3 text-slate-500" /></button>
                  </div>
                ))}
                <button onClick={() => setRefreshKey(k => k + 1)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium active:opacity-80">
                  <RefreshCw className="w-3.5 h-3.5" />Regenerate
                </button>
              </div>
            )}
            {showNoteInput ? (
              <div className="bg-navy-800 border border-violet-500/30 rounded-xl p-3 mb-3 space-y-2">
                <input type="text" placeholder="Add a topic..." value={noteText} onChange={e => setNoteText(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-900/50 border border-navy-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none" autoFocus />
                <input type="url" placeholder="URL (optional)" value={noteUrl} onChange={e => setNoteUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-900/50 border border-navy-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={addNote} className="flex-1 py-2 rounded-lg bg-violet-500 text-white text-xs font-semibold">Add</button>
                  <button onClick={() => { setShowNoteInput(false); setNoteText(''); setNoteUrl(''); }} className="px-4 py-2 rounded-lg border border-navy-600 text-xs text-slate-400">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowNoteInput(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-navy-600 text-xs text-slate-500 active:bg-navy-800 mb-1">
                <Plus className="w-3.5 h-3.5" />Add topic or reference
              </button>
            )}
          </div>
          <div className="px-4 py-3">
            {tab === 'story' && <PersonaStory key={refreshKey} account={account} persona={persona} plan={plan} />}
            {tab === 'pitch' && <PitchView key={`p-${refreshKey}`} account={account} persona={persona} plan={plan} notes={notes} />}
            {tab === 'agenda' && <AgendaView key={`a-${refreshKey}`} account={account} persona={persona} plan={plan} notes={notes} />}
          </div>
        </>
      )}
    </div>
  );
}
