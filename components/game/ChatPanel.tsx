'use client';

import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Send } from 'lucide-react';
import { ChatMessage } from '@/lib/game/types';

interface ChatPanelProps {
  gameId: string;
  channel: string;
  title: string;
  myUid: string;
  myName: string;
  canSend?: boolean;
  silenced?: boolean;
  accentColor?: string;
}

export function ChatPanel({ gameId, channel, title, myUid, myName, canSend = true, silenced = false, accentColor = 'white' }: ChatPanelProps) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'games', gameId, channel), orderBy('createdAt', 'asc'), limit(200));
    return onSnapshot(q, snap => {
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
  }, [gameId, channel]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending || silenced) return;
    setSending(true);
    await addDoc(collection(db, 'games', gameId, channel), {
      senderId: myUid, senderName: myName, text: text.trim(), createdAt: serverTimestamp(),
    });
    setText('');
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full bg-black/30 border border-white/10 rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-white/10 flex-shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: accentColor }}>{title}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.length === 0 && <p className="text-white/20 text-xs text-center mt-4">Silencio...</p>}
        {msgs.map(m => (
          <div key={m.id} className={`${m.isSystem ? 'text-center' : ''}`}>
            {m.isSystem ? (
              <p className="text-yellow-400/80 text-xs italic">{m.text}</p>
            ) : (
              <div className={`flex gap-1.5 ${m.senderId === myUid ? 'flex-row-reverse' : ''}`}>
                <div className={`max-w-[80%] flex flex-col ${m.senderId === myUid ? 'items-end' : 'items-start'}`}>
                  {m.senderId !== myUid && <span className="text-[10px] text-white/40 mb-0.5">{m.senderName}</span>}
                  <div className={`px-2.5 py-1.5 rounded-xl text-sm ${m.senderId === myUid ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                    {m.text}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {canSend && (
        <form onSubmit={send} className="p-2 border-t border-white/10 flex gap-2 flex-shrink-0">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={silenced ? '🤫 Estás silenciado' : 'Escribe...'}
            disabled={silenced}
            maxLength={300}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 disabled:opacity-40"
          />
          <button type="submit" disabled={!text.trim() || sending || silenced} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-30 transition-colors">
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
}
