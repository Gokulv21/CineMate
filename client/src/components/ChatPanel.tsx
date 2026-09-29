import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Heart, MessageSquare } from 'lucide-react';
import type { ChatMessage } from '../types/index.js';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentParticipantId: string;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  reactionsEnabled: boolean;
}

const QUICK_EMOJIS = ['💚', '❤️', '😂', '😭', '😱', '🔥', '👏'];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentParticipantId,
  onSendMessage,
  onSendReaction,
  reactionsEnabled
}) => {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInputText('');
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/80 rounded-2xl border border-zinc-800/80 overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white tracking-wide uppercase">
            {t('chat.title')}
          </h3>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">
          {messages.length} msg
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Heart className="w-8 h-8 text-emerald-500/20 mb-2" />
            <p className="text-xs leading-relaxed max-w-[200px]">
              {t('chat.empty')}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentParticipantId;
            const isSystem = msg.type === 'SYSTEM';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-1.5">
                  <span className="text-[10px] text-zinc-400 bg-zinc-900/90 border border-zinc-800 px-2.5 py-1 rounded-full text-center max-w-[90%]">
                    {msg.message}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className={`text-[10px] font-semibold ${isMe ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {isMe ? t('chat.you') : msg.senderName}
                  </span>
                  <span className="text-[9px] text-zinc-600 font-mono">
                    {formatMessageTime(msg.timestamp)}
                  </span>
                </div>

                <div
                  className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed ${
                    isMe
                      ? 'bg-emerald-600 text-white rounded-tr-none shadow-md shadow-emerald-950/40'
                      : 'bg-zinc-800/90 text-zinc-200 rounded-tl-none border border-zinc-700/60'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {reactionsEnabled && (
        <div className="px-3 py-1.5 border-t border-zinc-800/60 bg-zinc-900/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSendReaction(emoji)}
                className={`w-7 h-7 flex items-center justify-center text-sm rounded-lg hover:bg-zinc-800/80 active:scale-125 transition-transform cursor-pointer ${
                  emoji === '💚' ? 'bg-emerald-500/10 border border-emerald-500/30' : ''
                }`}
                title={`Send ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSend} className="p-2.5 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t('chat.placeholder')}
          maxLength={500}
          className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center cursor-pointer"
          aria-label={t('chat.send')}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
