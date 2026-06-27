import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

/**
 * Generate a unique session ID for conversation history tracking.
 */
function generateSessionId() {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Simple markdown-like rendering for AI responses.
 * Handles code blocks, inline code, bold, italic, bullet lists, and line breaks.
 */
function renderAiText(text) {
  if (!text) return null;

  const parts = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      parts.push(
        <span key={`t-${lastIndex}`}>
          {renderInlineMarkdown(text.slice(lastIndex, match.index))}
        </span>
      );
    }
    // Code block
    const lang = match[1] || "";
    const code = match[2].replace(/\n$/, "");
    parts.push(
      <div key={`c-${match.index}`} className="aiCodeBlock">
        {lang && <span className="aiCodeLang">{lang}</span>}
        <pre><code>{code}</code></pre>
        <CopyButton text={code} />
      </div>
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    parts.push(
      <span key={`t-${lastIndex}`}>
        {renderInlineMarkdown(text.slice(lastIndex))}
      </span>
    );
  }

  return parts;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <button
      className={`aiCopyCodeBtn ${copied ? "copied" : ""}`}
      onClick={handleCopy}
      title="Copy code"
    >
      {copied ? "✓ Copied!" : "Copy"}
    </button>
  );
}

function renderInlineMarkdown(text) {
  // Split by inline code first
  const segments = text.split(/(`[^`]+`)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("`") && seg.endsWith("`")) {
      return (
        <code key={i} className="aiInlineCode">
          {seg.slice(1, -1)}
        </code>
      );
    }
    // Handle bold
    const boldParts = seg.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp, j) => {
      if (bp.startsWith("**") && bp.endsWith("**")) {
        return <strong key={`${i}-${j}`}>{bp.slice(2, -2)}</strong>;
      }
      // Handle italic
      const italicParts = bp.split(/(\*[^*]+\*)/g);
      return italicParts.map((ip, k) => {
        if (ip.startsWith("*") && ip.endsWith("*") && !ip.startsWith("**")) {
          return <em key={`${i}-${j}-${k}`}>{ip.slice(1, -1)}</em>;
        }
        return <React.Fragment key={`${i}-${j}-${k}`}>{ip}</React.Fragment>;
      });
    });
  });
}

const QUICK_ACTIONS = [
  { label: "💡 Explain", prompt: "Explain this code step by step in simple terms.", icon: "💡" },
  { label: "🐛 Find Bugs", prompt: "Find potential bugs, edge cases, security issues, and problems in this code. Rank by severity.", icon: "🐛" },
  { label: "✨ Refactor", prompt: "Refactor this code to be cleaner and more efficient. Show the improved version with rationale.", icon: "✨" },
  { label: "💬 Comments", prompt: "Add clear, helpful inline comments to this code. Return the full code with comments.", icon: "💬" },
  { label: "⚡ Optimize", prompt: "Optimize this code for better performance. Include big-O analysis where relevant.", icon: "⚡" },
];

const AiAssistant = ({ getCode, language }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [retryData, setRetryData] = useState(null);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const textareaRef = useRef(null);
  const sessionIdRef = useRef(generateSessionId());

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }, [input]);

  const sendMessage = useCallback(
    async (userPrompt) => {
      if (!userPrompt?.trim() || isLoading) return;

      const code = typeof getCode === "function" ? getCode() : "";
      setRetryData(null);

      // Add user message
      setMessages((prev) => [
        ...prev,
        { role: "user", text: userPrompt.trim(), ts: Date.now() },
      ]);
      setInput("");

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      setIsLoading(true);

      // Add empty AI message that will be streamed into
      const aiMsgIndex = { current: -1 };
      setMessages((prev) => {
        aiMsgIndex.current = prev.length;
        return [...prev, { role: "ai", text: "", ts: Date.now() }];
      });

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const resp = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: userPrompt.trim(),
            code: code || "",
            language: language || "javascript",
            sessionId: sessionIdRef.current,
          }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || `Server error ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              if (parsed.error) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const idx = aiMsgIndex.current;
                  if (idx >= 0 && idx < updated.length) {
                    updated[idx] = {
                      ...updated[idx],
                      text: updated[idx].text + `\n\n⚠️ ${parsed.error}`,
                      hasError: true,
                    };
                  }
                  return updated;
                });
                // Store retry data
                setRetryData({ prompt: userPrompt, code, language });
              } else if (parsed.text) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const idx = aiMsgIndex.current;
                  if (idx >= 0 && idx < updated.length) {
                    updated[idx] = {
                      ...updated[idx],
                      text: updated[idx].text + parsed.text,
                    };
                  }
                  return updated;
                });
              }
            } catch (e) {
              // skip malformed JSON
            }
          }
        }
      } catch (err) {
        if (err.name === "AbortError") {
          setMessages((prev) => {
            const updated = [...prev];
            const idx = aiMsgIndex.current;
            if (idx >= 0 && idx < updated.length) {
              updated[idx] = {
                ...updated[idx],
                text: updated[idx].text + "\n\n_(stopped by user)_",
              };
            }
            return updated;
          });
        } else {
          setMessages((prev) => {
            const updated = [...prev];
            const idx = aiMsgIndex.current;
            if (idx >= 0 && idx < updated.length) {
              updated[idx] = {
                ...updated[idx],
                text: `⚠️ ${err.message}`,
                hasError: true,
              };
            }
            return updated;
          });
          setRetryData({ prompt: userPrompt, code, language });
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [getCode, language, isLoading]
  );

  const handleRetry = useCallback(() => {
    if (retryData) {
      // Remove the last failed AI message
      setMessages((prev) => {
        const copy = [...prev];
        if (copy.length > 0 && copy[copy.length - 1].role === "ai") {
          copy.pop();
        }
        if (copy.length > 0 && copy[copy.length - 1].role === "user") {
          copy.pop();
        }
        return copy;
      });
      sendMessage(retryData.prompt);
    }
  }, [retryData, sendMessage]);

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  };

  const handleClear = useCallback(() => {
    if (isLoading) handleStop();
    setMessages([]);
    setRetryData(null);
    // Reset server-side session too
    sessionIdRef.current = generateSessionId();
    fetch("/api/ai/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionIdRef.current }),
    }).catch(() => {});
  }, [isLoading]);

  const messageCount = useMemo(() => messages.filter(m => m.role === "user").length, [messages]);

  return (
    <div className="aiPanel">
      <div className="aiPanel-head">
        <div className="aiPanel-headLeft">
          <span className="aiPanel-title">✨ AI Assistant</span>
          {messageCount > 0 && (
            <span className="aiPanel-count">{messageCount} message{messageCount !== 1 ? "s" : ""}</span>
          )}
        </div>
        <button
          className="aiPanel-clearBtn"
          onClick={handleClear}
          title="Clear conversation and start fresh"
        >
          🗑️ Clear
        </button>
      </div>

      {/* Quick Actions */}
      <div className="aiQuickActions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            className="aiQuickBtn"
            onClick={() => sendMessage(action.prompt)}
            disabled={isLoading}
            title={action.prompt}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="aiPanel-body" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="aiEmptyState">
            <div className="aiEmptyIcon">🤖</div>
            <p className="aiEmptyTitle">Hi! I'm your AI coding assistant.</p>
            <p className="aiEmptySubtitle">
              Ask me anything about your code, or use the quick actions above.
              I remember our conversation context!
            </p>
            <div className="aiEmptyTips">
              <div className="aiTip">💡 "What does this function do?"</div>
              <div className="aiTip">🐛 "Why is this throwing an error?"</div>
              <div className="aiTip">✨ "How can I make this faster?"</div>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`aiMessage ${msg.role === "user" ? "aiMessage--user" : "aiMessage--ai"} ${msg.hasError ? "aiMessage--error" : ""}`}
            >
              <div className="aiMessage-label">
                <span className="aiMessage-avatar">
                  {msg.role === "user" ? "👤" : "🤖"}
                </span>
                <span>{msg.role === "user" ? "You" : "AI"}</span>
              </div>
              <div className="aiMessage-content">
                {msg.role === "ai" ? renderAiText(msg.text) : msg.text}
                {msg.role === "ai" && isLoading && i === messages.length - 1 && (
                  <span className="aiCursor">▊</span>
                )}
              </div>
              {msg.hasError && !isLoading && i === messages.length - 1 && retryData && (
                <button className="aiRetryBtn" onClick={handleRetry}>
                  🔄 Retry
                </button>
              )}
            </div>
          ))
        )}
        {isLoading && messages.length > 0 && (
          <div className="aiThinking">
            <span className="aiThinkingDot"></span>
            <span className="aiThinkingDot"></span>
            <span className="aiThinkingDot"></span>
            <span className="aiThinkingLabel">Thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="aiPanel-input">
        <textarea
          ref={textareaRef}
          className="aiInputBox"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder="Ask about your code... (Shift+Enter for new line)"
          disabled={isLoading}
          rows={1}
        />
        {isLoading ? (
          <button className="aiSendBtn aiStopBtn" onClick={handleStop} title="Stop generation">
            ■
          </button>
        ) : (
          <button
            className="aiSendBtn"
            onClick={() => sendMessage(input)}
            disabled={!input.trim()}
            title="Send (Enter)"
          >
            ➤
          </button>
        )}
      </div>
    </div>
  );
};

export default AiAssistant;
