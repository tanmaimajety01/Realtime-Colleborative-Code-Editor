import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./PracticeList.css";

/**
 * PracticeList — LeetCode-style problem list page.
 * Accessible at /practice
 */
const PracticeList = () => {
  const navigate = useNavigate();

  // ---- Username handling ----
  const [username, setUsername] = useState(() => localStorage.getItem("username") || "");
  
  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    navigate("/");
  };

  // ---- Data ----
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState("All");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("problems"); // "problems" | "leaderboard"

  // ---- Leaderboard ----
  const [leaderboard, setLeaderboard] = useState([]);
  const [totalProblems, setTotalProblems] = useState(0);

  // ---- Fetch problems ----
  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (difficulty !== "All") params.set("difficulty", difficulty);
      if (username) params.set("username", username);
      const res = await fetch(`/api/problems?${params}`);
      const data = await res.json();
      setProblems(data.problems || []);
    } catch (err) {
      console.error("Failed to fetch problems:", err);
    }
    setLoading(false);
  }, [difficulty, username]);

  useEffect(() => {
    if (username) fetchProblems();
  }, [fetchProblems, username]);

  // ---- Fetch leaderboard ----
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
      setTotalProblems(data.totalProblems || 0);
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    }
  }, []);

  useEffect(() => {
    if (view === "leaderboard") fetchLeaderboard();
  }, [view, fetchLeaderboard]);


  // ---- Filter logic ----
  const filteredProblems = problems.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  // ---- Stats ----
  const solvedCount = problems.filter((p) => p.solved).length;
  const easyCount = problems.filter((p) => p.difficulty === "Easy").length;
  const mediumCount = problems.filter((p) => p.difficulty === "Medium").length;
  const hardCount = problems.filter((p) => p.difficulty === "Hard").length;

  return (
    <div className="practicePageWrapper">

      {/* Navigation Bar */}
      <nav className="practiceNav">
        <div className="practiceNav-left">
          <Link to="/" className="practiceNav-logo">SyncCode</Link>
          <div className="practiceNav-divider" />
          <span className="practiceNav-title">Practice Problems</span>
        </div>
        <div className="practiceNav-right">
          {username && (
            <div className="practiceNav-user" style={{ marginRight: '8px' }}>
              <div className="practiceNav-userIcon">
                {username.charAt(0).toUpperCase()}
              </div>
              <span>{username}</span>
            </div>
          )}
          <Link to="/home" className="practiceNav-homeBtn">
            ← Home
          </Link>
          <button onClick={handleLogout} className="practiceNav-homeBtn" style={{ background: "#ef4444", color: "white", borderColor: "#ef4444" }}>
            Logout
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="practiceHero">
        <h1>🏋️ Coding Practice</h1>
        <p>Sharpen your coding skills with curated problems. Solve, submit, and track your progress.</p>
      </div>

      {/* Stats */}
      <div className="practiceStats">
        <div className="practiceStat">
          <span className="practiceStat-value stat-solved">{solvedCount}</span>
          <span className="practiceStat-label">Solved</span>
        </div>
        <div className="practiceStat">
          <span className="practiceStat-value stat-easy">{easyCount}</span>
          <span className="practiceStat-label">Easy</span>
        </div>
        <div className="practiceStat">
          <span className="practiceStat-value stat-medium">{mediumCount}</span>
          <span className="practiceStat-label">Medium</span>
        </div>
        <div className="practiceStat">
          <span className="practiceStat-value stat-hard">{hardCount}</span>
          <span className="practiceStat-label">Hard</span>
        </div>
      </div>

      {/* Filters */}
      <div className="practiceFilters">
        <div className="practiceFilterTabs">
          {["All", "Easy", "Medium", "Hard"].map((d) => (
            <button
              key={d}
              className={`practiceFilterTab ${difficulty === d ? "active" : ""}`}
              onClick={() => setDifficulty(d)}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="practiceFilterRight">
          <div className="practiceSearch">
            <span className="practiceSearch-icon">🔍</span>
            <input
              className="practiceSearch-input"
              type="text"
              placeholder="Search problems..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            className={`practiceViewBtn ${view === "problems" ? "active" : ""}`}
            onClick={() => setView("problems")}
          >
            Problems
          </button>
          <button
            className={`practiceViewBtn ${view === "leaderboard" ? "active" : ""}`}
            onClick={() => setView("leaderboard")}
          >
            🏆 Leaderboard
          </button>
        </div>
      </div>

      {/* Content */}
      {view === "problems" ? (
        <div className="practiceTable-wrapper">
          {loading ? (
            <div className="resultsPanel-loading">
              <div className="spinner" />
              <span>Loading problems...</span>
            </div>
          ) : (
            <table className="practiceTable" id="problems-table">
              <thead>
                <tr>
                  <th className="practiceTable-status">✓</th>
                  <th>#</th>
                  <th>Title</th>
                  <th>Difficulty</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {filteredProblems.map((problem, idx) => (
                  <tr
                    key={problem.id}
                    onClick={() => navigate(`/practice/${problem.id}`)}
                    id={`problem-row-${problem.id}`}
                  >
                    <td className="practiceTable-status">
                      <span
                        className={`practiceTable-statusIcon ${
                          problem.solved ? "solved" : ""
                        }`}
                      >
                        {problem.solved ? "✅" : "○"}
                      </span>
                    </td>
                    <td className="practiceTable-number">{idx + 1}</td>
                    <td>
                      <span className="practiceTable-title">{problem.title}</span>
                    </td>
                    <td>
                      <span
                        className={`diffBadge ${problem.difficulty.toLowerCase()}`}
                      >
                        {problem.difficulty}
                      </span>
                    </td>
                    <td>
                      <span className="categoryBadge">{problem.category}</span>
                    </td>
                  </tr>
                ))}
                {filteredProblems.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "#475569" }}>
                      No problems found matching "{search}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* Leaderboard View */
        <div className="leaderboardPanel">
          <div className="leaderboardCard">
            <div className="leaderboardCard-head">
              <span className="leaderboardCard-title">
                🏆 Leaderboard
              </span>
              <span style={{ color: "#64748b", fontSize: "13px" }}>
                {totalProblems} problems total
              </span>
            </div>
            {leaderboard.length === 0 ? (
              <div className="leaderboard-empty">
                No submissions yet. Be the first to solve a problem!
              </div>
            ) : (
              leaderboard.map((entry) => (
                <div className="leaderboard-row" key={entry.username}>
                  <span
                    className={`leaderboard-rank ${
                      entry.rank === 1
                        ? "gold"
                        : entry.rank === 2
                        ? "silver"
                        : entry.rank === 3
                        ? "bronze"
                        : ""
                    }`}
                  >
                    {entry.rank === 1
                      ? "🥇"
                      : entry.rank === 2
                      ? "🥈"
                      : entry.rank === 3
                      ? "🥉"
                      : `#${entry.rank}`}
                  </span>
                  <span
                    className={`leaderboard-user ${
                      entry.username === username ? "isMe" : ""
                    }`}
                  >
                    {entry.username}
                    {entry.username === username ? " (you)" : ""}
                  </span>
                  <span className="leaderboard-score">
                    {entry.problemsSolved} solved
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeList;
