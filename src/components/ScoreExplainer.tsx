import { X, TrendingUp, Briefcase, Shield, Calendar, Newspaper } from 'lucide-react';
import type { Account } from '../types';

interface ScoreDimension {
  label: string;
  weight: string;
  score: number;
  maxScore: number;
  icon: React.ComponentType<{ className?: string }>;
  explanation: string;
}

function getScoreDimensions(account: Account): ScoreDimension[] {
  const a = account;
  const hasSkillBuilder = a.tc_current_state.skill_builder;
  const jobGrowth = parseInt(a.public_intelligence.linkedin_job_postings.yoy_change.replace(/[^0-9]/g, '')) || 0;

  // Talent signals (25%)
  const talentScore = Math.min(10, Math.round(
    (a.public_intelligence.linkedin_job_postings.cloud_ai_roles / 20) +
    (jobGrowth > 100 ? 3 : jobGrowth > 50 ? 2 : 1)
  ));

  // Business signals (25%)
  const businessScore = Math.min(10, Math.round(
    (a.sfdc_data.open_opps / 3) +
    (a.sfdc_data.t2k ? 2 : 0) +
    (a.aws_spend.current_year > 30000000 ? 3 : a.aws_spend.current_year > 15000000 ? 2 : 1)
  ));

  // T&C current state (20%)
  const tcScore = hasSkillBuilder
    ? Math.min(10, Math.round(10 - (a.tc_current_state.activation_rate / 15) + (a.tc_current_state.renewal_date ? 2 : 0)))
    : Math.min(10, 8 + (a.tc_current_state.certifications < 20 ? 2 : 0));

  // Engagement timing (15%)
  const nextEbc = a.ebc_data.meeting_dates[0];
  const daysUntil = nextEbc ? Math.ceil((new Date(nextEbc).getTime() - Date.now()) / 86400000) : 999;
  const timingScore = daysUntil < 30 ? 10 : daysUntil < 60 ? 8 : daysUntil < 90 ? 7 : daysUntil < 180 ? 5 : 3;

  // Public intelligence (15%)
  const intelScore = Math.min(10, Math.round(
    (a.public_intelligence.earnings_call_signals.length * 1.5) +
    (a.public_intelligence.executive_social.length) +
    (a.public_intelligence.news_signals.length * 0.5)
  ));

  return [
    {
      label: 'Talent Signals',
      weight: '25%',
      score: talentScore,
      maxScore: 10,
      icon: TrendingUp,
      explanation: `${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open cloud/AI roles with ${a.public_intelligence.linkedin_job_postings.yoy_change} year-over-year growth. Higher demand for cloud talent indicates stronger need for workforce development programs.`
    },
    {
      label: 'Business Signals',
      weight: '25%',
      score: businessScore,
      maxScore: 10,
      icon: Briefcase,
      explanation: `${a.sfdc_data.open_opps} open opportunities, ${a.sfdc_data.t2k ? 'T2K account' : 'non-T2K'}, ${a.sfdc_data.smgs_phase} phase. AWS spend of $${(a.aws_spend.current_year / 1000000).toFixed(1)}M signals significant cloud investment that needs workforce support.`
    },
    {
      label: 'Training Current State',
      weight: '20%',
      score: tcScore,
      maxScore: 10,
      icon: Shield,
      explanation: hasSkillBuilder
        ? `Existing engagement at ${a.tc_current_state.activation_rate}% activation with ${a.tc_current_state.skill_builder_seats} seats. ${a.tc_current_state.renewal_date ? `Renewal on ${a.tc_current_state.renewal_date} creates urgency.` : ''} Lower activation = higher opportunity to redesign and expand.`
        : `Greenfield opportunity — only ${a.tc_current_state.certifications} organic certifications with no structured program. Maximum potential for new strategic partnership.`
    },
    {
      label: 'Engagement Timing',
      weight: '15%',
      score: timingScore,
      maxScore: 10,
      icon: Calendar,
      explanation: nextEbc
        ? `EBC scheduled for ${nextEbc} (${daysUntil} days away). ${daysUntil < 60 ? 'Imminent engagement window — high urgency to prepare.' : 'Upcoming engagement provides a clear action point.'}`
        : 'No EBC currently scheduled. Timing score is lower without a concrete engagement date.'
    },
    {
      label: 'Public Intelligence',
      weight: '15%',
      score: intelScore,
      maxScore: 10,
      icon: Newspaper,
      explanation: `${a.public_intelligence.earnings_call_signals.length} earnings call signals, ${a.public_intelligence.executive_social.length} executive social posts, ${a.public_intelligence.news_signals.length} news signals. Richer public intelligence means better-informed engagement and stronger conversation starters.`
    }
  ];
}

