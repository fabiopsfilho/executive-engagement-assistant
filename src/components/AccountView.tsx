import { useState } from 'react';
import { BookOpen, BarChart3, Bot, Plus, X, Link2, StickyNote, RefreshCw } from 'lucide-react';
import type { Account } from '../types';
import { AccountStory } from './AccountStory';
import { AccountData } from './AccountData';
import { AdvisorChat } from './AdvisorChat';

type Tab = 'story' | 'data' | 'advisor';

export interface NoteItem {
  id: string;
  text: string;
  url?: string;
}

export function AccountView({ account, onEngagePersona }: {
  account: Account;
  onEngagePersona: () => void;
}) {
  const [tab, setTab] = useState<Tab>('story');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteUrl, setNoteUrl] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const addNote = () => {
    if (!noteText.trim()) return;
    setNotes(prev => [...prev, { id: Date.now().toString(), text: noteText.trim(), url: noteUrl.trim() || undefined }]);
    setNoteText('');
    setNoteUrl('');
    setShowNoteInput(false);
  };

  const removeNote = (id: string) => setNotes(prev => prev.filter(n => n.id !== id));

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'story', label: 'Story', icon: BookOpen },
    { id: 'data', label: 'Data', icon: BarChart3 },
    { id: 'advisor', label: 'Advisor', icon: Bot },
  ];

  return (
    <div>
      {/* Tab Bar */}
      <div className="sticky top-[53px] z-40 bg-navy-900 border-b border-navy-700">
        <div className="flex">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${
                tab === t.id ? 'text-amber-400' : 'text-slate-400 active:text-slate-300'
              }`}
              aria-label={t.label}
              aria-selected={tab === t.id}
              role="tab"
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {tab === t.id && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-amber-400 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Bar */}
      <div className="px-4 pt-3">
        {notes.length > 0 && (
          <div className="space-y-2 mb-2">
            {notes.map(n => (
              <div key={n.id} className="flex items-start gap-2 bg-navy-800 border border-navy-600 rounded-lg p-2.5">
                <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-200">{n.text}</p>
                  {n.url && (
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-400 flex items-center gap-1 mt-0.5 truncate">
                      <Link2 className="w-3 h-3 shrink-0" />{n.url}
                    </a>
                  )}
                </div>
                <button onClick={() => removeNote(n.id)} className="p-1 rounded active:bg-navy-700 shrink-0" aria-label="Remove">
                  <X className="w-3 h-3 text-slate-500" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium active:opacity-80"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate with your notes
            </button>
          </div>
        )}

        {showNoteInput ? (
          <div className="bg-navy-800 border border-amber-500/30 rounded-xl p-3 mb-3 space-y-2">
            <input type="text" placeholder="Add a topic or note..." value={noteText} onChange={e => setNoteText(e.target.value)}
              className="w-full px-3 py-2 bg-navy-900/50 border border-navy-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50" autoFocus />
            <input type="url" placeholder="URL (optional)" value={noteUrl} onChange={e => setNoteUrl(e.target.value)}
              className="w-full px-3 py-2 bg-navy-900/50 border border-navy-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50" />
            <div className="flex gap-2">
              <button onClick={addNote} className="flex-1 py-2 rounded-lg bg-amber-500 text-navy-900 text-xs font-semibold active:opacity-90">Add</button>
              <button onClick={() => { setShowNoteInput(false); setNoteText(''); setNoteUrl(''); }} className="px-4 py-2 rounded-lg border border-navy-600 text-xs text-slate-400 active:bg-navy-700">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowNoteInput(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-navy-600 text-xs text-slate-500 active:bg-navy-800 mb-1">
            <Plus className="w-3.5 h-3.5" />Add topic or reference
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="px-4 py-3">
        {tab === 'story' && <AccountStory key={refreshKey} account={account} notes={notes} onEngagePersona={onEngagePersona} />}
        {tab === 'data' && <AccountData account={account} />}
        {tab === 'advisor' && <AdvisorChat account={account} />}
      </div>
    </div>
  );
}
