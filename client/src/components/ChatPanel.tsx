import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, MessageSquare } from 'lucide-react';
import type { ChatMessage } from '../types/index.js';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentParticipantId: string;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  reactionsEnabled: boolean;
}

const QUICK_EMOJIS = ['💚', '🍿', '😂', '😭', '🔥', '👏'];

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
    <div className="flex flex-col h-full cinema-surface rounded-3xl overflow-hidden shadow-2xl">
      <div className="px-4 py-3.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-rose-400" />
          <h3 className="text-xs font-bold text-white tracking-wide uppercase">
            {t('chat.title')}
          </h3>
        </div>
        <span className="text-[10px] text-zinc-400 font-mono font-bold bg-white/[0.06] px-2 py-0.5 rounded-full">
          {messages.length} msgs
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <MessageSquare className="w-8 h-8 text-rose-500/30 mb-2" />
            <p className="text-xs text-zinc-400 leading-relaxed max-w-[200px]">
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
                  <span className="text-[10px] text-zinc-300 bg-[#161426]/90 border border-white/[0.08] px-3 py-1 rounded-full text-center max-w-[90%] font-medium">
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
                  <span className={`text-[10px] font-bold ${isMe ? 'text-rose-400' : 'text-zinc-300'}`}>
                    {isMe ? t('chat.you') : msg.senderName}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono">
                    {formatMessageTime(msg.timestamp)}
                  </span>
                </div>

                <div
                  className={`px-3.5 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed ${isMe
                    ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 text-white rounded-tr-none shadow-md shadow-rose-950/50 font-medium'
                    : 'bg-[#181628] text-zinc-100 rounded-tl-none border border-white/10'
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
        <div className="px-3.5 py-2 border-t border-white/[0.06] bg-black/30 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSendReaction(emoji)}
                className="w-7 h-7 flex items-center justify-center text-sm rounded-lg hover:bg-white/[0.08] active:scale-125 transition-transform cursor-pointer"
                title={`Send ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSend} className="p-3 border-t border-white/[0.08] bg-black/40 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t('chat.placeholder')}
          maxLength={500}
          className="flex-1 px-3.5 py-2 rounded-xl bg-[#141220] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 font-medium"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="cinema-btn-primary p-2.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed shadow-md flex items-center justify-center cursor-pointer"
          aria-label={t('chat.send')}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
