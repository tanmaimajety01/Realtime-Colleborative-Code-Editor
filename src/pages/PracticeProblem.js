import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import "./PracticeList.css";

// CodeMirror imports (reuse existing project dependency)
import "codemirror/lib/codemirror.css";
import "codemirror/theme/dracula.css";
import "codemirror/theme/material.css";
import "codemirror/theme/monokai.css";
import "codemirror/theme/nord.css";
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/python/python";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import CodeMirror from "codemirror";

/**
 * PracticeProblem — Split-pane problem detail page with editor.
 * Accessible at /practice/:id
 */
const PracticeProblem = () => {
  const { id } = useParams();
  const username = localStorage.getItem("username") || "";

  // ---- Problem data ----
  const [problem, setProblem] = useState(null);
  const [loadingProblem, setLoadingProblem] = useState(true);

  // ---- Editor state ----
  const [language, setLanguage] = useState("javascript");
  const editorRef = useRef(null);
  const cmInstanceRef = useRef(null);
  const textareaRef = useRef(null);

  // ---- Execution state ----
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null); // { testCases, allPassed, status, ... }
  const [resultType, setResultType] = useState(""); // "run" | "submit"

  // ---- Submission history ----
  const [submissions, setSubmissions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // ---- Fetch problem ----
  const fetchProblem = useCallback(async () => {
    setLoadingProblem(true);
    try {
      const params = new URLSearchParams();
      if (username) params.set("username", username);
      const res = await fetch(`/api/problems/${id}?${params}`);
      if (!res.ok) throw new Error("Problem not found");
      const data = await res.json();
      setProblem(data);

      // Set language from user progress or default
      if (data.userProgress?.lastLanguage) {
        setLanguage(data.userProgress.lastLanguage);
      }
    } catch (err) {
      console.error("Failed to fetch problem:", err);
    }
    setLoadingProblem(false);
  }, [id, username]);

  useEffect(() => {
    fetchProblem();
  }, [fetchProblem]);

  // ---- Fetch submission history ----
  const fetchSubmissions = useCallback(async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/submissions?username=${encodeURIComponent(username)}&problemId=${id}`);
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    }
  }, [username, id]);

  useEffect(() => {
    if (username) fetchSubmissions();
  }, [fetchSubmissions]);

  // ---- Initialize CodeMirror ----
  useEffect(() => {
    if (!textareaRef.current || cmInstanceRef.current) return;

    const cm = CodeMirror.fromTextArea(textareaRef.current, {
      mode: language === "python" || language === "python3" ? "python" : "javascript",
      theme: "dracula",
      lineNumbers: true,
      autoCloseBrackets: true,
      autoCloseTags: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      lineWrapping: false,
      matchBrackets: true,
      extraKeys: {
        Tab: (cm) => {
          if (cm.somethingSelected()) {
            cm.indentSelection("add");
          } else {
            cm.replaceSelection("  ", "end");
          }
        },
      },
    });

    cmInstanceRef.current = cm;

    // Cleanup
    return () => {
      if (cmInstanceRef.current) {
        cmInstanceRef.current.toTextArea();
        cmInstanceRef.current = null;
      }
    };
  }, [loadingProblem]);

  // ---- Set editor content when problem loads ----
  useEffect(() => {
    if (!problem || !cmInstanceRef.current) return;

    const cm = cmInstanceRef.current;

    // If user has previous code, use that; otherwise use template
    let code = "";
    if (problem.userProgress?.lastCode && problem.userProgress.lastLanguage === language) {
      code = problem.userProgress.lastCode;
    } else if (problem.codeTemplates?.[language]) {
      code = problem.codeTemplates[language];
    } else if (problem.codeTemplates?.javascript) {
      code = problem.codeTemplates.javascript;
    }

    cm.setValue(code);
    cm.setOption("mode", language === "python" || language === "python3" ? "python" : "javascript");
    cm.setSize("100%", "100%");
    
    // Give DOM a frame to update before refreshing layout
    setTimeout(() => {
      if (cmInstanceRef.current) {
        cmInstanceRef.current.refresh();
      }
    }, 100);
  }, [problem, language]);

  // ---- Handle language change ----
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    if (cmInstanceRef.current && problem) {
      const template = problem.codeTemplates?.[newLang] || "";
      cmInstanceRef.current.setValue(template);
      cmInstanceRef.current.setOption("mode", newLang === "python" || newLang === "python3" ? "python" : "javascript");
    }
  };

  // ---- Get current code ----
  const getCode = () => {
    return cmInstanceRef.current ? cmInstanceRef.current.getValue() : "";
  };

  // ---- Run code ----
  const handleRun = async () => {
    const code = getCode();
    if (!code.trim()) return;

    setRunning(true);
    setResults(null);
    setResultType("run");

    try {
      const res = await fetch(`/api/problems/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      setResults(data);
    } catch (err) {
      setResults({ error: err.message, testCases: [], allPassed: false });
    }
    setRunning(false);
  };

  // ---- Submit code ----
  const handleSubmit = async () => {
    const code = getCode();
    if (!code.trim()) return;
    if (!username) {
      alert("Please set a username first (go to /practice).");
      return;
    }

    setSubmitting(true);
    setResults(null);
    setResultType("submit");

    try {
      const res = await fetch(`/api/problems/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, username }),
      });
      const data = await res.json();
      setResults(data);
      // Refresh submissions
      fetchSubmissions();
    } catch (err) {
      setResults({ error: err.message, allPassed: false, status: "Error" });
    }
    setSubmitting(false);
  };

  // ---- Load code from a submission ----
  const loadSubmissionCode = (sub) => {
    if (cmInstanceRef.current && sub.code) {
      cmInstanceRef.current.setValue(sub.code);
      if (sub.language) setLanguage(sub.language);
    }
    setShowHistory(false);
  };

  // ---- Render helpers ----
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusClass = (status) => {
    if (!status) return "";
    const s = status.toLowerCase();
    if (s.includes("accepted")) return "accepted";
    if (s.includes("time")) return "tle";
    if (s.includes("runtime") || s.includes("error")) return "error";
    return "wrong";
  };

  // ---- Render description with basic code formatting ----
  const renderDescription = (desc) => {
    if (!desc) return null;
    // Split by backtick code blocks
    const parts = desc.split(/(`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={i} style={{
            background: "#1e293b",
            padding: "2px 6px",
            borderRadius: "4px",
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "13px",
            color: "#fbbf24",
          }}>
            {part.slice(1, -1)}
          </code>
        );
      }
      // Convert **bold** 
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bp, j) => {
        if (bp.startsWith("**") && bp.endsWith("**")) {
          return <strong key={`${i}-${j}`}>{bp.slice(2, -2)}</strong>;
        }
        return <span key={`${i}-${j}`}>{bp}</span>;
      });
    });
  };

  if (loadingProblem) {
    return (
      <div className="problemPage">
        <div className="resultsPanel-loading" style={{ height: "100vh" }}>
          <div className="spinner" />
          <span>Loading problem...</span>
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="problemPage">
        <div className="resultsPanel-empty" style={{ height: "100vh" }}>
          <span style={{ fontSize: "48px" }}>😕</span>
          <span>Problem not found</span>
          <Link to="/practice" className="problemPage-backBtn" style={{ marginTop: "16px" }}>
            ← Back to Problems
          </Link>
        </div>
      </div>
    );
  }

  // Build combined test results for display
  const displayResults = results
    ? resultType === "run"
      ? results.testCases || []
      : [...(results.visibleResults || []), ...(results.hiddenResults || [])]
    : [];

  const isProcessing = running || submitting;

  return (
    <div className="problemPage">
      {/* Top Bar */}
      <div className="problemPage-topbar">
        <div className="problemPage-topbarLeft">
          <Link to="/practice" className="problemPage-backBtn">
            ← Problems
          </Link>
          <span className="problemPage-problemTitle">
            {problem.title}
          </span>
          <span className={`diffBadge ${problem.difficulty.toLowerCase()}`}>
            {problem.difficulty}
          </span>
          {problem.userProgress?.solved && (
            <span className="problemDesc-solvedBadge">✅ Solved</span>
          )}
        </div>

        <div className="problemPage-topbarRight">
          <button
            className={`practiceViewBtn ${showHistory ? "active" : ""}`}
            onClick={() => setShowHistory(!showHistory)}
            style={{ fontSize: "12px" }}
          >
            📜 History ({submissions.length})
          </button>

          <select
            className="problemPage-langSelect"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
          </select>

          <button
            className="problemPage-runBtn"
            onClick={handleRun}
            disabled={isProcessing}
          >
            {running ? "Running..." : "▶ Run"}
          </button>

          <button
            className="problemPage-submitBtn"
            onClick={handleSubmit}
            disabled={isProcessing}
          >
            {submitting ? "Submitting..." : "Submit ✓"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="problemPage-body">
        {/* Left — Problem Description */}
        <div className="problemPage-descPanel">
          <div className="problemDesc-header">
            <h1>{problem.title}</h1>
            <span className={`diffBadge ${problem.difficulty.toLowerCase()}`}>
              {problem.difficulty}
            </span>
            <span className="categoryBadge">{problem.category}</span>
          </div>

          {/* Description */}
          <div className="problemDesc-body">
            {problem.description.split("\n\n").map((para, i) => (
              <p key={i}>{renderDescription(para)}</p>
            ))}
          </div>

          {/* Constraints */}
          <div className="problemDesc-section">
            <div className="problemDesc-sectionTitle">📋 Constraints</div>
            <ul className="problemDesc-constraints">
              {problem.constraints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          {/* Examples */}
          <div className="problemDesc-section">
            <div className="problemDesc-sectionTitle">💡 Examples</div>
            {problem.examples.map((ex, i) => (
              <div className="problemDesc-example" key={i}>
                <div className="problemDesc-exampleLabel">Example {i + 1}</div>
                <div className="problemDesc-exampleRow">
                  <span className="problemDesc-exampleKey">Input:</span>
                  <span className="problemDesc-exampleVal">{ex.input}</span>
                </div>
                <div className="problemDesc-exampleRow">
                  <span className="problemDesc-exampleKey">Output:</span>
                  <span className="problemDesc-exampleVal">{ex.output}</span>
                </div>
                {ex.explanation && (
                  <div className="problemDesc-exampleExpl">
                    {ex.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Submission History (collapsible) */}
          {showHistory && (
            <div className="submissionHistory">
              <div className="submissionHistory-title">📜 Submission History</div>
              {submissions.length === 0 ? (
                <div className="submissionHistory-empty">No submissions yet</div>
              ) : (
                submissions.map((sub, i) => (
                  <div
                    className="submissionHistory-item"
                    key={i}
                    onClick={() => loadSubmissionCode(sub)}
                    title="Click to load this code"
                  >
                    <div className="submissionHistory-itemTop">
                      <span className={`submissionHistory-result ${getStatusClass(sub.result)}`}>
                        {sub.result}
                      </span>
                      <span className="submissionHistory-lang">{sub.language}</span>
                    </div>
                    <div className="submissionHistory-meta">
                      <span>{sub.passedCount}/{sub.totalCount} passed</span>
                      <span>{formatDate(sub.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right — Editor + Results */}
        <div className="problemPage-editorPanel">
          {/* Editor */}
          <div className="problemPage-editorContainer" ref={editorRef}>
            <textarea ref={textareaRef} />
          </div>

          {/* Results */}
          <div className="problemPage-resultsPanel">
            {isProcessing ? (
              <div className="resultsPanel-loading">
                <div className="spinner" />
                <span>{running ? "Running test cases..." : "Submitting solution..."}</span>
              </div>
            ) : results ? (
              <>
                <div className="resultsPanel-header">
                  <span className="resultsPanel-title">
                    {resultType === "run" ? "🧪 Run Results" : "📊 Submission Results"}
                  </span>
                  <span className={`resultsPanel-status ${getStatusClass(results.status)}`}>
                    {results.status || (results.allPassed ? "All Passed" : "Some Failed")}
                  </span>
                </div>
                <div className="resultsPanel-body">
                  {results.error && !displayResults.length && (
                    <div className="resultCase-error">{results.error}</div>
                  )}

                  {/* Score summary */}
                  {resultType === "submit" && (
                    <div style={{
                      padding: "8px 14px",
                      marginBottom: "10px",
                      background: "rgba(30, 41, 59, 0.4)",
                      borderRadius: "8px",
                      fontSize: "13px",
                      color: "#94a3b8",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>Test Cases Passed:</span>
                      <span style={{
                        fontWeight: 700,
                        color: results.allPassed ? "#22c55e" : "#ef4444"
                      }}>
                        {results.passedCount || 0} / {results.totalCount || 0}
                      </span>
                    </div>
                  )}

                  {displayResults.map((tc, i) => (
                    <div
                      key={i}
                      className={`resultCase ${tc.hidden ? "" : tc.passed ? "passed" : "failed"}`}
                    >
                      {tc.hidden ? (
                        <div className="resultCase-header">
                          <span className="resultCase-label">Hidden Test Case {tc.caseNumber}</span>
                          <span className={`resultCase-badge ${tc.passed ? "pass" : "fail"}`}>
                            {tc.passed ? "PASS" : "FAIL"}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="resultCase-header">
                            <span className="resultCase-label">Test Case {tc.caseNumber}</span>
                            <span className={`resultCase-badge ${tc.passed ? "pass" : "fail"}`}>
                              {tc.passed ? "PASS" : "FAIL"}
                            </span>
                          </div>
                          <div className="resultCase-row">
                            <span className="resultCase-key">Input:</span>
                            <span className="resultCase-val">{tc.input}</span>
                          </div>
                          <div className="resultCase-row">
                            <span className="resultCase-key">Expected:</span>
                            <span className="resultCase-val">{tc.expected}</span>
                          </div>
                          {tc.actual !== undefined && tc.actual !== "" && (
                            <div className="resultCase-row">
                              <span className="resultCase-key">Actual:</span>
                              <span
                                className="resultCase-val"
                                style={{ color: tc.passed ? "#22c55e" : "#ef4444" }}
                              >
                                {tc.actual}
                              </span>
                            </div>
                          )}
                          {tc.error && (
                            <div className="resultCase-error">{tc.error}</div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="resultsPanel-empty">
                <span className="resultsPanel-emptyIcon">🧪</span>
                <span>Run or submit your code to see results</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeProblem;
