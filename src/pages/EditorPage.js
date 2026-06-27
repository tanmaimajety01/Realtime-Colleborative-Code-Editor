import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import Client from "../components/Client";
import Editor from "../components/Editor";
import WorkspaceExplorer from "../components/WorkspaceExplorer";
import Output from "../components/Output";
import TerminalPanel from "../components/TerminalPanel";
import ChatPanel from "../components/ChatPanel";
import AiAssistant from "../components/AiAssistant";
import { language, cmtheme } from "../atoms";
import { useRecoilState } from "recoil";
import ACTIONS from "../actions/Actions";
import { initSocket } from "../socket";
import { useLocation, useNavigate, useParams } from "react-router-dom";

function langFromPath(filePath) {
  const base = filePath.split(/[/\\]/).pop() || "";
  const ext = base.includes(".") ? base.split(".").pop()?.toLowerCase() : "";
  const map = {
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    ts: "javascript",
    tsx: "javascript",
    json: "javascript",
    py: "python",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    html: "htmlmixed",
    htm: "htmlmixed",
    xml: "htmlmixed",
    css: "css",
    scss: "css",
    sass: "css",
    less: "css",
    md: "javascript",
    yml: "javascript",
    yaml: "javascript",
    txt: "javascript",
    sh: "javascript",
    bat: "javascript",
  };
  return map[ext] || "javascript";
}

