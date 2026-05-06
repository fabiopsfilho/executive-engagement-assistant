import { X, MapPin, Calendar, Copy, Check, ChevronDown, ChevronUp, Presentation, Download } from 'lucide-react';
import { useState } from 'react';
import type { Agenda, AgendaBlock } from '../data/agendas';

const typeColors: Record<AgendaBlock['type'], string> = {
  welcome: 'border-amber-500/40 bg-amber-500/5',
  discovery: 'border-sky-500/40 bg-sky-500/5',
  insight: 'border-violet-500/40 bg-violet-500/5',
  demo: 'border-emerald-500/40 bg-emerald-500/5',
  workshop: 'border-rose-500/40 bg-rose-500/5',
  action: 'border-amber-500/40 bg-amber-500/5',
  break: 'border-slate-500/30 bg-slate-500/5',
};

const typeLabels: Record<AgendaBlock['type'], string> = {
  welcome: 'Welcome', discovery: 'Discovery', insight: 'Insight',
  demo: 'Demo', workshop: 'Workshop', action: 'Action', break: 'Break',
};

function CopyAll({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-600 active:bg-dark-700 text-xs text-slate-300 transition-colors"
      aria-label="Copy full agenda"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy Agenda'}
    </button>
  );
}

function exportSlides(agenda: Agenda) {
  const slideBlocks = agenda.blocks.filter(b => b.type !== 'break');
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${agenda.title} — Slides</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a1628;color:#e2e8f0}
.slide{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:3rem 2.5rem;max-width:900px;margin:0 auto;page-break-after:always}
.slide-num{font-size:.65rem;color:#64748b;text-transform:uppercase;letter-spacing:.15em;margin-bottom:1.5rem}
.slide h2{font-size:2rem;font-weight:700;color:#fff;margin-bottom:1rem;line-height:1.2}
.slide .time{font-size:.85rem;color:#fbbf24;font-family:monospace;margin-bottom:1.5rem}
.slide p{font-size:1.05rem;line-height:1.8;color:#94a3b8;margin-bottom:1rem}
.connected{margin-top:1.5rem;padding:1rem;background:rgba(56,189,248,.05);border-left:3px solid rgba(56,189,248,.3);border-radius:0 .5rem .5rem 0}
.connected p{font-size:.8rem;color:rgba(56,189,248,.8);margin:0}
.title-slide{background:linear-gradient(135deg,rgba(251,191,36,.08),rgba(249,115,22,.08));border:1px solid rgba(251,191,36,.15);border-radius:1rem;padding:3rem}
.title-slide h1{font-size:2.5rem;color:#fff;margin-bottom:.5rem}
.title-slide .sub{font-size:1.1rem;color:#94a3b8;margin-bottom:2rem}
.title-slide .meta{font-size:.85rem;color:#64748b}
.principles{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}
.principles span{font-size:.75rem;padding:.25rem .75rem;background:rgba(251,191,36,.1);color:#fbbf24;border-radius:.5rem}
@media print{.slide{min-height:auto;padding:2rem 0}.connected{display:none}}
</style></head><body>
<div class="slide">
  <div class="title-slide">
    <h1>${agenda.title}</h1>
    <div class="sub">${agenda.subtitle}</div>
    <div class="meta">📅 ${agenda.date} &nbsp; 📍 ${agenda.location} &nbsp; ⏱ ${agenda.format}</div>
    <div class="principles">${agenda.principles.map(p => `<span>${p.split(' — ')[0]}</span>`).join('')}</div>
  </div>
</div>
${slideBlocks.map((b, i) => `
<div class="slide">
  <div class="slide-num">Slide ${i + 2} of ${slideBlocks.length + 1} &nbsp;·&nbsp; ${b.time} (${b.duration})</div>
  <h2>${b.title}</h2>
  <div class="time">${b.time} — ${b.duration} — ${b.owner}</div>
  ${b.description.split('. ').reduce((acc: string[][], s, idx) => {
    const group = Math.floor(idx / 2);
    if (!acc[group]) acc[group] = [];
    acc[group].push(s);
    return acc;
  }, []).map(group => `<p>${group.join('. ')}.</p>`).join('')}
  ${b.connectedTo ? `<div class="connected"><p>${b.connectedTo}</p></div>` : ''}
</div>
`).join('')}
<div class="slide">
  <div class="slide-num">Preparation Checklist</div>
  <h2>Before the Session</h2>
  ${agenda.preparation_notes.map((n, i) => `<p>${i + 1}. ${n}</p>`).join('')}
</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${agenda.title.replace(/[^a-zA-Z0-9]/g, '_')}_Slides.html`;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportWordDoc(agenda: Agenda) {
  // Generate a Word-compatible HTML document (opens in Word when saved as .doc)
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${agenda.title}</title>
<style>body{font-family:Calibri,sans-serif;margin:2cm}h1{font-size:20pt;color:#232f3e}h2{font-size:14pt;color:#232f3e;margin-top:18pt}h3{font-size:12pt;margin-top:12pt}.meta{color:#666;font-size:10pt;margin-bottom:12pt}.block{margin-bottom:12pt;padding:8pt;border-left:3pt solid #7c3aed;background:#f8f9fa}.block .time{font-family:monospace;color:#7c3aed;font-size:10pt}.block h4{font-size:11pt;margin:4pt 0}.block p{font-size:10pt;color:#333;line-height:1.5}.block .owner{font-size:9pt;color:#666;font-style:italic}ul{margin:6pt 0}li{font-size:10pt;margin-bottom:4pt}</style></head>
<body>
<h1>${agenda.title}</h1>
<p class="meta">${agenda.subtitle}<br>${agenda.format} | ${agenda.date} | ${agenda.location}</p>
<h2>Leadership Principles</h2>
<ul>${agenda.principles.map(p => `<li>${p}</li>`).join('')}</ul>
<h2>Agenda</h2>
${agenda.blocks.map(b => `<div class="block"><span class="time">${b.time} (${b.duration})</span><h4>${b.title}</h4><p>${b.description}</p><p class="owner">Owner: ${b.owner}</p></div>`).join('')}
<h2>Preparation Checklist</h2>
<ul>${agenda.preparation_notes.map((n, i) => `<li>${i + 1}. ${n}</li>`).join('')}</ul>
</body></html>`;

  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${agenda.title.replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AgendaModal({ agenda, onClose }: { agenda: Agenda; onClose: () => void }) {
  const [expandedPrep, setExpandedPrep] = useState(false);

  const fullText = [
    agenda.title,
    agenda.subtitle,
    `Format: ${agenda.format}`,
    `Location: ${agenda.location}`,
    `Date: ${agenda.date}`,
    '',
    'AWS Leadership Principles Applied:',
    ...agenda.principles.map(p => `• ${p}`),
    '',
    'AGENDA:',
    ...agenda.blocks.map(b => `${b.time} (${b.duration}) — ${b.title}\n${b.description}\nOwner: ${b.owner}`),
    '',
    'PREPARATION NOTES:',
    ...agenda.preparation_notes.map(n => `• ${n}`)
  ].join('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="bg-dark-800 border border-dark-600 rounded-b-2xl w-full max-w-[430px] max-h-[90vh] overflow-y-auto animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-dark-600">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white leading-tight flex-1 mr-2">{agenda.title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg active:bg-dark-700 shrink-0" aria-label="Close">
              <X className="w-5 h-5 text-muted" />
            </button>
          </div>
          <p className="text-xs text-muted">{agenda.subtitle}</p>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{agenda.date}</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{agenda.location}</span>
          </div>
          <div className="flex gap-1.5 mt-3">
            <CopyAll text={fullText} />
            <button onClick={() => exportSlides(agenda)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500 text-xs text-white font-medium active:opacity-80">
              <Presentation className="w-3.5 h-3.5" />Slides
            </button>
            <button onClick={() => exportWordDoc(agenda)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-xs text-white font-medium active:opacity-80">
              <Download className="w-3.5 h-3.5" />Word
            </button>
          </div>
        </div>

        {/* AWS Principles */}
        <div className="px-4 py-3 border-b border-dark-600">
          <div className="flex flex-wrap gap-1.5">
            {agenda.principles.map(p => (
              <span key={p} className="text-[11px] px-2 py-0.5 bg-purple-500/15 text-purple-400 rounded-lg">{p.split(' — ')[0]}</span>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="px-4 py-4 space-y-2.5 max-h-[55vh] overflow-y-auto">
          {agenda.blocks.map((block, i) => (
            <div key={i} className={`border-l-2 ${typeColors[block.type]} rounded-r-xl p-3`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-purple-400">{block.time}</span>
                <span className="text-[11px] text-muted">{block.duration}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-medium ${
                  block.type === 'break' ? 'bg-dark-600 text-muted' : 'bg-dark-600 text-slate-300'
                }`}>{typeLabels[block.type]}</span>
              </div>
              <h4 className="text-sm font-semibold text-white mb-1">{block.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{block.description}</p>
              {block.connectedTo && (
                <p className="text-[11px] text-blue-400/80 leading-relaxed mt-2 pl-2 border-l-2 border-blue-500/30">{block.connectedTo}</p>
              )}
              <div className="mt-1.5 text-[11px] text-muted">Owner: {block.owner}</div>
            </div>
          ))}
        </div>

        {/* Preparation Notes */}
        <div className="px-4 py-3 border-t border-dark-600">
          <button
            onClick={() => setExpandedPrep(!expandedPrep)}
            className="flex items-center gap-2 w-full text-left"
            aria-expanded={expandedPrep}
          >
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Preparation Checklist</h3>
            {expandedPrep ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>
          {expandedPrep && (
            <ul className="mt-3 space-y-2">
              {agenda.preparation_notes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="w-5 h-5 rounded bg-dark-600 flex items-center justify-center text-[10px] text-muted shrink-0 mt-0.5">{i + 1}</span>
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
