import React, { useEffect, useMemo, useRef, useState } from "react";
import ACTIONS from "../actions/Actions";

function formatTime(ts) {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function renderMentions(text, me) {
  const s = String(text || "");
  const parts = s.split(/(@[A-Za-z0-9_]{2,32})/g);
  return parts.map((p, idx) => {
    if (p.startsWith("@")) {
      const who = p.slice(1);
      const isMe = me && who.toLowerCase() === String(me).toLowerCase();
      return (
        <span key={idx} className={isMe ? "chatMention chatMention--me" : "chatMention"}>
          {p}
        </span>
      );
    }
    return <React.Fragment key={idx}>{p}</React.Fragment>;
  });
}

const DEFAULT_REACTIONS = ["👍", "❤️", "😂", "🎉", "😮"];

const ChatPanel = ({ socket, roomId, username, getSnippet, snippetMeta }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const scrollRef = useRef(null);
  const typingTimerRef = useRef(null);

  const me = useMemo(() => (username ? String(username) : "Guest"), [username]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleHistory = ({ roomId: rid, messages: history }) => {
      if (rid !== roomId) return;
      if (!Array.isArray(history)) return;
      setMessages(history);
    };

    const handleMessage = ({ roomId: rid, message }) => {
      if (rid !== roomId) return;
      if (!message || typeof message !== "object") return;
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id);
        if (exists) {
          return prev.map((m) => (m.id === message.id ? message : m));
        }
        return prev.concat(message).slice(-200);
      });
    };

    const handleReaction = ({ roomId: rid, messageId, emoji, reactions }) => {
      if (rid !== roomId) return;
      if (!messageId || !emoji) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (!m || m.id !== messageId) return m;
          return { ...m, reactions: reactions || m.reactions };
        })
      );
    };

    const handlePin = ({ roomId: rid, messageId, pinned }) => {
      if (rid !== roomId) return;
      setMessages((prev) =>
        prev.map((m) => (m && m.id === messageId ? { ...m, pinned: !!pinned } : m))
      );
    };

    const handleTyping = ({ roomId: rid, username: u }) => {
      if (rid !== roomId) return;
      if (!u) return;
      setTypingUsers((prev) => Array.from(new Set(prev.concat(String(u)))));
    };

    const handleStopTyping = ({ roomId: rid, username: u }) => {
      if (rid !== roomId) return;
      if (!u) return;
      setTypingUsers((prev) => prev.filter((x) => x !== String(u)));
    };

    socket.on(ACTIONS.CHAT_HISTORY, handleHistory);
    socket.on(ACTIONS.CHAT_MESSAGE, handleMessage);
    socket.on(ACTIONS.CHAT_REACTION, handleReaction);
    socket.on(ACTIONS.CHAT_PIN, handlePin);
    socket.on(ACTIONS.CHAT_TYPING, handleTyping);
    socket.on(ACTIONS.CHAT_STOP_TYPING, handleStopTyping);

    return () => {
      socket.off(ACTIONS.CHAT_HISTORY, handleHistory);
      socket.off(ACTIONS.CHAT_MESSAGE, handleMessage);
      socket.off(ACTIONS.CHAT_REACTION, handleReaction);
      socket.off(ACTIONS.CHAT_PIN, handlePin);
      socket.off(ACTIONS.CHAT_TYPING, handleTyping);
      socket.off(ACTIONS.CHAT_STOP_TYPING, handleStopTyping);
    };
  }, [roomId, socket]);

  useEffect(() => {
    return () => clearTimeout(typingTimerRef.current);
  }, []);

  const send = () => {
    const s = (text || "").trim();
    if (!s) return;
    if (!socket) return;

    const tempId = `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const localMsg = {
      id: tempId,
      username: me,
      text: s,
      ts: Date.now(),
      kind: "text",
      pinned: false,
      reactions: {},
      meta: {},
    };
    setMessages((prev) => prev.concat(localMsg).slice(-200));
    socket.emit(ACTIONS.CHAT_MESSAGE, { roomId, text: s, tempId, kind: "text", meta: {} });
    setText("");
  };

  const sendSnippet = () => {
    const snippet = typeof getSnippet === "function" ? getSnippet() : "";
    const snip = (snippet || "").trimEnd();
    if (!snip) return;
    if (!socket) return;
    const meta = typeof snippetMeta === "function" ? snippetMeta() : {};
    const label = meta?.filePath ? `${meta.filePath}` : "selection";
    const lang = meta?.lang ? String(meta.lang) : "";
    const body = `\`\`\`${lang}\n${snip}\n\`\`\``;
    const tempId = `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const localMsg = {
      id: tempId,
      username: me,
      text: body,
      ts: Date.now(),
      kind: "snippet",
      pinned: false,
      reactions: {},
      meta: { ...meta, label },
    };
    setMessages((prev) => prev.concat(localMsg).slice(-200));
    socket.emit(ACTIONS.CHAT_MESSAGE, {
      roomId,
      text: body,
      tempId,
      kind: "snippet",
      meta: { ...meta, label },
    });
  };

  const togglePin = (m) => {
    if (!socket || !m?.id) return;
    socket.emit(ACTIONS.CHAT_PIN, { roomId, messageId: m.id, pinned: !m.pinned });
    setMessages((prev) => prev.map((x) => (x?.id === m.id ? { ...x, pinned: !m.pinned } : x)));
  };

  const react = (m, emoji) => {
    if (!socket || !m?.id) return;
    socket.emit(ACTIONS.CHAT_REACTION, { roomId, messageId: m.id, emoji });
    // Optimistic UI update
    setMessages((prev) =>
      prev.map((x) => {
        if (x?.id !== m.id) return x;
        const currentReactions = x.reactions || {};
        const arr = currentReactions[emoji] || [];
        const has = arr.includes(me);
        const newReactions = { ...currentReactions };
        newReactions[emoji] = has ? arr.filter((u) => u !== me) : arr.concat(me);
        return { ...x, reactions: newReactions };
      })
    );
  };

  return (
    <div className="chatPanelCompact">
      <div className="chatPanelCompact-head">
        <span className="chatTitle">Room Chat</span>
        {typingUsers.length ? (
          <span className="chatTypingCompact">
            {typingUsers.slice(0, 2).join(", ")}
            {typingUsers.length > 2 ? ` +${typingUsers.length - 2}` : ""} typing...
          </span>
        ) : null}
      </div>

      <div className="chatPanelCompact-body" ref={scrollRef}>
        {messages.length ? (
          messages.map((m) => {
            const isMe = (m.username || "Guest") === me;
            const pins = m.pinned;
            const reactionKeys = Object.keys(m.reactions || {}).filter(k => (m.reactions[k] || []).length > 0);

            return (
              <div key={m.id || `${m.ts}_${m.username}`} className={`chatInlineRow ${pins ? "pinned" : ""}`}>
                <div className="chatInlineHeader">
                  <span className="chatTime">[{formatTime(m.ts)}]</span>
                  <span className={`chatAuthor ${isMe ? "chatAuthorMe" : ""}`}>
                    {m.username || "Guest"}:
                  </span>
                </div>
                <div className="chatInlineContent">
                  {renderMentions(m.text, me)}
                </div>

                {/* Badges for Existing Reactions */}
                {reactionKeys.length > 0 && (
                  <div className="chatInlineBadges">
                    {reactionKeys.map((em) => {
                      const count = m.reactions[em].length;
                      const hasMe = m.reactions[em].includes(me);
                      return (
                        <div key={em} className={`reactionBadge ${hasMe ? "active" : ""}`} onClick={() => react(m, em)}>
                          {em} <span className="reactionCount">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Floating Hover Menu */}
                <div className="chatHoverMenu">
                  {DEFAULT_REACTIONS.map((em) => (
                    <button key={em} onClick={() => react(m, em)} className="chatHoverEmoji">{em}</button>
                  ))}
                  <button onClick={() => togglePin(m)} className="chatHoverAction">
                    {pins ? "Unpin" : "Pin"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="chatEmptyCompact">It's quiet here. Send a message!</div>
        )}
      </div>

      <div className="chatPanelCompact-input">
        {/* Send Code Snippet Button */}
        <button className="chatIconBtn" onClick={sendSnippet} title="Send Editor Selection">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </button>

        <input
          className="chatCompactInput"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (socket) {
              socket.emit(ACTIONS.CHAT_TYPING, { roomId });
              clearTimeout(typingTimerRef.current);
              typingTimerRef.current = setTimeout(() => {
                socket.emit(ACTIONS.CHAT_STOP_TYPING, { roomId });
              }, 900);
            }
          }}
          placeholder="Message..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />

        {/* Send Button */}
        <button className="chatIconBtn sendBtn" onClick={send} title="Send Message">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;

