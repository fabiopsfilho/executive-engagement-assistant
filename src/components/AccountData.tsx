import { DollarSign, Target, Shield, TrendingUp, Newspaper, Calendar } from 'lucide-react';
import type { Account } from '../types';

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;
}

function Section({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-amber-400" />
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</h3>
      </div>
      {children}
    </div>
  );
}

export function AccountData({ account }: { account: Account }) {
  const a = account;
  const pi = a.public_intelligence;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      {/* Spend & Salesforce */}
      <div className="grid grid-cols-2 gap-3">
        <Section icon={DollarSign} label="AWS Spend">
          <div className="text-xl font-bold text-white">{fmt(a.aws_spend.current_year)}</div>
          <div className="text-xs text-slate-400 mt-1">Prior: {fmt(a.aws_spend.prior_year)}</div>
          <div className="text-[11px] text-emerald-400 mt-1">{a.aws_spend.ppa}</div>
        </Section>
        <Section icon={Target} label="Salesforce">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Open Opps</span><span className="text-white font-medium">{a.sfdc_data.open_opps}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">T2K</span><span className={a.sfdc_data.t2k ? 'text-emerald-400' : 'text-slate-500'}>{a.sfdc_data.t2k ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Phase</span><span className="text-white">{a.sfdc_data.smgs_phase}</span></div>
          </div>
        </Section>
      </div>

      {/* T&C State */}
      <Section icon={Shield} label="T&C Current State">
        {a.tc_current_state.skill_builder ? (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-white">{a.tc_current_state.skill_builder_seats}</div>
              <div className="text-[11px] text-slate-400">Seats</div>
            </div>
            <div>
              <div className={`text-lg font-bold ${a.tc_current_state.activation_rate < 50 ? 'text-rose-400' : 'text-emerald-400'}`}>{a.tc_current_state.activation_rate}%</div>
              <div className="text-[11px] text-slate-400">Activation</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">{a.tc_current_state.certifications}</div>
              <div className="text-[11px] text-slate-400">Certs</div>
            </div>
          </div>
        ) : (
          <div>
            <span className="text-amber-400 font-medium text-sm">Greenfield</span>
            <span className="text-slate-400 text-xs ml-2">{a.tc_current_state.certifications} organic certs</span>
          </div>
        )}
        {a.tc_current_state.renewal_date && <div className="text-xs text-amber-400 mt-2">Renewal: {a.tc_current_state.renewal_date}</div>}
        <p className="text-xs text-slate-500 mt-2">{a.tc_current_state.prior_engagement}</p>
      </Section>

      {/* Signals */}
      <Section icon={TrendingUp} label="Engagement Signals">
        <div className="space-y-2.5">
          {a.signals.map(s => (
            <div key={s.label} className="flex items-start gap-2.5">
              <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${s.severity === 'HIGH' ? 'bg-rose-400' : s.severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-sky-400'}`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white">{s.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.severity === 'HIGH' ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'}`}>{s.severity}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{s.evidence}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* EBC */}
      <Section icon={Calendar} label="Upcoming EBC">
        <div className="text-sm text-white font-medium">{a.ebc_data.meeting_dates[0]}</div>
        <div className="text-xs text-slate-400 mt-0.5">{a.ebc_data.location}</div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {a.ebc_data.themes.map(t => (
            <span key={t} className="text-[11px] px-2 py-1 bg-navy-700/50 rounded text-slate-300">{t}</span>
          ))}
        </div>
      </Section>

      {/* Public Intelligence */}
      <Section icon={Newspaper} label="Public Intelligence">
        <div className="space-y-3">
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-medium">Earnings Calls</span>
            <div className="space-y-1.5 mt-1">
              {pi.earnings_call_signals.map((s, i) => (
                <p key={i} className="text-xs text-slate-300 pl-2.5 border-l-2 border-navy-600">{s}</p>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-medium">LinkedIn</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-white">{pi.linkedin_job_postings.cloud_ai_roles}</span>
              <span className="text-xs text-slate-400">cloud/AI roles</span>
              <span className="text-xs text-emerald-400">{pi.linkedin_job_postings.yoy_change} YoY</span>
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-medium">Glassdoor</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {pi.glassdoor_signals.map((s, i) => (
                <span key={i} className="text-[11px] px-2 py-1 bg-navy-700/50 rounded text-slate-300">"{s}"</span>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-medium">News</span>
            <div className="space-y-1 mt-1">
              {pi.news_signals.map((s, i) => (
                <p key={i} className="text-xs text-slate-300 pl-2.5 border-l-2 border-navy-600">{s}</p>
              ))}
            </div>
          </div>
          <div className="p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-lg">
            <span className="text-[11px] text-amber-400 font-medium uppercase">Industry Context</span>
            <p className="text-xs text-slate-300 mt-1">{pi.industry_context}</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
