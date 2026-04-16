import { useState } from 'react';
import { Lightbulb, TrendingUp, AlertTriangle, Users, ChevronDown, ChevronUp, DollarSign, Target, Shield, Calendar, Newspaper } from 'lucide-react';
import type { Account } from '../types';

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;
}

export function SummaryView({ account }: { account: Account }) {
  const a = account;
  const [showAllData, setShowAllData] = useState(false);
  const isGreenfield = !a.tc_current_state.skill_builder;
  const spendGrowth = Math.round(((a.aws_spend.current_year - a.aws_spend.prior_year) / a.aws_spend.prior_year) * 100);
  const pi = a.public_intelligence;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Account narrative */}
      <div>
        <p className="text-sm text-slate-200 leading-relaxed">
          <span className="text-white font-semibold">{a.customer_name}</span> is a{' '}
          <span className="text-purple-400">{a.segment}</span> account in{' '}
          <span className="text-blue-400">{a.industry}</span> ({a.geo}) with{' '}
          <span className="text-white font-medium">{fmt(a.aws_spend.current_year)}</span> spend,{' '}
          up <span className="text-green-400">{spendGrowth}%</span> YoY.
          {a.aws_spend.ppa && <> PPA: <span className="text-green-400">{a.aws_spend.ppa}</span>.</>}
        </p>
      </div>

      {/* Strategic Priority */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Strategic Priority</span>
        </div>
        <p className="text-sm text-white font-medium">{a.sfdc_data.account_plan_priority}</p>
        <p className="text-xs text-muted mt-1">{a.sfdc_data.open_opps} opps · {a.sfdc_data.smgs_phase} · {a.sfdc_data.t2k ? 'T2K' : 'Non-T2K'}</p>
      </div>

      {/* Signals */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Signals</span>
        </div>
        <div className="space-y-2">
          {a.signals.map(s => (
            <div key={s.label} className="flex items-start gap-2.5">
              <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${s.severity === 'HIGH' ? 'bg-red-400' : 'bg-orange-400'}`} />
              <div>
                <span className="text-xs text-white font-medium">{s.label}</span>
                <p className="text-[11px] text-muted">{s.evidence}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* T&C Engagement History */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Engagement History</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {isGreenfield
            ? `Minimal engagement — ${a.tc_current_state.certifications} organic certs, no structured program. Significant greenfield opportunity.`
            : `Existing relationship but adoption plateaued. Renewal window approaching — moment to reimagine as strategic workforce partnership.`}
        </p>
      </div>

      {/* Executive Voices */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Executive Voices</span>
        </div>
        <div className="space-y-2">
          {pi.executive_social.map(e => (
            <div key={e.name} className="bg-dark-800 border border-dark-600 rounded-xl p-3">
              <span className="text-xs text-white font-medium">{e.name}</span>
              <span className="text-[10px] text-muted ml-1">{e.title}</span>
              <p className="text-xs text-blue-400 italic mt-0.5">"{e.post_theme}"</p>
            </div>
          ))}
        </div>
      </div>

      {/* View All Data toggle */}
      <button onClick={() => setShowAllData(!showAllData)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-dark-800 border border-dark-600 rounded-xl text-sm text-purple-400 font-medium active:bg-dark-700">
        {showAllData ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {showAllData ? 'Hide detailed data' : 'View all data'}
      </button>

      {showAllData && (
        <div className="space-y-4 animate-fade-in">
          {/* Spend & Salesforce */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-dark-800 border border-dark-600 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2"><DollarSign className="w-3.5 h-3.5 text-green-400" /><span className="text-[10px] font-semibold text-muted uppercase">AWS Spend</span></div>
              <div className="text-xl font-bold text-white">{fmt(a.aws_spend.current_year)}</div>
              <div className="text-[11px] text-muted mt-0.5">Prior: {fmt(a.aws_spend.prior_year)}</div>
              <div className="text-[10px] text-green-400 mt-1">{a.aws_spend.ppa}</div>
            </div>
            <div className="bg-dark-800 border border-dark-600 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2"><Target className="w-3.5 h-3.5 text-blue-400" /><span className="text-[10px] font-semibold text-muted uppercase">Salesforce</span></div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-muted">Open Opps</span><span className="text-white">{a.sfdc_data.open_opps}</span></div>
                <div className="flex justify-between"><span className="text-muted">T2K</span><span className={a.sfdc_data.t2k ? 'text-green-400' : 'text-muted'}>{a.sfdc_data.t2k ? 'Yes' : 'No'}</span></div>
                <div className="flex justify-between"><span className="text-muted">Phase</span><span className="text-white">{a.sfdc_data.smgs_phase}</span></div>
              </div>
            </div>
          </div>

          {/* T&C State */}
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2"><Shield className="w-3.5 h-3.5 text-purple-400" /><span className="text-[10px] font-semibold text-muted uppercase">Training State</span></div>
            {a.tc_current_state.skill_builder ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><div className="text-lg font-bold text-white">{a.tc_current_state.skill_builder_seats}</div><div className="text-[10px] text-muted">Seats</div></div>
                <div><div className={`text-lg font-bold ${a.tc_current_state.activation_rate < 50 ? 'text-red-400' : 'text-green-400'}`}>{a.tc_current_state.activation_rate}%</div><div className="text-[10px] text-muted">Activation</div></div>
                <div><div className="text-lg font-bold text-white">{a.tc_current_state.certifications}</div><div className="text-[10px] text-muted">Certs</div></div>
              </div>
            ) : (
              <div><span className="text-orange-400 font-medium text-sm">Greenfield</span><span className="text-muted text-xs ml-2">{a.tc_current_state.certifications} organic certs</span></div>
            )}
            {a.tc_current_state.renewal_date && <div className="text-[10px] text-orange-400 mt-2">Renewal: {a.tc_current_state.renewal_date}</div>}
          </div>

          {/* EBC */}
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2"><Calendar className="w-3.5 h-3.5 text-orange-400" /><span className="text-[10px] font-semibold text-muted uppercase">Upcoming EBC</span></div>
            <div className="text-sm text-white">{a.ebc_data.meeting_dates[0]}</div>
            <div className="text-[11px] text-muted">{a.ebc_data.location}</div>
            <div className="flex flex-wrap gap-1 mt-2">
              {a.ebc_data.themes.map(t => (<span key={t} className="text-[10px] px-2 py-0.5 bg-dark-700 rounded text-muted">{t}</span>))}
            </div>
          </div>

          {/* Public Intelligence */}
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2"><Newspaper className="w-3.5 h-3.5 text-blue-400" /><span className="text-[10px] font-semibold text-muted uppercase">Public Intelligence</span></div>
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-muted uppercase">Earnings</span>
                {pi.earnings_call_signals.map((s, i) => (<p key={i} className="text-[11px] text-slate-300 pl-2 border-l-2 border-dark-600 mt-1">{s}</p>))}
              </div>
              <div>
                <span className="text-[10px] text-muted uppercase">LinkedIn</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-lg font-bold text-white">{pi.linkedin_job_postings.cloud_ai_roles}</span>
                  <span className="text-[11px] text-muted">cloud/AI roles</span>
                  <span className="text-[11px] text-green-400">{pi.linkedin_job_postings.yoy_change} YoY</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted uppercase">Glassdoor</span>
                {pi.glassdoor_signals.map((s, i) => (<p key={i} className="text-[11px] text-slate-300 pl-2 border-l-2 border-dark-600 mt-1">"{s}"</p>))}
              </div>
              <div>
                <span className="text-[10px] text-muted uppercase">News</span>
                {pi.news_signals.map((s, i) => (<p key={i} className="text-[11px] text-slate-300 pl-2 border-l-2 border-dark-600 mt-1">{s}</p>))}
              </div>
              <div className="p-2 bg-orange-500/5 border border-orange-500/10 rounded-lg">
                <span className="text-[10px] text-orange-400 uppercase font-medium">Industry</span>
                <p className="text-[11px] text-slate-300 mt-0.5">{pi.industry_context}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-16" />
    </div>
  );
}
