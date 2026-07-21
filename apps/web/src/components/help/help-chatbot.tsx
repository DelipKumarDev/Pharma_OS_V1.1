'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HelpCircle, X, Minus, Maximize2, Minimize2, Send, ArrowRight, ChevronRight, LifeBuoy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KB, searchKb, type KbArticle } from './knowledge-base';
import { useAuthStore } from '@/store/auth-store';

const DEFAULT_SUPPORT = 'support@pharmaos.in';

interface Msg {
  id: number;
  from: 'user' | 'bot';
  text?: string;
  articles?: KbArticle[];
  showSupport?: boolean;
}

const SUGGESTIONS = ['Add a medicine', 'Create a bill', 'Scan a purchase bill', 'Change WhatsApp message', 'View GSTR-1'];

export function HelpChatbot() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const seq = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (open && msgs.length === 0) {
      push({ from: 'bot', text: 'Hi! I can help you use PharmaOS. Ask me how to do something, or pick a topic below.' });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs]);

  function push(m: Omit<Msg, 'id'>) { setMsgs(prev => [...prev, { ...m, id: seq.current++ }]); }

  function ask(qRaw: string) {
    const q = qRaw.trim();
    if (!q) return;
    push({ from: 'user', text: q });
    setInput('');
    const results = searchKb(q);
    const top = results[0];
    setTimeout(() => {
      if (top) {
        push({ from: 'bot', text: `Here's how to ${top.title.toLowerCase()}:`, articles: results, showSupport: true });
      } else {
        push({ from: 'bot', text: "I couldn't find that in the guides. Try rephrasing, or reach our support team.", showSupport: true });
      }
    }, 250);
  }

  const supportHref = () => {
    const contact = (user?.supportContact ?? '').trim() || DEFAULT_SUPPORT;
    // A configured URL (ticket form / help desk) is linked directly; otherwise
    // treat it as an email and open a pre-filled mailto.
    if (/^https?:\/\//i.test(contact)) return contact;
    const email = contact.replace(/^mailto:/i, '');
    const subject = encodeURIComponent('PharmaOS support request');
    const body = encodeURIComponent(`Pharmacy: ${user?.tenantName ?? ''}\nUser: ${user?.name ?? ''} (${user?.email ?? ''})\n\nMy question:\n`);
    return `mailto:${email}?subject=${subject}&body=${body}`;
  };

  // Launcher
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Help"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <HelpCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all',
        maximized ? 'bottom-4 right-4 h-[85vh] w-[min(560px,92vw)]' : 'bottom-5 right-5 h-[560px] w-[min(380px,92vw)]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20"><Sparkles className="h-4 w-4" /></div>
          <div>
            <p className="text-sm font-semibold leading-tight">PharmaOS Help</p>
            <p className="text-2xs opacity-80 leading-tight">Guides & how-to</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMaximized(m => !m)} aria-label={maximized ? 'Restore' : 'Maximize'} className="rounded-md p-1.5 hover:bg-white/15">
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button onClick={() => setOpen(false)} aria-label="Minimize" className="rounded-md p-1.5 hover:bg-white/15"><Minus className="h-4 w-4" /></button>
          <button onClick={() => { setOpen(false); setMsgs([]); setMaximized(false); }} aria-label="Close" className="rounded-md p-1.5 hover:bg-white/15"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Body */}
      <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-3">
        {msgs.map(m => (
          <div key={m.id} className={cn('flex', m.from === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%] space-y-2', m.from === 'user' ? '' : 'w-full')}>
              {m.text && (
                <div className={cn('rounded-2xl px-3 py-2 text-sm', m.from === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border')}>
                  {m.text}
                </div>
              )}
              {m.articles?.map(a => (
                <div key={a.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">{a.intro}</p>
                  {/* click path */}
                  <div className="mt-2 flex flex-wrap items-center gap-1 text-2xs text-muted-foreground">
                    {a.path.map((p, i) => (
                      <React.Fragment key={p}>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{p}</span>
                        {i < a.path.length - 1 && <ChevronRight className="h-3 w-3" />}
                      </React.Fragment>
                    ))}
                  </div>
                  {a.image && <img src={a.image} alt={a.title} className="mt-2 w-full rounded-lg border border-border" />}
                  <ol className="mt-2 space-y-1 pl-4 text-xs">
                    {a.steps.map((s, i) => <li key={i} className="list-decimal text-muted-foreground"><span className="text-foreground">{s}</span></li>)}
                  </ol>
                  <button
                    onClick={() => { router.push(a.route); setOpen(false); }}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-2xs font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Take me there <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {m.showSupport && (
                <div className="rounded-xl border border-dashed border-border bg-card p-3">
                  <p className="text-2xs text-muted-foreground">Didn't solve it?</p>
                  <a href={supportHref()} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    <LifeBuoy className="h-3.5 w-3.5" /> Contact our support team
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Suggestions (only before first question) */}
        {msgs.filter(m => m.from === 'user').length === 0 && (
          <div className="space-y-1.5 pt-1">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => ask(s)} className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-left text-xs hover:border-primary hover:bg-primary/5">
                <span>{s}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 border-t border-border bg-card p-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask how to do something…"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button type="submit" disabled={!input.trim()} aria-label="Send" className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