export function ScoreExplainer({ account, onClose }: { account: Account; onClose: () => void }) {
  const dimensions = getScoreDimensions(account);
  const overallScore = account.tc_opportunity_score;
  const scoreColor = overallScore >= 8 ? 'from-rose-500 to-orange-500' : overallScore >= 6 ? 'from-amber-500 to-yellow-500' : 'from-sky-500 to-cyan-500';
  const scoreLabel = overallScore >= 8 ? 'High Priority' : overallScore >= 6 ? 'Medium Priority' : 'Developing';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-navy-800 border-t sm:border border-navy-600 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-navy-600" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pb-4 pt-2 sm:pt-5">
          <div>
            <h3 className="text-base font-semibold text-white">AWS Engagement Score</h3>
            <p className="text-xs text-slate-400 mt-0.5">{account.customer_name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg active:bg-navy-700" aria-label="Close">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Overall Score */}
        <div className="px-5 pb-5">
          <div className="flex items-center gap-4 bg-navy-900/50 rounded-xl p-4">
            <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${scoreColor} flex items-center justify-center text-white font-bold text-2xl shrink-0`}>
              {overallScore}
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{scoreLabel}</div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                The AWS Score measures how strong the opportunity is for a skills executive engagement session with this customer. It combines talent demand, business signals, current training state, engagement timing, and public intelligence into a single 1-10 score to help you prioritize your executive conversations.
              </p>
            </div>
          </div>
        </div>

        {/* Score Scale */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 text-[11px]">
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gradient-to-br from-sky-500 to-cyan-500" /><span className="text-slate-400">1-5 Developing</span></div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gradient-to-br from-amber-500 to-yellow-500" /><span className="text-slate-400">6-7 Medium</span></div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gradient-to-br from-rose-500 to-orange-500" /><span className="text-slate-400">8-10 High</span></div>
          </div>
        </div>

        {/* Dimensions */}
        <div className="px-5 pb-6 space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Score Breakdown</h4>
          {dimensions.map(d => (
            <div key={d.label} className="bg-navy-900/50 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <d.icon className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">{d.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">{d.weight}</span>
                  <span className="text-sm font-bold text-white">{d.score}/{d.maxScore}</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-navy-700 rounded-full mb-2">
                <div
                  className={`h-1.5 rounded-full bg-gradient-to-r ${d.score >= 8 ? 'from-rose-500 to-orange-500' : d.score >= 6 ? 'from-amber-500 to-yellow-500' : 'from-sky-500 to-cyan-500'}`}
                  style={{ width: `${(d.score / d.maxScore) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{d.explanation}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="px-5 pb-6 border-t border-navy-700 pt-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">How the Score Works</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            The AWS Score is calculated by weighting five dimensions: Talent Signals (25%), Business Signals (25%), Current Training State (20%), Engagement Timing (15%), and Public Intelligence (15%). Each dimension is scored 1-10 based on real data from Salesforce, LinkedIn, earnings calls, Glassdoor, and EBC schedules. A higher score means a stronger, more urgent opportunity for a skills executive engagement session — where AWS can position workforce development as a strategic accelerator for the customer's transformation.
          </p>
        </div>
      </div>
    </div>
  );
}
