import React from "react";

const Output = ({
  output,
  loading,
  error,
  stdinLine,
  onStdinLineChange,
  onSendStdin,
}) => {
  return (
    <div className="outputContainer">
      <div className="outputHeader">
        <span className="outputTitle">Output</span>
        {loading && <span className="loadingIndicator">● Running...</span>}
      </div>
      <div className="outputBody">
        {output ? (
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {output}
          </pre>
        ) : null}
        {!loading && error ? (
          <pre style={{ color: "#ef4444", margin: 0, whiteSpace: "pre-wrap" }}>
            {error}
          </pre>
        ) : null}
        {loading && !output && !error ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>Starting program…</p>
        ) : null}
      </div>
      {loading ? (
        <div
          style={{
            padding: "10px 12px",
            borderTop: "1px solid #1e293b",
            background: "#0b1220",
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: "12px",
              color: "#94a3b8",
              marginBottom: "6px",
            }}
          >
            When you see a prompt (e.g. &quot;Enter a number:&quot;), type below and
            press Send or Enter
          </label>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              value={stdinLine}
              onChange={(e) => onStdinLineChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSendStdin();
                }
              }}
              placeholder="Your input..."
              autoComplete="off"
              style={{
                flex: 1,
                borderRadius: "6px",
                border: "1px solid #334155",
                background: "#020617",
                color: "#e2e8f0",
                padding: "8px 10px",
                fontSize: "13px",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={onSendStdin}
              style={{
                background: "#3b82f6",
                border: "none",
                color: "white",
                padding: "8px 14px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Send
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Output;
