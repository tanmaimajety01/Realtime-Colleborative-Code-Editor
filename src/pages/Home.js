import React, { useState, useEffect } from "react";
import { v4 as uuidV4 } from "uuid";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();

  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    // Populate username from strictly validated auth
    const storedName = localStorage.getItem("username");
    if (storedName) {
      setUsername(storedName);
    }
  }, []);

  const createNewRoom = () => {
    const id = uuidV4();
    setRoomId(id);
    toast.success("New room created");
  };

  const joinRoom = () => {
    if (!roomId) {
      toast.error("Room ID is required");
      return;
    }

    navigate(`/editor/${roomId}`, {
      state: {
        username: username,
      },
    });
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    localStorage.removeItem("practiceUsername"); // legacy cleanup
    toast.success("Logged out successfully");
    navigate("/");
  };

  return (
    <div className="homePageWrapper">
      <div className="formWrapper">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h1 className="mainLabel" style={{ marginBottom: "4px" }}>SyncCode</h1>
            <p className="subLabel" style={{ marginTop: 0 }}>Welcome back, <span style={{color: "#818cf8"}}>{username}</span></p>
          </div>
          <button 
            onClick={logout} 
            style={{
              padding: "6px 12px", 
              background: "#ef4444", 
              border: "none", 
              borderRadius: "6px", 
              color: "white", 
              cursor:"pointer",
              fontSize: "12px",
              fontWeight: "bold"
            }}>
            Logout
          </button>
        </div>

        <button onClick={createNewRoom} className="createBtn">
          Create New Room
        </button>

        <p className="joinLabel">OR JOIN A ROOM</p>

        <div className="inputGroup">
          <input
            type="text"
            className="inputBox"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />

          {/* Username removed: implicitly bound from context! */}

          <button onClick={joinRoom} className="joinBtn">
            Join Room →
          </button>
        </div>

        {/* Practice Platform Link */}
        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #1e293b" }}>
          <button
            onClick={() => navigate("/practice")}
            style={{
              width: "100%",
              padding: "12px",
              background: "linear-gradient(135deg, #6366f1, #a78bfa)",
              border: "none",
              borderRadius: "8px",
              color: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.boxShadow = "0 4px 20px rgba(99, 102, 241, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.target.style.boxShadow = "none";
            }}
          >
            🏋️ Practice Problems
          </button>
          <p style={{ color: "#64748b", fontSize: "12px", marginTop: "8px" }}>
            Solve coding challenges & track your progress
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
