import { useState, useEffect, useRef } from 'react';
import { Send, Bot } from 'lucide-react';
import type { Account } from '../types';
import { isBackendAvailable, sendAdvisorMessage } from '../services/api';

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;
}

interface Message {
  role: 'user' | 'advisor';
  text: string;
}

function getResponse(q: string, a: Account): string {
  const lq = q.toLowerCase();
  const isGreenfield = !a.tc_current_state.skill_builder;

  if (lq.includes('signal') || lq.includes('what\'s happening') || lq.includes('going on') || lq.includes('status')) {
    return `Here's what's happening with ${a.customer_name} right now:\n\n${a.signals.map(s => `${s.severity === 'HIGH' ? '🔴' : '🟡'} ${s.label} — ${s.evidence}`).join('\n\n')}\n\n${a.public_intelligence.news_signals[0] ? `Latest news: ${a.public_intelligence.news_signals[0]}` : ''}`;
  }

  if (lq.includes('who') || lq.includes('focus') || lq.includes('persona') || lq.includes('talk to')) {
    const chro = a.ebc_data.attendees.find(att => att.persona === 'CHRO');
    const ceo = a.ebc_data.attendees.find(att => att.persona === 'CEO');
    const primary = chro || ceo || a.ebc_data.attendees[0];
    const social = a.public_intelligence.executive_social.find(e => e.name === primary.name);
    return `I'd focus on ${primary.name} (${primary.title}) first.\n\n${social ? `They recently posted about "${social.post_theme}" — that's your opening.` : 'They\'re in the best position to champion a workforce initiative.'}\n\nSecondary: ${a.ebc_data.attendees.filter(att => att.name !== primary.name).slice(0, 2).map(att => `${att.name} (${att.persona})`).join(', ')}.\n\nTap their name in the persona strip above to see the full engagement plan and practice the conversation.`;
  }

  if (lq.includes('objection') || lq.includes('pushback') || lq.includes('handle') || lq.includes('concern')) {
    return `Most likely objections from ${a.customer_name}:\n\n❌ "No time for training"\n→ Unstructured learning wastes more time. Forrester: 229% ROI, <6 month payback.\n\n❌ "We can hire the skills"\n→ ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles growing ${a.public_intelligence.linkedin_job_postings.yoy_change} YoY. The market can't deliver at this scale.\n\n❌ "Show me ROI first"\n→ Forrester validated 229% ROI. Let's build a model specific to ${a.customer_name}.`;
  }

  if (lq.includes('roi') || lq.includes('cost') || lq.includes('money') || lq.includes('invest') || lq.includes('budget')) {
    return `ROI framing for ${a.customer_name}:\n\n• External hire: ~$200K per cloud/AI role\n• Internal training: ~$10K per person\n• ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} roles = ${fmt(a.public_intelligence.linkedin_job_postings.cloud_ai_roles * 200000)} hiring vs ${fmt(a.public_intelligence.linkedin_job_postings.cloud_ai_roles * 10000)} training\n• Forrester: 229% ROI, <6 month payback\n• Certified teams deliver 20% faster`;
  }

  if (lq.includes('follow') || lq.includes('after') || lq.includes('next') || lq.includes('action')) {
    return `After engaging ${a.customer_name}:\n\n1. Thank-you within 24 hours — reference specific topics\n2. Proposal in 10 business days (program design + ROI model)\n3. Technical deep-dive with CTO/CIO in 2 weeks\n4. Pilot launch within 30 days\n5. 90-day checkpoint to review results and plan expansion`;
  }

  if (lq.includes('email') || lq.includes('write') || lq.includes('draft') || lq.includes('template')) {
    return `Subject: ${a.customer_name} × AWS — Next Steps\n\nThank you for the conversation about your workforce strategy.\n\nAgreed next steps:\n1. AWS delivers tailored proposal in 10 business days\n2. Technical deep-dive with your team in 2 weeks\n3. Board-ready summary connecting workforce investment to ${a.sfdc_data.account_plan_priority}\n\nPlease confirm the executive sponsor — that's the key to program success.\n\nBest regards`;
  }

  if (lq.includes('start') || lq.includes('where') || lq.includes('begin') || lq.includes('approach')) {
    return `Where to start with ${a.customer_name}:\n\n${isGreenfield
      ? `They have zero structured training. Don't lead with products — lead with their reality: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles they can't fill, and a ${a.sfdc_data.account_plan_priority} initiative that needs skilled people.\n\nAsk: "Where are the skills gaps slowing you down?" Let them define the problem. The assessment is just a tool — the conversation is the value.`
      : `Their current training isn't working — adoption stalled. Be transparent about it. Ask: "What would it take to make this work for your teams?" The answer is usually dedicated time and manager support.\n\nReframe from renewal to redesign. Show what good looks like.`
    }`;
  }

  if (lq.includes('competitor') || lq.includes('industry') || lq.includes('market') || lq.includes('peer')) {
    return `${a.industry} landscape:\n\n${a.public_intelligence.industry_context}\n\nKey proof points:\n• Bell Canada: 67% cloud sales increase\n• Holcim: 85% participation globally\n• UNSW: 70% skill uplift\n• Forrester: 229% ROI\n\n${a.public_intelligence.news_signals.map(s => `📰 ${s}`).join('\n')}`;
  }

  return `I can help you think through ${a.customer_name}. Try asking:\n\n• "What's happening with this customer?"\n• "Who should I focus on?"\n• "Where should I start?"\n• "How do I handle objections?"\n• "Help me frame the ROI"\n• "Draft a follow-up email"\n• "What are competitors doing?"`;
}

const quickQuestions = [
  "What's happening right now?",
  "Who should I focus on?",
  "Where should I start?",
  "How do I handle objections?",
];

export function AdvisorChat({ account }: { account: Account }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isGreenfield = !account.tc_current_state.skill_builder;
    const highSignals = account.signals.filter(s => s.severity === 'HIGH');
    const primary = account.ebc_data.attendees.find(att => att.persona === 'CHRO') || account.ebc_data.attendees[0];

    setMessages([{
      role: 'advisor',
      text: `Here's what I'd focus on for ${account.customer_name}:\n\n🎯 ${highSignals[0]?.label || 'Workforce gap'} is the top signal — ${highSignals[0]?.evidence?.split(';')[0] || 'significant opportunity'}.\n\n👤 Start with ${primary.name} (${primary.title}) — they're your best path to a workforce conversation.\n\n💬 ${isGreenfield ? `Ask: "Where are the skills gaps slowing down ${account.sfdc_data.account_plan_priority}?" Let them tell you the problem.` : `Be transparent about the current state. Ask: "What would it take to make training work for your teams?"`}\n\nWhat would you like to dig into?`
    }]);
  }, [account.customer_name]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = (text?: string) => {
    const q = (text || input).trim();
    if (!q) return;
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setInput('');

    if (isBackendAvailable()) {
      // Use real Bedrock-powered advisor
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text,
      }));
      const isGreenfield = !account.tc_current_state.skill_builder;
      sendAdvisorMessage(
        q,
        history,
        {
          customer_name: account.customer_name,
          industry: account.industry,
          segment: account.segment,
          aws_spend_current: account.aws_spend.current_year,
          ppa: account.aws_spend.ppa,
          account_plan_priority: account.sfdc_data.account_plan_priority,
          open_opps: account.sfdc_data.open_opps,
          t2k: account.sfdc_data.t2k,
          smgs_phase: account.sfdc_data.smgs_phase,
          tc_state: isGreenfield
            ? `Greenfield — ${account.tc_current_state.certifications} organic certs, no structured program`
            : `${account.tc_current_state.skill_builder_seats} seats at ${account.tc_current_state.activation_rate}% activation, renewal ${account.tc_current_state.renewal_date}`,
          signals: account.signals.map(s => ({ label: s.label, severity: s.severity, evidence: s.evidence })),
          public_intelligence_summary: `${account.public_intelligence.linkedin_job_postings.cloud_ai_roles} cloud/AI roles (${account.public_intelligence.linkedin_job_postings.yoy_change} YoY). Earnings: ${account.public_intelligence.earnings_call_signals[0] || 'N/A'}. Executive social: ${account.public_intelligence.executive_social.map(e => `${e.name}: "${e.post_theme}"`).join('; ')}. Glassdoor: ${account.public_intelligence.glassdoor_signals[0] || 'N/A'}. Industry: ${account.public_intelligence.industry_context}`,
        }
      ).then(result => {
        setMessages(prev => [...prev, { role: 'advisor', text: result.response }]);
      }).catch(() => {
        // Fallback to mock
        setMessages(prev => [...prev, { role: 'advisor', text: getResponse(q, account) }]);
      });
    } else {
      // Use mock advisor
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'advisor', text: getResponse(q, account) }]);
      }, 300);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Messages */}
      <div ref={scrollRef} className="space-y-3 mb-4 max-h-[60vh] overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 ${
              msg.role === 'user'
                ? 'bg-amber-500/15 text-amber-200 rounded-br-md'
                : 'bg-navy-800 border border-navy-600 text-slate-200 rounded-bl-md'
            }`}>
              {msg.role === 'advisor' && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Bot className="w-3 h-3 text-sky-400" />
                  <span className="text-[10px] text-sky-400 font-medium">AWS Advisor</span>
                </div>
              )}
              <p className="text-xs leading-relaxed whitespace-pre-line">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick questions */}
      <div className="flex gap-1.5 overflow-x-auto pb-3">
        {quickQuestions.map(q => (
          <button key={q} onClick={() => send(q)}
            className="text-[11px] px-3 py-1.5 bg-navy-800 border border-navy-600 rounded-full text-slate-300 shrink-0 active:bg-navy-700">
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask anything about this customer..."
          className="flex-1 px-3.5 py-2.5 bg-navy-800 border border-navy-600 rounded-full text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400/50"
        />
        <button onClick={() => send()}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 flex items-center justify-center active:opacity-80 shrink-0">
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
