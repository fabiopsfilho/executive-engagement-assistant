import { useState, useEffect, useRef } from 'react';
import { BookOpen, Presentation, CalendarClock, Plus, X, Link2, StickyNote, RefreshCw, Send, MessageCircle } from 'lucide-react';
import type { Account, Attendee } from '../types';
import { engagementPlans } from '../data/engagementPlans';
import { PersonaStory } from './PersonaStory';
import { PitchView } from './PitchView';
import { AgendaView } from './AgendaView';

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

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages]);

  const sendChat = () => {
    const q = chatInput.trim();
    if (!q) return;
    setChatMessages(prev => [...prev, { role: 'you', text: q }]);
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: 'persona', text: getRolePlayResponse(q, account, persona) }]);
    }, 400);
    setChatInput('');
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
      <div className="px-4 py-12 text-center">
        <p className="text-slate-400 text-sm">
          Engagement plan for {persona.name} ({persona.persona}) will be generated when connected to Amazon Bedrock.
        </p>
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
                    : `bg-navy-800 border border-navy-600 text-slate-200 rounded-bl-md`
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
              className="flex-1 px-3.5 py-2.5 bg-navy-800 border border-navy-600 rounded-full text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50" />
            <button onClick={sendChat}
              className={`w-10 h-10 rounded-full bg-gradient-to-r ${gradient} flex items-center justify-center active:opacity-80 shrink-0`}>
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
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
