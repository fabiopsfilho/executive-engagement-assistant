import { useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Check, Download, StickyNote, Link2 } from 'lucide-react';
import type { Account, Attendee, EngagementPlan } from '../types';
import { generatePitch } from '../data/pitches';
import type { PitchSlide } from '../data/pitches';
import type { PersonaNote } from './PersonaView';

const slideColors: Record<PitchSlide['type'], string> = {
  title: 'from-amber-500 to-orange-500',
  story: 'from-rose-500 to-pink-500',
  data: 'from-sky-500 to-blue-500',
  insight: 'from-violet-500 to-purple-500',
  action: 'from-emerald-500 to-teal-500',
  close: 'from-amber-500 to-orange-500',
};

function exportAsHTML(pitch: ReturnType<typeof generatePitch>) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${pitch.title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a1628;color:#e2e8f0}
.slide{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:2rem;max-width:800px;margin:0 auto;page-break-after:always}
.slide-num{font-size:.75rem;color:#64748b;margin-bottom:1rem;text-transform:uppercase;letter-spacing:.1em}
.slide h2{font-size:1.75rem;font-weight:700;color:#fff;margin-bottom:1.5rem;line-height:1.3}
.slide p{font-size:1rem;line-height:1.7;color:#cbd5e1;margin-bottom:1rem}
.notes{margin-top:2rem;padding:1rem;background:rgba(251,191,36,.05);border:1px solid rgba(251,191,36,.15);border-radius:.75rem}
.notes-label{font-size:.7rem;color:#fbbf24;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.5rem}
.notes p{font-size:.85rem;font-style:italic;color:#94a3b8}
.divider{border:none;border-top:1px solid #1a2a4a;margin:2rem 0}
@media print{.slide{min-height:auto;padding:1.5rem 0}.notes{display:none}}
</style></head><body>
${pitch.slides.map(s => `
<div class="slide">
  <div class="slide-num">Slide ${s.slideNumber} — ${s.type}</div>
  <h2>${s.title}</h2>
  ${s.content.split('\n\n').map(p => `<p>${p}</p>`).join('')}
  <div class="notes">
    <div class="notes-label">Speaker Notes</div>
    <p>${s.speakerNotes}</p>
  </div>
</div>
<hr class="divider">
`).join('')}
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${pitch.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

export function PitchView({ account, persona, plan, notes = [] }: { account: Account; persona: Attendee; plan: EngagementPlan; notes?: PersonaNote[] }) {
  const pitch = generatePitch(account, persona, plan, notes);
  const [current, setCurrent] = useState(0);
  const [showNotes, setShowNotes] = useState(true);
  const [copied, setCopied] = useState(false);
  const slide = pitch.slides[current];
  const gradient = slideColors[slide.type];

  const fullText = pitch.slides.map(s =>
    `--- SLIDE ${s.slideNumber}: ${s.title} ---\n${s.content}\n\nSPEAKER NOTES: ${s.speakerNotes}`
  ).join('\n\n');

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Notes from persona */}
      {notes.length > 0 && (
        <div className="mb-4 bg-violet-500/5 border border-violet-500/15 rounded-xl p-3">
          <span className="text-[11px] text-violet-400 font-semibold uppercase tracking-wider">Your Notes for This Pitch</span>
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

      {/* Header with actions */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-slate-500">{pitch.duration} · {pitch.slides.length} slides</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { navigator.clipboard.writeText(fullText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 border border-navy-600 text-xs text-slate-300 active:bg-navy-700"
            aria-label="Copy all slides"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            Copy All
          </button>
          <button
            onClick={() => exportAsHTML(pitch)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-xs text-navy-900 font-semibold active:opacity-90"
            aria-label="Export slides"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Slide dots */}
      <div className="flex items-center justify-center gap-1.5 mb-4">
        {pitch.slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
              i === current
                ? `bg-gradient-to-br ${slideColors[s.type]} text-white shadow-lg`
                : 'bg-navy-800 text-slate-500 active:bg-navy-700'
            }`}
            aria-label={`Slide ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Slide Content */}
      <div className={`bg-gradient-to-r ${gradient} p-[1px] rounded-xl mb-4`}>
        <div className="bg-navy-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold bg-gradient-to-r ${gradient} text-white`}>
              {slide.type}
            </span>
            <span className="text-xs text-slate-500">Slide {slide.slideNumber} of {pitch.slides.length}</span>
          </div>

          <h3 className="text-xl font-bold text-white mb-4 leading-tight">{slide.title}</h3>

          <div className="bg-navy-900/50 rounded-lg p-4 min-h-[120px]">
            {slide.content.split('\n\n').map((p, i) => (
              <p key={i} className="text-sm text-slate-200 leading-relaxed mb-2.5 last:mb-0">{p}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Speaker Notes */}
      <button
        onClick={() => setShowNotes(!showNotes)}
        className="flex items-center gap-2 mb-2 text-xs text-slate-400 active:text-slate-300"
        aria-expanded={showNotes}
      >
        <StickyNote className="w-3.5 h-3.5" />
        Speaker Notes {showNotes ? '▾' : '▸'}
      </button>
      {showNotes && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 mb-4">
          <p className="text-sm text-slate-300 leading-relaxed italic">{slide.speakerNotes}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between py-4">
        <button
          onClick={() => setCurrent(Math.max(0, current - 1))}
          disabled={current === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-navy-800 border border-navy-600 text-sm text-slate-300 active:bg-navy-700 disabled:opacity-30"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className="text-xs text-slate-500">{current + 1} / {pitch.slides.length}</span>
        <button
          onClick={() => setCurrent(Math.min(pitch.slides.length - 1, current + 1))}
          disabled={current === pitch.slides.length - 1}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-navy-800 border border-navy-600 text-sm text-slate-300 active:bg-navy-700 disabled:opacity-30"
          aria-label="Next slide"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