const EditorPage = () => {
  const [lang, setLang] = useRecoilState(language);
  const [them, setThem] = useRecoilState(cmtheme);
  const [clients, setClients] = useState([]);
  const [socket, setSocket] = useState(null);

  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const activeFilePathRef = useRef(null);
  const workspaceFilesRef = useRef({});

  const location = useLocation();
  const { roomId } = useParams();
  const navigate = useNavigate();

  const username = location.state?.username || "Guest";

  const [workspaceFiles, setWorkspaceFiles] = useState({});
  const [activeFilePath, setActiveFilePath] = useState(null);
  const [workspaceLabel, setWorkspaceLabel] = useState("Workspace");
  const [expandedFolders, setExpandedFolders] = useState({});

  const fileInputRef = useRef(null);
  const editorInstanceRef = useRef(null);

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stdinLine, setStdinLine] = useState("");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    activeFilePathRef.current = activeFilePath;
  }, [activeFilePath]);

  useEffect(() => {
    workspaceFilesRef.current = workspaceFiles;
  }, [workspaceFiles]);

  const getDisplayFileName = (selectedLang) => {
    const byLang = {
      javascript: "main.js",
      python: "main.py",
      c: "main.c",
      cpp: "main.cpp",
      java: "Main.java",
      htmlmixed: "index.html",
      css: "style.css",
    };
    return byLang[selectedLang] || "main.txt";
  };

  const detectLanguageFromCode = (code) => {
    const trimmed = (code || "").trim();
    if (!trimmed) return null;
    if (/public\s+class\s+[A-Za-z_]\w*/.test(trimmed)) return "java";
    if (/^\s*#include\s*[<"].+[>"]/.test(trimmed)) {
      return /\b(std::|cout|cin|string)\b/.test(trimmed) ? "cpp" : "c";
    }
    if (/^\s*(def\s+\w+\s*\(|print\s*\(|import\s+\w+)/m.test(trimmed))
      return "python";
    if (/<html|<!doctype html>/i.test(trimmed)) return "htmlmixed";
    if (
      /^\s*[.#]?[A-Za-z_-][\w-]*\s*\{[^}]*\}/m.test(trimmed) &&
      !/[;=]\s*[^;]+/m.test(trimmed)
    )
      return "css";
    return null;
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const socket = await initSocket();
      if (cancelled) {
        socket.disconnect();
        return;
      }

      socketRef.current = socket;
      setSocket(socket);

      const handleErrors = (e) => {
        console.log(e);
        toast.error("Socket failed");
      };

      socket.on("connect_error", handleErrors);
      socket.on("connect_failed", handleErrors);

      const joinRoom = () => {
        socket.emit(ACTIONS.JOIN, { roomId, username });
      };
      socket.on("connect", joinRoom);
      if (socket.connected) {
        joinRoom();
      }

      socket.on(ACTIONS.RUN_STDOUT, ({ text }) => {
        setOutput((prev) => prev + (text || ""));
      });
      socket.on(ACTIONS.RUN_STDERR, ({ text }) => {
        setOutput((prev) => prev + (text || ""));
      });
      socket.on(ACTIONS.RUN_DONE, ({ timedOut }) => {
        setLoading(false);
        if (timedOut) {
          setError(
            "Program stopped: time limit reached while waiting (try again or send input sooner)."
          );
        }
      });
      socket.on(ACTIONS.RUN_FAILED, ({ message }) => {
        setError(message || "Run failed");
        setLoading(false);
      });

      socket.on(ACTIONS.JOINED, ({ clients: joinedClients, username: joinedUser, socketId }) => {
        if (joinedUser !== username) {
          toast.success(`${joinedUser} joined`);
        }

        setClients(joinedClients);

        socketRef.current?.emit(ACTIONS.SYNC_CODE, {
          code: codeRef.current,
          socketId,
        });
      });

      socket.on(ACTIONS.DISCONNECTED, ({ socketId, username: leftUser }) => {
        toast.success(`${leftUser} left`);

        setClients((prev) =>
          prev.filter((client) => client.socketId !== socketId)
        );
      });
    };

    init();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [roomId, username]);

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Copied");
    } catch {
      toast.error("Failed");
    }
  }

  function leaveRoom() {
    navigate("/");
  }

  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

  const shouldSkipFolderPath = (relPath) => {
    const normalized = relPath.replace(/\\/g, "/").toLowerCase();
    return (
      normalized.includes("/node_modules/") ||
      normalized.startsWith("node_modules/") ||
      normalized.includes("/.git/") ||
      normalized.startsWith(".git/")
    );
  };

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const commitActiveBufferToWorkspace = () => {
    const p = activeFilePathRef.current;
    if (!p || !editorInstanceRef.current) return;
    const code = editorInstanceRef.current.getCode();
    setWorkspaceFiles((prev) => ({ ...prev, [p]: code }));
    workspaceFilesRef.current = { ...workspaceFilesRef.current, [p]: code };
    codeRef.current = code;
  };

  const handleOpenWorkspaceFile = (path) => {
    if (path === activeFilePathRef.current) return;
    commitActiveBufferToWorkspace();
    const files = workspaceFilesRef.current;
    const next = files[path] ?? "";
    setActiveFilePath(path);
    activeFilePathRef.current = path;
    setLang(langFromPath(path));
    editorInstanceRef.current?.setCode(next);
    codeRef.current = next;
    socketRef.current?.emit(ACTIONS.CODE_CHANGE, {
      roomId,
      code: next,
    });
  };

  const toggleExplorerFolder = (folderPath) => {
    setExpandedFolders((prev) => {
      const wasOpen = prev[folderPath] !== false;
      return { ...prev, [folderPath]: !wasOpen };
    });
  };

  const handleCloseWorkspace = () => {
    commitActiveBufferToWorkspace();
    setWorkspaceFiles({});
    workspaceFilesRef.current = {};
    setActiveFilePath(null);
    activeFilePathRef.current = null;
    setWorkspaceLabel("Workspace");
    setExpandedFolders({});
    editorInstanceRef.current?.setCode("");
    codeRef.current = "";
    resetFileInput();
    socketRef.current?.emit(ACTIONS.CODE_CHANGE, { roomId, code: "" });
    toast.success("Workspace closed");
  };

  const handleFolderUpload = async (e) => {
    const filesList = Array.from(e.target.files || []);
    if (!filesList.length) {
      toast.error("No files selected.");
      return;
    }

    const textExt =
      /\.(js|mjs|cjs|ts|tsx|jsx|py|java|cpp|cc|cxx|c|h|hpp|cs|go|rs|rb|php|swift|kt|sql|html|htm|css|scss|sass|less|json|xml|yaml|yml|md|txt|sh|bat|env|gitignore|csv|properties|gradle|toml)$/i;

    const MAX_FILES = 200;
    const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
    const entries = [];
    let totalBytes = 0;
    let skipped = 0;

    for (const file of filesList) {
      const rel = file.webkitRelativePath || file.name;
      if (shouldSkipFolderPath(rel)) {
        skipped += 1;
        continue;
      }
      if (!textExt.test(file.name)) {
        skipped += 1;
        continue;
      }
      if (entries.length >= MAX_FILES) {
        toast.error(`Loaded the first ${MAX_FILES} text files only.`);
        break;
      }
      if (totalBytes + file.size > MAX_TOTAL_BYTES) {
        toast.error("Folder too large; stopped at ~4 MB of text.");
        break;
      }
      try {
        const text = await readFileAsText(file);
        totalBytes += file.size;
        entries.push({ path: rel.replace(/\\/g, "/"), content: text });
      } catch {
        skipped += 1;
      }
    }

    if (!entries.length) {
      toast.error("No readable text files found in that folder.");
      resetFileInput();
      return;
    }

    const files = {};
    entries.forEach((e) => {
      files[e.path] = typeof e.content === "string" ? e.content : "";
    });
    workspaceFilesRef.current = files;
    setWorkspaceFiles(files);
    
    // Broadcast tree to physical backend sandbox
    socketRef.current?.emit("SYNC_FULL_WORKSPACE", { roomId, files });

    const sortedPaths = Object.keys(files).sort((a, b) => a.localeCompare(b));
    const first = sortedPaths[0];
    const rootSeg = first.includes("/") ? first.split("/")[0] : "Workspace";
    setWorkspaceLabel(rootSeg);
    setActiveFilePath(first);
    activeFilePathRef.current = first;
    setExpandedFolders({});

    const nextLang = langFromPath(first);
    setLang(nextLang);

    queueMicrotask(() => {
      editorInstanceRef.current?.setCode(files[first] || "");
      codeRef.current = files[first] || "";
      socketRef.current?.emit(ACTIONS.CODE_CHANGE, {
        roomId,
        code: files[first] || "",
      });
    });

    if (skipped > 0) {
      toast.success(
        `Opened ${entries.length} file(s) in Explorer. Skipped ${skipped} (non-text or ignored paths).`
      );
    } else {
      toast.success(`Opened ${entries.length} file(s) in Explorer.`);
    }
    resetFileInput();
  };

  const handleRun = () => {
    const liveCode =
      typeof editorInstanceRef.current?.getCode === "function"
        ? editorInstanceRef.current.getCode()
        : "";
    const code = (liveCode && liveCode.length > 0 ? liveCode : codeRef.current) || "";

    if (!code.trim()) {
      toast.error("Code editor is empty!");
      return;
    }

    codeRef.current = code;
    commitActiveBufferToWorkspace();

    if (!socketRef.current?.connected) {
      toast.error("Not connected to server. Is the backend running on port 5001?");
      socketRef.current?.connect?.();
      return;
    }

    const inferred = detectLanguageFromCode(code);
    let languageToRun = inferred || lang;
    if (inferred && inferred !== lang) {
      setLang(inferred);
      toast(`Running as ${inferred}.`, { icon: "ℹ️" });
    }
    if (languageToRun === "htmlmixed" || languageToRun === "css") {
      toast.error("Run is not supported for HTML/CSS.");
      return;
    }

    setLoading(true);
    setError("");
    setOutput("");
    setStdinLine("");

    socketRef.current.emit(ACTIONS.RUN_START, {
      code,
      language: languageToRun,
    });
  };

  const handleSendStdin = () => {
    if (!socketRef.current?.connected || !loading) return;
    socketRef.current.emit(ACTIONS.RUN_STDIN, { line: stdinLine });
    setStdinLine("");
  };

  const workspacePaths = Object.keys(workspaceFiles);
  const hasWorkspace = workspacePaths.length > 0;

  return (
    <div className="mainWrap">
      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <img className="logoImage" src="/logo.png" alt="logo" />
          </div>

          <h2 style={{ marginBottom: "5px" }}>Sync Code</h2>

          <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "15px" }}>
            Connected
          </p>

          <div className="clientsList">
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>

          <ChatPanel
            socket={socket}
            roomId={roomId}
            username={username}
            getSnippet={() => editorInstanceRef.current?.getSelection?.() || ""}
            snippetMeta={() => ({
              lang,
              filePath: activeFilePathRef.current,
            })}
          />
        </div>

        <input
          type="file"
          style={{ display: "none" }}
          id="folderUpload"
          ref={fileInputRef}
          multiple
          webkitdirectory=""
          onChange={handleFolderUpload}
        />

        <div className="bottomControls">
          <button
            className="uploadFileBtn"
            onClick={() => document.getElementById("folderUpload").click()}
            title="Load a folder into the Explorer (VS Code style)"
          >
            Upload folder
          </button>

          <label>
            Select Language:
            <select
              className="seLang"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="c">C</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
              <option value="htmlmixed">HTML</option>
              <option value="css">CSS</option>
            </select>
          </label>

          <label>
            Select Theme:
            <select
              className="seLang"
              value={them}
              onChange={(e) => setThem(e.target.value)}
            >
              <option value="material">Material</option>
              <option value="dracula">Dracula</option>
              <option value="monokai">Monokai</option>
              <option value="nord">Nord</option>
            </select>
          </label>

          <button className="copyBtn" onClick={copyRoomId}>
            Copy ROOM ID
          </button>

          <button className="leaveBtn" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      </div>

      {hasWorkspace ? (
        <WorkspaceExplorer
          paths={workspacePaths}
          rootLabel={workspaceLabel}
          expanded={expandedFolders}
          toggleFolder={toggleExplorerFolder}
          activeFilePath={activeFilePath}
          onSelectFile={handleOpenWorkspaceFile}
          onClose={handleCloseWorkspace}
        />
      ) : null}

      <div className="editorWrap">
        <div
          style={{
            height: "42px",
            background: "#020617",
            borderBottom: "1px solid #1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 15px",
            gap: "10px",
          }}
        >
          <span
            style={{
              color: "#94a3b8",
              fontSize: "13px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "55%",
              flex: 1,
              minWidth: 0,
            }}
            title={activeFilePath || undefined}
          >
            {activeFilePath ? (
              <>
                <span style={{ opacity: 0.75 }}>{workspaceLabel}</span>
                <span style={{ opacity: 0.45 }}> › </span>
                <span style={{ color: "#e2e8f0" }}>{activeFilePath}</span>
              </>
            ) : (
              getDisplayFileName(lang)
            )}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <button
              type="button"
              className={`aiToggleBtn ${aiOpen ? "active" : ""}`}
              onClick={() => setAiOpen((o) => !o)}
              title="Toggle AI coding assistant"
            >
              {aiOpen ? "Hide AI" : "✨ AI"}
            </button>
            <button
              type="button"
              onClick={() => setTerminalOpen((o) => !o)}
              style={{
                background: terminalOpen ? "#334155" : "#1e293b",
                border: "1px solid #334155",
                padding: "5px 12px",
                borderRadius: "6px",
                color: "#e2e8f0",
                cursor: "pointer",
                fontSize: "12px",
              }}
              title="Toggle integrated terminal (shell on the server)"
            >
              {terminalOpen ? "Hide terminal" : "Terminal"}
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={loading}
              style={{
                background: loading ? "#888" : "#22c55e",
                border: "none",
                padding: "5px 12px",
                borderRadius: "6px",
                color: "white",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "13px",
              }}
            >
              {loading ? "Running..." : "Run ▶"}
            </button>
          </div>
        </div>

        <div className="editorBodyColumn">
          <div
            className={
              hasWorkspace ? "editorAndOutput editorAndOutput--workspace" : "editorAndOutput"
            }
          >
            <Editor
              ref={editorInstanceRef}
              socketRef={socketRef}
              roomId={roomId}
              username={username}
              onCodeChange={(code) => {
                codeRef.current = code;
                const p = activeFilePathRef.current;
                if (p) {
                  setWorkspaceFiles((prev) => ({ ...prev, [p]: code }));
                  workspaceFilesRef.current = {
                    ...workspaceFilesRef.current,
                    [p]: code,
                  };
                  socketRef.current?.emit("SYNC_SINGLE_FILE", { roomId, filePath: p, code });
                }
              }}
            />
            {!hasWorkspace ? (
              <Output
                output={output}
                loading={loading}
                error={error}
                stdinLine={stdinLine}
                onStdinLineChange={setStdinLine}
                onSendStdin={handleSendStdin}
              />
            ) : null}
          </div>

          {terminalOpen ? (
            <div className="terminalDock">
              <div className="terminalDock-head">
                <span className="terminalDock-title">TERMINAL</span>
                <span className="terminalDock-hint">
                  Shell runs in your project folder on this PC. Use npm run client if 3000 is busy.
                </span>
              </div>
              <div className="terminalDock-body">
                <TerminalPanel socketRef={socketRef} isOpen={terminalOpen} roomId={roomId} workspaceLabel={workspaceLabel} hasWorkspace={hasWorkspace} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {aiOpen ? (
        <AiAssistant
          getCode={() => editorInstanceRef.current?.getCode?.() || codeRef.current || ""}
          language={lang}
        />
      ) : null}
    </div>
  );
};

export default EditorPage;
