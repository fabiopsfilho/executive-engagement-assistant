import { useState } from 'react';
import { ArrowLeft, DollarSign, Target, Users, Shield, Newspaper, Briefcase, MessageSquare, TrendingUp, Calendar, CalendarClock } from 'lucide-react';
import type { Account, Attendee } from '../types';
import { generateAgenda } from '../data/agendas';
import { AgendaModal } from './AgendaModal';

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-navy-800 border border-navy-600 rounded-xl p-4 md:p-5 animate-fade-in ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-amber-400" />
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{label}</h3>
    </div>
  );
}

const personaColors: Record<string, string> = {
  CEO: 'from-amber-500 to-orange-500',
  CFO: 'from-emerald-500 to-teal-500',
  CIO: 'from-sky-500 to-blue-500',
  CTO: 'from-violet-500 to-purple-500',
  CHRO: 'from-rose-500 to-pink-500',
  Other: 'from-slate-500 to-gray-500',
};

export function IntelligenceDashboard({ account, onSelectPersona, onBack }: {
  account: Account;
  onSelectPersona: (a: Attendee) => void;
  onBack: () => void;
}) {
  const a = account;
  const pi = a.public_intelligence;
  const [showAgenda, setShowAgenda] = useState(false);
  const agenda = generateAgenda(a);

  return (
    <div className="px-4 md:px-6 py-6 md:py-8">
      {showAgenda && <AgendaModal agenda={agenda} onClose={() => setShowAgenda(false)} />}

      {/* Back + Title */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 md:mb-8 animate-fade-in">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-navy-700 transition-colors self-start" aria-label="Back to accounts">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-white">{a.customer_name}</h2>
          <p className="text-slate-400 text-sm">{a.industry} · {a.segment} · {a.geo}</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setShowAgenda(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 hover:border-amber-400/50 text-amber-400 text-sm font-medium transition-all hover:shadow-lg hover:shadow-amber-500/10"
            aria-label="Generate ideal agenda"
          >
            <CalendarClock className="w-4 h-4" />
            <span className="hidden sm:inline">Ideal Agenda</span>
            <span className="sm:hidden">Agenda</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden md:inline">Score</span>
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${a.tc_opportunity_score >= 8 ? 'from-rose-500 to-orange-500' : 'from-amber-500 to-yellow-500'} flex items-center justify-center text-white font-bold`}>
              {a.tc_opportunity_score}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-4 md:space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
            <Card>
              <SectionLabel icon={DollarSign} label="AWS Spend" />
              <div className="text-2xl font-bold text-white">{formatCurrency(a.aws_spend.current_year)}</div>
              <div className="text-sm text-slate-400 mt-1">Prior year: {formatCurrency(a.aws_spend.prior_year)}</div>
              <div className="text-xs text-emerald-400 mt-2">{a.aws_spend.ppa}</div>
            </Card>
            <Card>
              <SectionLabel icon={Target} label="Salesforce" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Open Opps</span><span className="text-white font-medium">{a.sfdc_data.open_opps}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">T2K</span><span className={a.sfdc_data.t2k ? 'text-emerald-400' : 'text-slate-500'}>{a.sfdc_data.t2k ? 'Yes' : 'No'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Phase</span><span className="text-white">{a.sfdc_data.smgs_phase}</span></div>
              </div>
              <div className="mt-2 text-xs text-sky-400">{a.sfdc_data.account_plan_priority}</div>
            </Card>
            <Card>
              <SectionLabel icon={Shield} label="T&C State" />
              {a.tc_current_state.skill_builder ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Skill Builder</span><span className="text-emerald-400">{a.tc_current_state.skill_builder_seats} seats</span></div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Activation</span>
                    <span className={a.tc_current_state.activation_rate < 50 ? 'text-rose-400' : 'text-emerald-400'}>{a.tc_current_state.activation_rate}%</span>
                  </div>
                  <div className="flex justify-between"><span className="text-slate-400">Certs</span><span className="text-white">{a.tc_current_state.certifications}</span></div>
                  {a.tc_current_state.renewal_date && (
                    <div className="text-xs text-amber-400 mt-1">Renewal: {a.tc_current_state.renewal_date}</div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-amber-400 font-medium">Greenfield</div>
                  <div className="text-sm text-slate-400 mt-1">{a.tc_current_state.certifications} organic certs</div>
                  <div className="text-xs text-slate-500 mt-2">{a.tc_current_state.prior_engagement}</div>
                </div>
              )}
            </Card>
          </div>

          <Card>
            <SectionLabel icon={TrendingUp} label="Engagement Signals" />
            <div className="space-y-3">
              {a.signals.map(s => (
                <div key={s.label} className="flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${s.severity === 'HIGH' ? 'bg-rose-400' : s.severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-sky-400'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{s.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${s.severity === 'HIGH' ? 'bg-rose-500/15 text-rose-400' : s.severity === 'MEDIUM' ? 'bg-amber-500/15 text-amber-400' : 'bg-sky-500/15 text-sky-400'}`}>{s.severity}</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5">{s.evidence}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionLabel icon={Newspaper} label="Public Intelligence" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">Earnings Call Signals</h4>
                <ul className="space-y-2">
                  {pi.earnings_call_signals.map((s, i) => (
                    <li key={i} className="text-sm text-slate-300 pl-3 border-l-2 border-navy-600">{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">News & Market Signals</h4>
                <ul className="space-y-2">
                  {pi.news_signals.map((s, i) => (
                    <li key={i} className="text-sm text-slate-300 pl-3 border-l-2 border-navy-600">{s}</li>
                  ))}
                </ul>
                <div className="mt-3 p-3 bg-navy-700/50 rounded-lg">
                  <div className="text-xs text-slate-500 uppercase mb-1">LinkedIn Job Postings</div>
                  <div className="text-lg font-bold text-white">{pi.linkedin_job_postings.cloud_ai_roles} cloud/AI roles</div>
                  <div className="text-sm text-emerald-400">{pi.linkedin_job_postings.yoy_change} YoY</div>
                </div>
              </div>
            </div>
            <div className="mt-5">
              <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">Executive Social Activity</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {pi.executive_social.map(e => (
                  <div key={e.name} className="p-3 bg-navy-700/50 rounded-lg">
                    <div className="text-sm font-medium text-white">{e.name}</div>
                    <div className="text-xs text-slate-400">{e.title}</div>
                    <div className="text-xs text-sky-400 mt-1">{e.post_theme}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5">
              <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">Glassdoor Signals</h4>
              <div className="flex flex-wrap gap-2">
                {pi.glassdoor_signals.map((s, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 bg-navy-700/50 rounded-lg text-slate-300">"{s}"</span>
                ))}
              </div>
            </div>
            <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg">
              <div className="text-xs text-amber-400 font-medium uppercase mb-1">Industry Context</div>
              <p className="text-sm text-slate-300">{pi.industry_context}</p>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-4 md:space-y-5">
          <Card>
            <SectionLabel icon={Calendar} label="Upcoming EBC" />
            <div className="text-sm text-white font-medium">{a.ebc_data.ebc_id}</div>
            <div className="text-sm text-slate-400 mt-1">{a.ebc_data.meeting_dates.join(', ')}</div>
            <div className="text-xs text-slate-400 mt-1">{a.ebc_data.location}</div>
            <div className="mt-3">
              <div className="text-xs text-slate-500 uppercase mb-2">Themes</div>
              <div className="space-y-1.5">
                {a.ebc_data.themes.map(t => (
                  <div key={t} className="text-xs px-2.5 py-1.5 bg-navy-700/50 rounded text-slate-300">{t}</div>
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <SectionLabel icon={Users} label="Select a Persona" />
            <p className="text-sm text-slate-400 mb-4">Choose an executive to generate a tailored engagement story</p>
            <div className="space-y-2">
              {a.ebc_data.attendees.map(att => (
                <button
                  key={att.name}
                  onClick={() => onSelectPersona(att)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-navy-700/50 border border-transparent hover:border-navy-600 transition-all group text-left"
                  aria-label={`Select ${att.name}, ${att.title}`}
                >
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${personaColors[att.persona] || personaColors.Other} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {att.persona === 'Other' ? att.title.split(' ').map(w => w[0]).join('').slice(0, 3) : att.persona}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors truncate">{att.name}</div>
                    <div className="text-xs text-slate-400 truncate">{att.title}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <SectionLabel icon={Briefcase} label="Account Priority" />
            <p className="text-sm text-sky-400">{a.sfdc_data.account_plan_priority}</p>
            <div className="mt-3 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs text-slate-400">Requested by: {a.ebc_data.requestor}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
