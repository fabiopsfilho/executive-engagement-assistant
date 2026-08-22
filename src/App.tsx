import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, FileText, BookOpen, Zap, Megaphone, Loader2, Upload, Database, Presentation } from 'lucide-react';
import type { Account, Attendee } from './types';
import { accounts } from './data/accounts';
import { AccountSelector } from './components/AccountSelector';
import { ExecBrief } from './components/ExecBrief';
import { SummaryView } from './components/SummaryView';
import { PersonaView } from './components/PersonaView';
import { ScoreExplainer } from './components/ScoreExplainer';
import { PersonaPickerSheet } from './components/PersonaPickerSheet';
import { isBackendAvailable, getIntelligence, getTCData, generateUnifiedAnalysis, generateSlides, type TCAccountSummary, type BuzzNowResponse, type UnifiedAnalysisResponse, type SlidesResponse } from './services/api';
import { parseAttendeeCSV, attendeesToPersonas } from './services/attendeeParser';
import { exportSlidesToPPTX, exportSlidesToPDF } from './services/slideExport';

type MainTab = 'brief' | 'summary' | 'demo';

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [persona, setPersona] = useState<Attendee | null>(null);
  const [tab, setTab] = useState<MainTab>('brief');
  const [showScore, setShowScore] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [insightPopup, setInsightPopup] = useState<'now' | 'buzz' | null>(null);
  // Presentation slides (max 2) generated on demand to support the customer conversation.
  const [showSlides, setShowSlides] = useState(false);
  const [slides, setSlides] = useState<SlidesResponse | null>(null);
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [tcData, setTcData] = useState<TCAccountSummary | null>(null);
  // Single unified analysis powers Approach, Buzz, Now, Next Steps, Key Asks — all consistent.
  const [analysis, setAnalysis] = useState<UnifiedAnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [uploadedAttendees, setUploadedAttendees] = useState<Attendee[]>([]);
  const [attendeeUploadMsg, setAttendeeUploadMsg] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [, setAccountPlanText] = useState<string>('');
  const [, setAccountPlanName] = useState<string>('');
  const [externalDocs, setExternalDocs] = useState<{ name: string; text: string }[]>([]);
  const externalDocInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive the Buzz/Now shape from the unified analysis (the popup reads this).
  const buzzNow: BuzzNowResponse | null = analysis ? {
    buzz_summary: analysis.buzz_summary,
    buzz_executive_insights: analysis.buzz_executive_insights,
    buzz_hiring_analysis: analysis.buzz_hiring_analysis,
    buzz_sentiment_analysis: analysis.buzz_sentiment_analysis,
    buzz_tc_opportunity: analysis.buzz_tc_opportunity,
    now_focus: analysis.now_focus,
    now_initiatives: analysis.now_initiatives,
    now_key_asks: analysis.now_key_asks,
    now_opening_move: analysis.now_opening_move,
  } : null;

  // Central regeneration: runs the single unified analysis. Called on account load
  // AND whenever new data arrives (attendee import, brief/plan upload, Salesforce capture)
  // so Approach, Buzz, Now, Next Steps, and Key Asks all refresh together and stay consistent.
  const regenerateAnalysis = (acct: Account | null, tc: TCAccountSummary | null, refresh = false) => {
    if (!acct || !isBackendAvailable()) return;
    setAnalysisLoading(true);
    setAnalysis(null);
    setSlides(null); // new analysis → invalidate any cached slides so the deck stays consistent
    generateUnifiedAnalysis(acct, tc, { refresh })
      .then(result => setAnalysis(result))
      .catch(err => console.error('Unified analysis failed:', err))
      .finally(() => setAnalysisLoading(false));
  };

  // Generate the max 2-slide executive support deck from the current unified analysis.
  const openSlides = () => {
    if (!account) return;
    setShowSlides(true);
    setSlideIndex(0);
    // If we already have slides for this analysis, keep them; otherwise generate.
    if (slides || !isBackendAvailable()) return;
    setSlidesLoading(true);
    generateSlides(account, analysis)
      .then(result => setSlides(result))
      .catch(err => console.error('Slide generation failed:', err))
      .finally(() => setSlidesLoading(false));
  };

  // Handle attendee CSV upload
  const handleAttendeeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csvText = ev.target?.result as string;
      if (!csvText) return;
      const parsed = parseAttendeeCSV(csvText);
      const personas = attendeesToPersonas(parsed);
      setUploadedAttendees(personas);
      const updated = account ? { ...account, ebc_data: { ...account.ebc_data, attendees: personas } } : null;
      setAccount(prev => prev ? { ...prev, ebc_data: { ...prev.ebc_data, attendees: personas } } : prev);
      setAttendeeUploadMsg(`${personas.length} attendees loaded — regenerating insights...`);
      // New data → regenerate the full unified analysis (Approach + Buzz + Now + Next Steps + Key Asks)
      regenerateAnalysis(updated, tcData, true);
      setTimeout(() => setRefreshKey(k => k + 1), 100);
      setTimeout(() => setAttendeeUploadMsg(null), 4000);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  };

  // Unified DOCUMENT upload — any supporting doc (account plan, briefing, Databook, etc.).
  // Documents ACCUMULATE and persist for the account. Every upload re-runs the FULL unified
  // analysis, reconsidering all uploaded docs + captured Salesforce data + public search
  // together — regenerating Approach, Next Steps, Key Asks, Buzz, and Now.
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target?.result as string;
      if (!text) return;
      if (fileName.endsWith('.docx')) {
        const matches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
        text = matches.length > 0
          ? matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ')
          : text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n').trim();
      } else if (!fileName.endsWith('.txt') && !fileName.endsWith('.csv')) {
        text = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n').trim();
      }
      if (text.length > 30) {
        const doc = { name: fileName, text: text.slice(0, 15000) };
        setExternalDocs(prev => {
          const next = [...prev.filter(d => d.name !== fileName), doc]; // replace if same filename re-uploaded
          const updated = account ? { ...account, externalDocs: next } : null;
          setAccount(p => p ? { ...p, externalDocs: next } : p);
          // Reconsider everything with the new document included.
          regenerateAnalysis(updated, tcData, true);
          return next;
        });
        setAttendeeUploadMsg(`"${fileName}" added — regenerating full analysis with all documents...`);
        setTimeout(() => setRefreshKey(k => k + 1), 100);
        setTimeout(() => setAttendeeUploadMsg(null), 4000);
      } else {
        setAttendeeUploadMsg('Could not extract text from document.');
        setTimeout(() => setAttendeeUploadMsg(null), 3000);
      }
    };
    if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) reader.readAsText(file);
    else reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Check URL params for direct account selection (used by Chrome extension)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accountName = params.get('account');
    if (accountName) {
      // Try exact match first, then partial match
      const found = accounts.find(a => a.customer_name.toLowerCase() === accountName.toLowerCase()) ||
        accounts.find(a => a.customer_name.toLowerCase().includes(accountName.toLowerCase()) || accountName.toLowerCase().includes(a.customer_name.toLowerCase()));
      if (found) {
        setAccount(found);
      }
    }
  }, []);

  // Listen for captured page content from Chrome extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CAPTURED_CONTENT' && event.data.text) {
        const capturedText = event.data.text.slice(0, 15000);
        setAccountPlanText(capturedText);
        setAccountPlanName(`Captured: ${event.data.title || 'Page content'}`);
        // Use functional update to get the current account, then regenerate with the captured data.
        setAccount(prev => {
          if (!prev) return prev;
          const updated = { ...prev, accountPlanText: capturedText };
          // New Salesforce data → regenerate the full unified analysis
          regenerateAnalysis(updated, tcData, true);
          return updated;
        });
        setRefreshKey(k => k + 1);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [tcData]);

  // When a live account is selected with empty intelligence, fetch from Bedrock
  useEffect(() => {
    if (!account) return;

    // Fetch T&C opportunity data
    if (isBackendAvailable()) {
      const sfdcId = account.sfdcAccountId;
      // Try SFDC ID first, then fall back to name matching
      if (sfdcId) {
        getTCData(sfdcId).then(result => {
          if (result.summary) {
            setTcData(result.summary);
          } else {
            // ID didn't match — try name matching (accounts may have different IDs)
            getTCData().then(allResult => {
              if (allResult.summaries) {
                const nameNorm = account.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const match = allResult.summaries.find(s => {
                  const sNorm = s.accountName.toLowerCase().replace(/[^a-z0-9]/g, '');
                  return sNorm.includes(nameNorm) || nameNorm.includes(sNorm) ||
                    // Also try first word match (e.g., "Itau" matches "Itaú Unibanco")
                    sNorm.startsWith(nameNorm.slice(0, 4)) || nameNorm.startsWith(sNorm.slice(0, 4));
                });
                if (match) setTcData(match);
              }
            }).catch(() => {});
          }
        }).catch(() => {});
      } else {
        getTCData().then(result => {
          if (result.summaries) {
            const nameNorm = account.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const match = result.summaries.find(s => {
              const sNorm = s.accountName.toLowerCase().replace(/[^a-z0-9]/g, '');
              return sNorm.includes(nameNorm) || nameNorm.includes(sNorm) ||
                sNorm.startsWith(nameNorm.slice(0, 4)) || nameNorm.startsWith(sNorm.slice(0, 4));
            });
            if (match) setTcData(match);
          }
        }).catch(() => {});
      }
    }

    // Check if this account has real intelligence (more than just CSV-derived data)
    const hasRealIntel = account.public_intelligence.executive_social.length > 0 ||
      account.public_intelligence.linkedin_job_postings.cloud_ai_roles > 0 ||
      account.public_intelligence.glassdoor_signals.length > 0;

    if (!hasRealIntel && isBackendAvailable()) {
      setLoadingIntel(true);
      getIntelligence(
        account.customer_name,
        account.industry,
        account.aws_spend.current_year,
        account.ebc_data.attendees.map(a => `${a.name} (${a.title})`).join(', ')
      ).then(intel => {
        setAccount(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            public_intelligence: {
              earnings_call_signals: intel.earnings_call_signals && intel.earnings_call_signals.length > 0 ? intel.earnings_call_signals : prev.public_intelligence.earnings_call_signals,
              linkedin_job_postings: intel.linkedin_job_postings && intel.linkedin_job_postings.cloud_ai_roles > 0 ? intel.linkedin_job_postings : prev.public_intelligence.linkedin_job_postings,
              executive_social: intel.executive_social && intel.executive_social.length > 0 ? intel.executive_social : prev.public_intelligence.executive_social,
              glassdoor_signals: intel.glassdoor_signals && intel.glassdoor_signals.length > 0 ? intel.glassdoor_signals : prev.public_intelligence.glassdoor_signals,
              industry_context: intel.industry_context || prev.public_intelligence.industry_context,
              news_signals: intel.news_signals && intel.news_signals.length > 0 ? intel.news_signals : prev.public_intelligence.news_signals,
            },
            signals: intel.signals && intel.signals.length > 0 ? intel.signals : prev.signals,
            tc_opportunity_score: intel.tc_opportunity_score ? Math.min(10, intel.tc_opportunity_score) : prev.tc_opportunity_score,
            // NOTE: executives found via online search stay in public_intelligence.executive_social
            // ("executives worth knowing about"). They are NEVER written into ebc_data.attendees —
            // confirmed attendees ONLY come from the user's imported attendee CSV. This prevents
            // the assistant from treating a searched executive as a confirmed EBC attendee.
            ebc_data: {
              ...prev.ebc_data,
            },
          };
        });
      }).catch(err => {
        console.error('Failed to fetch intelligence:', err);
      }).finally(() => {
        setLoadingIntel(false);
      });
    }
  }, [account?.customer_name]);

  // Generate the single unified analysis when an account is selected.
  // Runs once per account; data-change handlers (attendee/plan/capture) call
  // regenerateAnalysis directly so everything refreshes together.
  useEffect(() => {
    if (account && isBackendAvailable()) {
      regenerateAnalysis(account, tcData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.customer_name]);

  if (!account) return (
    <div className="min-h-screen bg-dark-900 flex justify-center">
      <div className="w-full max-w-[430px] md:max-w-[800px] lg:max-w-[1000px]">
        <AccountSelector accounts={accounts} onSelect={a => { setAccount(a); setTab('brief'); setAnalysis(null); setUploadedAttendees([]); setAttendeeUploadMsg(null); setAccountPlanText(''); setAccountPlanName(''); setExternalDocs([]); }} />
      </div>
    </div>
  );

  if (persona) return (
    <div className="min-h-screen bg-dark-900 flex justify-center">
      <div className="w-full max-w-[430px] md:max-w-[700px]">
        <header className="sticky top-0 z-50 bg-dark-800/90 backdrop-blur-md border-b border-dark-600 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setPersona(null)} className="p-1 active:opacity-70"><ArrowLeft className="w-5 h-5 text-muted" /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-white truncate">{persona.name}</h1>
            <p className="text-[11px] text-muted">{persona.title}</p>
          </div>
        </header>
        <PersonaView account={account} persona={persona} buzzContext={buzzNow ? `Hiring: ${typeof buzzNow.buzz_hiring_analysis === 'object' ? buzzNow.buzz_hiring_analysis.why_this_matters : buzzNow.buzz_hiring_analysis || ''}. Sentiment: ${typeof buzzNow.buzz_sentiment_analysis === 'object' ? buzzNow.buzz_sentiment_analysis.why_this_matters : buzzNow.buzz_sentiment_analysis || ''}. Focus: ${buzzNow.now_focus || ''}. Opening: ${buzzNow.now_opening_move || ''}` : undefined} onPersonaIntelUpdate={(intel) => {
          // Update account's executive_social with real persona data so all AI calls include it
          if (intel && intel.linkedin_summary && intel.linkedin_summary !== 'No LinkedIn data found') {
            setAccount(prev => {
              if (!prev) return prev;
              const existing = prev.public_intelligence.executive_social;
              const alreadyExists = existing.find(e => e.name === persona.name);
              const updatedSocial = alreadyExists
                ? existing.map(e => e.name === persona.name ? { ...e, post_theme: intel.recent_activity[0] || intel.interests[0] || intel.linkedin_summary.slice(0, 100) } : e)
                : [...existing, { name: persona.name, title: persona.title, post_theme: intel.recent_activity[0] || intel.interests[0] || intel.linkedin_summary.slice(0, 100) }];
              return {
                ...prev,
                public_intelligence: {
                  ...prev.public_intelligence,
                  executive_social: updatedSocial,
                },
              };
            });
            // New persona intel → regenerate the full unified analysis so all sections include it
            setAccount(prev => { if (prev) regenerateAnalysis(prev, tcData, true); return prev; });
            setRefreshKey(k => k + 1);
            setInsightPopup(null);
          }
        }} />
      </div>
    </div>
  );

  const tabs: { id: MainTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'brief', label: 'Brief', icon: FileText },
    { id: 'summary', label: 'Summary', icon: BookOpen },
    { id: 'demo', label: 'Demo', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-dark-900 flex justify-center">
      <div className="w-full max-w-[430px] md:max-w-[700px] pb-16 relative">
        {showScore && <ScoreExplainer account={account} onClose={() => setShowScore(false)} />}
        {showPersonaPicker && (
          <PersonaPickerSheet account={account} onSelect={(att) => { setShowPersonaPicker(false); setPersona(att); }} onClose={() => setShowPersonaPicker(false)} />
        )}

        {/* Header */}
        <header className="sticky top-0 z-50 bg-dark-800/90 backdrop-blur-md border-b border-dark-600">
          <div className="px-4 py-2.5 flex items-center gap-2">
            <button onClick={() => { setAccount(null); setTab('brief'); }} className="p-1 active:opacity-70">
              <ArrowLeft className="w-5 h-5 text-muted" />
            </button>
            <img src="/aws-logo.svg" alt="AWS" className="h-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-xs font-semibold text-white truncate">{account.customer_name}</h1>
              <p className="text-[10px] text-muted">{account.industry} · {account.segment} · {account.geo}</p>
            </div>
            <button onClick={() => setShowScore(true)} className="flex flex-col items-center active:opacity-80">
              <div className={`w-8 h-8 rounded-xl ${account.tc_opportunity_score >= 8 ? 'bg-green-500' : account.tc_opportunity_score >= 6 ? 'bg-orange-500' : 'bg-blue-500'} flex items-center justify-center text-white font-bold text-sm`}>
                {account.tc_opportunity_score}
              </div>
              <span className="text-[8px] text-muted mt-0.5">Score</span>
            </button>
            {/* Upload Attendees */}
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleAttendeeUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center active:opacity-80 relative" title="Upload Attendees CSV">
              <div className="w-8 h-8 rounded-xl bg-dark-700 border border-dark-600 flex items-center justify-center">
                <Upload className="w-4 h-4 text-slate-400" />
              </div>
              <span className="text-[8px] text-muted mt-0.5">Attendees</span>
              {uploadedAttendees.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 text-white text-[8px] flex items-center justify-center font-bold">{uploadedAttendees.length}</span>
              )}
            </button>
            {/* Upload Documents — any supporting doc (account plan, briefing, Databook...). Accumulates. */}
            <input ref={externalDocInputRef} type="file" accept=".txt,.csv,.docx,.pdf,.xlsx" onChange={handleDocumentUpload} className="hidden" />
            <button onClick={() => externalDocInputRef.current?.click()} className="flex flex-col items-center active:opacity-80 relative" title="Upload documents (account plan, briefing, Databook, any supporting file)">
              <div className="w-8 h-8 rounded-xl bg-dark-700 border border-dark-600 flex items-center justify-center">
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <span className="text-[8px] text-muted mt-0.5">Documents</span>
              {externalDocs.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[8px] flex items-center justify-center font-bold">{externalDocs.length}</span>
              )}
            </button>
          </div>
          {/* EBC info bar */}
          {account.ebc_data.meeting_dates[0] && (() => {
            const ebcDate = new Date(account.ebc_data.meeting_dates[0]);
            const daysUntil = Math.ceil((ebcDate.getTime() - Date.now()) / 86400000);
            return (
              <div className="px-4 py-1.5 flex items-center gap-3 text-[10px] text-muted border-t border-dark-700 flex-wrap">
                <span className="text-blue-400">📅 {ebcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span>{daysUntil > 0 ? `in ${daysUntil} days` : daysUntil === 0 ? 'Today' : `${Math.abs(daysUntil)}d ago`}</span>
                <span>📍 {account.ebc_data.location}</span>
                {account.ebc_data.status && <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${account.ebc_data.status === 'InProgress' ? 'bg-blue-500/15 text-blue-400' : 'bg-green-500/15 text-green-400'}`}>{account.ebc_data.status}</span>}
              </div>
            );
          })()}
          {/* Signal badges */}
          {account.signals.length > 0 && (
            <div className="px-4 py-1.5 flex flex-wrap gap-1.5 border-t border-dark-700">
              {account.signals.filter(s => !s.label.toLowerCase().includes('no direct') && !s.label.toLowerCase().includes('intelligence found')).slice(0, 3).map(s => (
                <span key={s.label} className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${s.severity === 'HIGH' ? 'bg-red-500/15 text-red-400' : 'bg-orange-500/15 text-orange-400'}`}>{s.label}</span>
              ))}
            </div>
          )}
          {/* Attendee upload confirmation */}
          {attendeeUploadMsg && (
            <div className="px-4 py-1.5 flex items-center gap-2 border-t border-dark-700 bg-green-500/10">
              <span className="text-[10px] text-green-400 font-medium">✓ {attendeeUploadMsg}</span>
            </div>
          )}
          {/* Now & Buzz bar — inside the sticky header */}
          <div className="flex border-t border-dark-600">
            <button onClick={() => setInsightPopup(insightPopup === 'now' ? null : 'now')}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 ${insightPopup === 'now' ? 'text-blue-400' : 'text-muted'}`}>
              <Zap className="w-4 h-4" />
              <span className="text-[9px] font-medium">Now</span>
            </button>
            <button onClick={() => setInsightPopup(insightPopup === 'buzz' ? null : 'buzz')}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 ${insightPopup === 'buzz' ? 'text-orange-400' : 'text-muted'}`}>
              <Megaphone className="w-4 h-4" />
              <span className="text-[9px] font-medium">Buzz</span>
            </button>
            <button onClick={openSlides}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 ${showSlides ? 'text-emerald-400' : 'text-muted'}`}
              title="Generate a 2-slide view to support the customer conversation">
              <Presentation className="w-4 h-4" />
              <span className="text-[9px] font-medium">Slides</span>
            </button>
          </div>
        </header>

        {/* Insight popup — Now / Buzz */}
        {insightPopup && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm" onClick={() => setInsightPopup(null)}>
            <div className="bg-dark-800 border border-dark-600 rounded-b-2xl w-full max-w-[430px] md:max-w-[700px] max-h-[70vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-white">{insightPopup === 'now' ? '⚡ What to focus on now' : '📢 What people are saying'}</h3>
                <button onClick={() => setInsightPopup(null)} className="p-2 rounded-lg active:bg-dark-700"><span className="text-muted text-lg">✕</span></button>
              </div>
              <div className="px-5 pb-5">
                {insightPopup === 'now' && (
                  analysisLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                      <span className="text-sm text-slate-400">Analyzing...</span>
                    </div>
                  ) : buzzNow ? (
                    <div className="space-y-3">
                      {buzzNow.now_focus && (
                        <div>
                          <span className="text-xs font-semibold text-muted uppercase">Focus</span>
                          <p className="text-sm text-slate-200 pl-3 border-l-2 border-blue-500/30 mt-1.5">
                            {buzzNow.now_focus}
                          </p>
                        </div>
                      )}
                      {buzzNow.now_initiatives && buzzNow.now_initiatives.length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-muted uppercase">Initiatives to drive</span>
                          <div className="space-y-1.5 mt-1.5">
                            {buzzNow.now_initiatives.map((item, i) => (
                              <div key={i} className="flex items-start gap-2"><span className="mt-1 w-2 h-2 rounded-full bg-blue-400 shrink-0" /><p className="text-xs text-slate-300">{item}</p></div>
                            ))}
                          </div>
                        </div>
                      )}
                      {buzzNow.now_key_asks && buzzNow.now_key_asks.length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-muted uppercase">Ask right now</span>
                          <div className="space-y-1 mt-1.5">
                            {buzzNow.now_key_asks.map((ask, i) => (
                              <p key={i} className="text-xs text-slate-300">→ {ask}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {buzzNow.now_opening_move && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                          <span className="text-[10px] font-semibold text-blue-400 uppercase">💡 Your opening move</span>
                          <p className="text-xs text-slate-300 mt-1">{buzzNow.now_opening_move}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-8">Click to analyze</p>
                  )
                )}
                {insightPopup === 'buzz' && (
                  analysisLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                      <span className="text-sm text-slate-400">Analyzing...</span>
                    </div>
                  ) : buzzNow ? (
                    <div className="space-y-3">
                      {/* AI Summary */}
                      {buzzNow.buzz_summary && (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3.5">
                          <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Signal Synthesis</span>
                          <p className="text-xs text-slate-200 mt-1.5">{buzzNow.buzz_summary}</p>
                        </div>
                      )}
                      {/* AI Executive Insights — only show if there's data */}
                      {((buzzNow.buzz_executive_insights && buzzNow.buzz_executive_insights.length > 0) || account.public_intelligence.executive_social.filter(e => e.name && !e.name.includes('UNAVAILABLE') && e.post_theme && !e.post_theme.includes('No executive social data')).length > 0 || account.ebc_data.attendees.length > 0) && (
                        <div>
                          <span className="text-xs font-semibold text-muted uppercase">Executive voices</span>
                          <div className="space-y-2 mt-1.5">
                            {buzzNow.buzz_executive_insights && buzzNow.buzz_executive_insights.length > 0 && (
                              buzzNow.buzz_executive_insights.map((insight, i) => (
                                <p key={i} className="text-xs text-slate-300 pl-2.5 border-l-2 border-purple-500/30">{insight}</p>
                              ))
                            )}
                            {/* Show uploaded attendees — no fake URLs */}
                            {account.ebc_data.attendees.length > 0 && account.public_intelligence.executive_social.filter(e => e.name && !e.name.includes('UNAVAILABLE')).length === 0 && (
                              <div className="mt-2 space-y-1.5">
                                <span className="text-[10px] text-muted">Confirmed attendees:</span>
                                {account.ebc_data.attendees.slice(0, 8).map(att => (
                                  <div key={att.name} className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-dark-700 flex items-center justify-center text-[8px] text-slate-300 font-bold shrink-0">{att.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                                    <div className="min-w-0">
                                      <span className="text-xs text-white">{att.name}</span>
                                      <span className="text-[10px] text-muted ml-1">{att.title}</span>
                                    </div>
                                  </div>
                                ))}
                                {account.ebc_data.attendees.length > 8 && <span className="text-[10px] text-muted">+{account.ebc_data.attendees.length - 8} more</span>}
                                <p className="text-[10px] text-purple-400 mt-1">💡 Add LinkedIn URLs in "Engage a Persona" for deeper research</p>
                              </div>
                            )}
                            {account.public_intelligence.executive_social.filter(e => e.name && !e.name.includes('UNAVAILABLE') && e.post_theme && !e.post_theme.includes('No executive social data')).length > 0 && (
                              <div className="mt-2 space-y-2">
                                {account.public_intelligence.executive_social.filter(e => e.name && !e.name.includes('UNAVAILABLE') && e.post_theme && !e.post_theme.includes('No executive social data')).map(e => (
                                  <div key={e.name} className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-dark-700 flex items-center justify-center text-[9px] text-slate-300 font-bold shrink-0">{e.name.split(' ').map(w => w[0]).join('')}</div>
                                    <div>
                                      <span className="text-xs font-medium text-white">{e.name}</span>
                                      <span className="text-[10px] text-muted ml-1">{e.title}</span>
                                      <p className="text-xs text-slate-400 italic mt-0.5">"{e.post_theme}"</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {/* AI Hiring Analysis — only show if there's data */}
                      {(account.public_intelligence.linkedin_job_postings.cloud_ai_roles > 0 || buzzNow.buzz_hiring_analysis) && (
                        <div className="pt-3 border-t border-dark-600">
                          <span className="text-xs font-semibold text-muted uppercase">Hiring & Skills Gap</span>
                          <div className="flex items-center gap-3 mt-1"><span className="text-xl font-bold text-white">{account.public_intelligence.linkedin_job_postings.cloud_ai_roles}</span><span className="text-xs text-muted">cloud/AI roles</span><span className="text-xs text-green-400">{account.public_intelligence.linkedin_job_postings.yoy_change} YoY</span></div>
                          {buzzNow.buzz_hiring_analysis && (
                            typeof buzzNow.buzz_hiring_analysis === 'object' && buzzNow.buzz_hiring_analysis.roles ? (
                              <div className="mt-3">
                                {buzzNow.buzz_hiring_analysis.roles.length > 0 && (
                                  <div className="space-y-1.5">
                                    {buzzNow.buzz_hiring_analysis.roles.map((role, i) => (
                                      <div key={i} className="flex items-start gap-2 pl-1">
                                        <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                                        {role.url ? (
                                          <a href={role.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline hover:text-blue-300">{role.title}</a>
                                        ) : (
                                          <span className="text-xs text-slate-200">{role.title}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {buzzNow.buzz_hiring_analysis.why_this_matters && (
                                  <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-dark-700 leading-relaxed">{buzzNow.buzz_hiring_analysis.why_this_matters}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-300 mt-2">{String(buzzNow.buzz_hiring_analysis)}</p>
                            )
                          )}
                        </div>
                      )}
                      {/* AI Sentiment — only show if there's data */}
                      {(buzzNow.buzz_sentiment_analysis || account.public_intelligence.glassdoor_signals.length > 0) && (
                        <div className="pt-3 border-t border-dark-600">
                          <span className="text-xs font-semibold text-muted uppercase">Employee Sentiment</span>
                          {buzzNow.buzz_sentiment_analysis ? (
                            typeof buzzNow.buzz_sentiment_analysis === 'object' && buzzNow.buzz_sentiment_analysis.signals ? (
                              <div className="mt-3">
                                {buzzNow.buzz_sentiment_analysis.signals.length > 0 && (
                                  <div className="space-y-2">
                                    {buzzNow.buzz_sentiment_analysis.signals.map((signal, i) => (
                                      <p key={i} className="text-xs text-slate-200 pl-3 border-l-2 border-orange-500/30">"{signal}"</p>
                                    ))}
                                  </div>
                                )}
                                {buzzNow.buzz_sentiment_analysis.why_this_matters && (
                                  <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-dark-700 leading-relaxed">{buzzNow.buzz_sentiment_analysis.why_this_matters}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-300 mt-2">{String(buzzNow.buzz_sentiment_analysis)}</p>
                            )
                          ) : (
                            account.public_intelligence.glassdoor_signals.map((s, i) => (<p key={i} className="text-xs text-slate-300 pl-2.5 border-l-2 border-dark-600 mt-1.5">"{s}"</p>))
                          )}
                        </div>
                      )}
                      {/* T&C Opportunity — separate section */}
                      {buzzNow.buzz_tc_opportunity && (
                        <div className="pt-3 border-t border-dark-600">
                          <span className="text-xs font-semibold text-muted uppercase">Training Opportunity</span>
                          <div className="mt-2 bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                            <p className="text-xs text-slate-200 leading-relaxed">{buzzNow.buzz_tc_opportunity}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-8">Click to analyze</p>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Slides popup — max 2-slide executive support deck */}
        {showSlides && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSlides(false)}>
            <div className="bg-dark-800 border border-dark-600 rounded-b-2xl w-full max-w-[430px] md:max-w-[760px] max-h-[85vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Presentation className="w-4 h-4 text-emerald-400" /> Conversation slides</h3>
                <div className="flex items-center gap-1">
                  {slides && slides.slides.length > 0 && !slidesLoading && (
                    <>
                      <button onClick={() => exportSlidesToPPTX(slides, account.customer_name).catch(err => console.error('PPTX export failed:', err))}
                        className="text-[10px] text-slate-300 border border-dark-600 px-2 py-1 rounded-lg active:bg-dark-700" title="Download PowerPoint">⬇ PPTX</button>
                      <button onClick={() => exportSlidesToPDF(slides, account.customer_name).catch(err => console.error('PDF export failed:', err))}
                        className="text-[10px] text-slate-300 border border-dark-600 px-2 py-1 rounded-lg active:bg-dark-700" title="Download PDF">⬇ PDF</button>
                      <button onClick={() => { setSlides(null); setSlidesLoading(true); generateSlides(account, analysis).then(setSlides).catch(err => console.error('Slide regen failed:', err)).finally(() => setSlidesLoading(false)); }}
                        className="text-[10px] text-emerald-400 px-2 py-1 rounded-lg active:bg-dark-700" title="Regenerate">↻</button>
                    </>
                  )}
                  <button onClick={() => setShowSlides(false)} className="p-2 rounded-lg active:bg-dark-700"><span className="text-muted text-lg">✕</span></button>
                </div>
              </div>
              <div className="px-5 pb-5">
                {slidesLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                    <span className="text-sm text-slate-400">Building your slides...</span>
                  </div>
                ) : slides && slides.slides.length > 0 ? (
                  <div className="space-y-4">
                    {slides.deck_title && (
                      <p className="text-[11px] uppercase tracking-wide text-emerald-400/80 font-semibold">{slides.deck_title}</p>
                    )}
                    {/* Current slide (16:9-ish card) */}
                    {(() => {
                      const s = slides.slides[Math.min(slideIndex, slides.slides.length - 1)];
                      return (
                        <div className="bg-gradient-to-br from-dark-700 to-dark-800 border border-dark-600 rounded-xl p-5 min-h-[260px] flex flex-col">
                          <div className="border-b border-dark-600 pb-3 mb-3">
                            <h4 className="text-base md:text-lg font-bold text-white leading-snug">{s.title}</h4>
                            {s.subtitle && <p className="text-xs text-slate-400 mt-1">{s.subtitle}</p>}
                          </div>
                          <ul className="space-y-2.5 flex-1">
                            {s.bullets.map((b, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span className="text-sm text-slate-200 leading-relaxed">{b}</span>
                              </li>
                            ))}
                          </ul>
                          {s.footer && (
                            <div className="mt-3 pt-3 border-t border-dark-600">
                              <p className="text-xs text-emerald-300 font-medium leading-relaxed">{s.footer}</p>
                            </div>
                          )}
                          <div className="mt-3 text-right"><span className="text-[10px] text-muted">Slide {Math.min(slideIndex, slides.slides.length - 1) + 1} of {slides.slides.length}</span></div>
                        </div>
                      );
                    })()}
                    {/* Slide nav (only if 2 slides) */}
                    {slides.slides.length > 1 && (
                      <div className="flex items-center justify-center gap-2">
                        {slides.slides.map((_, i) => (
                          <button key={i} onClick={() => setSlideIndex(i)}
                            className={`h-2 rounded-full transition-all ${i === Math.min(slideIndex, slides.slides.length - 1) ? 'w-6 bg-emerald-400' : 'w-2 bg-dark-600'}`}
                            aria-label={`Go to slide ${i + 1}`} />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-12">No slides yet. Close and reopen to generate.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="px-4 py-4">
          {loadingIntel ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
              <span className="text-sm text-slate-400">Loading...</span>
            </div>
          ) : (
            <>
              {tab === 'brief' && <ExecBrief key={refreshKey} account={account} onEngagePersona={() => setShowPersonaPicker(true)} tcData={tcData} analysis={analysis} analysisLoading={analysisLoading} />}
              {tab === 'summary' && <SummaryView account={account} />}
              {tab === 'demo' && (
                <div className="space-y-3 py-2">
                  <p className="text-xs text-muted">Switch to demo accounts with pre-built data:</p>
                  {accounts.filter(a => ['Oceanic Capital Corporation', 'MedVista Health Systems', 'NordicRetail Group'].includes(a.customer_name)).map(a => (
                    <button key={a.customer_name} onClick={() => { setAccount(a); setTab('brief'); setAnalysis(null); setRefreshKey(k => k + 1); }}
                      className="w-full text-left p-3 bg-dark-800 border border-dark-600 rounded-xl active:bg-dark-700">
                      <span className="text-sm font-medium text-white">{a.customer_name}</span>
                      <p className="text-[11px] text-muted mt-0.5">{a.industry} · {a.segment} · {a.geo}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:max-w-[700px] bg-dark-800/95 backdrop-blur-md border-t border-dark-600 z-50">
          <div className="flex">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 ${tab === t.id ? 'text-purple-500' : 'text-muted'}`}>
                <t.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>

      </div>
    </div>
  );
}
