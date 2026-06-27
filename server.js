require("dotenv").config();
const express = require("express");
const app = express();

const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const fs = require("fs");
const { spawn } = require("child_process");
const mongoose = require("mongoose");

const ACTIONS = require("./src/actions/Actions");

let ptyModule = null;
try {
  ptyModule = require("node-pty");
} catch (e) {
  console.warn("[terminal] node-pty not loaded:", e.message);
}

/** @type {Map<string, import('node-pty').IPty>} */
const activeTerminals = new Map();

function killTerminalSession(socketId) {
  const ptyProc = activeTerminals.get(socketId);
  if (!ptyProc) return;
  try {
    ptyProc.kill();
  } catch (e) {
    /* ignore */
  }
  activeTerminals.delete(socketId);
}

/** Directory where npm/node commands should run (project root with package.json). */
function getTerminalCwd(requestedCwd) {
  if (typeof requestedCwd === "string" && requestedCwd && fs.existsSync(requestedCwd)) {
    return path.resolve(requestedCwd);
  }
  const fromProcess = process.cwd();
  if (fs.existsSync(path.join(fromProcess, "package.json"))) {
    return fromProcess;
  }
  const fromServer = __dirname;
  if (fs.existsSync(path.join(fromServer, "package.json"))) {
    return fromServer;
  }
  return fromProcess;
}

function ptyDataToString(data) {
  if (data === undefined || data === null) return "";
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  return String(data);
}

// ✅ Create server
const server = http.createServer(app);

// ✅ FIX: Add CORS for socket
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ✅ Middleware
app.use(express.json());

// ================= AUTHENTICATION =================
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_super_secret_key_123";

let User = null;
let authDbReady = false;

// Persistent Local Fallback (if MongoDB is not setup)
const USERS_FILE = path.join(__dirname, "users.json");

function getLocalUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch (err) {
    return [];
  }
}

function saveLocalUser(userData) {
  const users = getLocalUsers();
  users.push(userData);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

async function initAuthDb() {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log("[auth] MongoDB not connected. Falling back to local users.json.");
      return;
    }
    const userSchema = new mongoose.Schema(
      {
        username: { type: String, required: true, unique: true },
        email:    { type: String, required: true, unique: true },
        password: { type: String, required: true },
      },
      { timestamps: true }
    );
    User = mongoose.models.User || mongoose.model("User", userSchema);
    authDbReady = true;
    console.log("[auth] MongoDB User model initialized successfully.");
  } catch (e) {
    console.warn("[auth] Failed to initialize Auth models - Falling back to local storage:", e.message);
  }
}

setTimeout(initAuthDb, 2000);
mongoose.connection.on("connected", () => {
  if (!authDbReady) initAuthDb();
});

app.post("/api/auth/register", async (req, res) => {
  try {
    let { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }
    
    // Standardize email to lowercase to prevent case-sensitive login errors!
    email = email.toLowerCase().trim();

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (authDbReady && User) {
      const existingUser = await User.findOne({ $or: [{ username }, { email }] });
      if (existingUser) {
        return res.status(400).json({ error: "User or Email already exists" });
      }
      await User.create({ username, email, password: hashedPassword });
    } else {
      const localUsers = getLocalUsers();
      const exists = localUsers.find(u => u.username === username || u.email === email);
      if (exists) {
        return res.status(400).json({ error: "User or Email already exists" });
      }
      saveLocalUser({ username, email, password: hashedPassword });
    }

    const token = jwt.sign({ username, email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, username, email });
  } catch (err) {
    res.status(500).json({ error: "Server error during registration" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Standardize email to lowercase for exact matching
    email = email.toLowerCase().trim();

    let user = null;
    if (authDbReady && User) {
      user = await User.findOne({ email });
    } else {
      const localUsers = getLocalUsers();
      user = localUsers.find(u => u.email === email);
    }

    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ username: user.username, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ error: "Server error during login" });
  }
});

// ================= SOCKET =================

const userSocketMap = {};
/** @type {Map<string, any[]>} */
const roomChatHistory = new Map();
const MAX_CHAT_HISTORY = 100;

let chatDbReady = false;
let ChatMessage = null;

async function initChatDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("[chat] MONGODB_URI not set; using in-memory chat only.");
    return;
  }
  try {
    await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });
    const schema = new mongoose.Schema(
      {
        roomId: { type: String, index: true, required: true },
        id: { type: String, index: true, required: true },
        username: { type: String, required: true },
        text: { type: String, required: true },
        ts: { type: Number, index: true, required: true },
        kind: { type: String, default: "text" }, // text | snippet
        meta: { type: Object, default: {} },
        pinned: { type: Boolean, default: false, index: true },
        reactions: { type: Object, default: {} }, // { "👍": ["alice","bob"] }
      },
      { minimize: false }
    );
    schema.index({ roomId: 1, ts: -1 });
    ChatMessage = mongoose.model("ChatMessage", schema);
    chatDbReady = true;
    console.log("[chat] MongoDB connected.");
  } catch (e) {
    console.warn("[chat] MongoDB connect failed; using in-memory chat only.", e.message);
  }
}

initChatDb();

function safeTrimmedString(v, maxLen) {
  if (v === undefined || v === null) return "";
  const s = String(v).trim();
  if (!s) return "";
  const limit = Number(maxLen) > 0 ? Number(maxLen) : 2000;
  return s.length > limit ? s.slice(0, limit) : s;
}

function addMessageToMemory(roomId, message) {
  const prev = roomChatHistory.get(roomId) || [];
  const next = prev.concat(message).slice(-MAX_CHAT_HISTORY);
  roomChatHistory.set(roomId, next);
  return next;
}

async function getRoomHistory(roomId) {
  if (chatDbReady && ChatMessage) {
    const docs = await ChatMessage.find({ roomId }).sort({ ts: -1 }).limit(MAX_CHAT_HISTORY).lean();
    return docs.reverse();
  }
  return roomChatHistory.get(roomId) || [];
}

async function upsertMessage(roomId, message) {
  addMessageToMemory(roomId, message);
  if (chatDbReady && ChatMessage) {
    try {
      await ChatMessage.updateOne({ roomId, id: message.id }, { $set: { ...message, roomId } }, { upsert: true });
    } catch (e) {
      // ignore DB errors; memory still works
    }
  }
}

const INTERACTIVE_RUN_TIMEOUT_MS = 120000;

/** @type {Map<string, { child: import('child_process').ChildProcess, timer: NodeJS.Timeout, cleanupPaths: string[], done: boolean }>} */
const activeCodeRuns = new Map();

function cleanupPaths(paths) {
  (paths || []).forEach((p) => {
    try {
      if (!p || !fs.existsSync(p)) return;
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        fs.rmSync(p, { recursive: true, force: true });
      } else {
        fs.unlinkSync(p);
      }
    } catch (e) {
      /* ignore */
    }
  });
}

function killActiveCodeRun(socketId) {
  const session = activeCodeRuns.get(socketId);
  if (!session) return;
  clearTimeout(session.timer);
  try {
    if (session.child && !session.child.killed) {
      session.child.kill("SIGKILL");
    }
  } catch (e) {
    /* ignore */
  }
  cleanupPaths(session.cleanupPaths);
  activeCodeRuns.delete(socketId);
}

function attachInteractiveRunProcess(socket, child, pathsToCleanup) {
  const cleanupList = pathsToCleanup || [];
  const session = {
    child,
    timer: null,
    cleanupPaths: cleanupList,
    done: false,
  };

  const finish = (exitCode, timedOut) => {
    if (session.done) return;
    session.done = true;
    clearTimeout(session.timer);
    activeCodeRuns.delete(socket.id);
    cleanupPaths(cleanupList);
    socket.emit(ACTIONS.RUN_DONE, { exitCode, timedOut: !!timedOut });
  };

  session.timer = setTimeout(() => {
    try {
      if (child && !child.killed) child.kill("SIGKILL");
    } catch (e) {
      /* ignore */
    }
    finish(null, true);
  }, INTERACTIVE_RUN_TIMEOUT_MS);

  activeCodeRuns.set(socket.id, session);

  child.stdout?.on("data", (data) => {
    socket.emit(ACTIONS.RUN_STDOUT, { text: data.toString() });
  });
  child.stderr?.on("data", (data) => {
    socket.emit(ACTIONS.RUN_STDERR, { text: data.toString() });
  });

  child.on("close", (exitCode) => {
    finish(exitCode, false);
  });

  child.on("error", (err) => {
    if (session.done) return;
    session.done = true;
    clearTimeout(session.timer);
    activeCodeRuns.delete(socket.id);
    cleanupPaths(cleanupList);
    socket.emit(ACTIONS.RUN_FAILED, {
      message: `Execution error: ${err.message}`,
    });
  });
}

function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => ({
      socketId,
      username: userSocketMap[socketId],
    })
  );
}

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on(ACTIONS.RUN_START, ({ code, language }) => {
    killActiveCodeRun(socket.id);

    if (!code || !language) {
      return socket.emit(ACTIONS.RUN_FAILED, {
        message: "code and language are required",
      });
    }

    if (language === "htmlmixed" || language === "css") {
      return socket.emit(ACTIONS.RUN_FAILED, {
        message: "Run is not supported for HTML/CSS here.",
      });
    }

    const timestamp = Date.now();

    try {
      if (language === "python" || language === "python3") {
        const filePath = `temp_${timestamp}.py`;
        fs.writeFileSync(filePath, code);
        const child = spawn("python", ["-u", filePath]);
        attachInteractiveRunProcess(socket, child, [filePath]);
        return;
      }

      if (language === "javascript") {
        const filePath = `temp_${timestamp}.js`;
        fs.writeFileSync(filePath, code);
        const child = spawn("node", [filePath]);
        attachInteractiveRunProcess(socket, child, [filePath]);
        return;
      }

      if (language === "java") {
        const publicClassMatch = code.match(/public\s+class\s+([A-Za-z_]\w*)/);
        const classMatch = code.match(/class\s+([A-Za-z_]\w*)/);
        const className = publicClassMatch?.[1] || classMatch?.[1] || "Main";
        const javaTempDir = path.join(__dirname, `temp_java_${timestamp}`);
        fs.mkdirSync(javaTempDir, { recursive: true });
        const filePath = path.join(javaTempDir, `${className}.java`);
        fs.writeFileSync(filePath, code);

        const compileProcess = spawn("javac", [filePath]);
        let compileError = "";
        compileProcess.stderr.on("data", (d) => {
          compileError += d.toString();
        });
        compileProcess.on("close", (exitCode) => {
          if (exitCode !== 0) {
            cleanupPaths([javaTempDir]);
            return socket.emit(ACTIONS.RUN_FAILED, {
              message: compileError || "Compilation failed",
            });
          }
          const runProcess = spawn("java", ["-cp", javaTempDir, className]);
          attachInteractiveRunProcess(socket, runProcess, [javaTempDir]);
        });
        compileProcess.on("error", (err) => {
          cleanupPaths([javaTempDir]);
          socket.emit(ACTIONS.RUN_FAILED, {
            message: `javac: ${err.message}`,
          });
        });
        return;
      }

      if (language === "c" || language === "cpp") {
        const isCpp = language === "cpp";
        const filePath = `temp_${timestamp}.${isCpp ? "cpp" : "c"}`;
        fs.writeFileSync(filePath, code);
        const exePath = `temp_${timestamp}${process.platform === "win32" ? ".exe" : ""}`;
        const compiler = isCpp ? "g++" : "gcc";

        const compileProcess = spawn(compiler, [filePath, "-o", exePath]);
        let compileError = "";
        compileProcess.stderr.on("data", (d) => {
          compileError += d.toString();
        });
        compileProcess.on("close", (exitCode) => {
          if (exitCode !== 0) {
            cleanupPaths([filePath]);
            return socket.emit(ACTIONS.RUN_FAILED, {
              message: compileError || "Compilation failed",
            });
          }
          const execPath = process.platform === "win32" ? exePath : `./${exePath}`;
          const runProcess = spawn(execPath, []);
          attachInteractiveRunProcess(socket, runProcess, [filePath, exePath]);
        });
        compileProcess.on("error", (err) => {
          cleanupPaths([filePath]);
          socket.emit(ACTIONS.RUN_FAILED, {
            message: `${compiler}: ${err.message}`,
          });
        });
        return;
      }

      socket.emit(ACTIONS.RUN_FAILED, {
        message: `Language '${language}' is not supported for run.`,
      });
    } catch (err) {
      socket.emit(ACTIONS.RUN_FAILED, {
        message: err.message || "Internal server error",
      });
    }
  });

  socket.on(ACTIONS.RUN_STDIN, ({ line } = {}) => {
    const session = activeCodeRuns.get(socket.id);
    if (!session?.child?.stdin || session.child.stdin.destroyed) return;
    const s = line === undefined || line === null ? "" : String(line);
    const payload = s.endsWith("\n") ? s : `${s}\n`;
    try {
      session.child.stdin.write(payload);
    } catch (e) {
      /* ignore */
    }
  });

  // ----- Integrated terminal (real shell via node-pty) -----
  socket.on(ACTIONS.TERMINAL_START, ({ cols, rows, cwd, promptName } = {}) => {
    killTerminalSession(socket.id);
    if (!ptyModule) {
      return socket.emit(ACTIONS.TERMINAL_ERROR, {
        message:
          "Integrated terminal is unavailable (node-pty could not be loaded). Install build tools and run npm install again.",
      });
    }
    let cwdSafe = getTerminalCwd(cwd);
    
    // Mount custom physical workspace directory if provided
    if (cwd && cwd.startsWith("temp_workspaces")) {
       cwdSafe = path.join(__dirname, cwd);
       if (!fs.existsSync(cwdSafe)) fs.mkdirSync(cwdSafe, { recursive: true });
    }

    try {
      const isWin = process.platform === "win32";
      const shell = isWin ? process.env.COMSPEC || "cmd.exe" : process.env.SHELL || "/bin/bash";
      const shellArgs = isWin ? [] : [];
      const termEnv = {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      };
      
      // Inject cosmetic terminal names if a workspace was loaded
      if (promptName && promptName !== "Workspace") {
          if (isWin) {
             termEnv.PROMPT = `${promptName}$G `;
          } else {
             termEnv.PS1 = `\\[\\e[32m\\]${promptName}\\[\\e[0m\\]$ `;
          }
      }

      const c = Math.min(Math.max(Number(cols) || 80, 40), 500);
      const r = Math.min(Math.max(Number(rows) || 24, 8), 200);
      const spawnOpts = {
        name: "xterm-256color",
        cols: c,
        rows: r,
        cwd: cwdSafe,
        env: termEnv,
      };
      if (isWin) {
        spawnOpts.useConpty = true;
      }
      let ptyProc;
      try {
        ptyProc = ptyModule.spawn(shell, shellArgs, spawnOpts);
      } catch (spawnErr) {
        if (isWin && spawnOpts.useConpty) {
          delete spawnOpts.useConpty;
          ptyProc = ptyModule.spawn(shell, shellArgs, spawnOpts);
        } else {
          throw spawnErr;
        }
      }
      activeTerminals.set(socket.id, ptyProc);
      ptyProc.onData((data) => {
        socket.emit(ACTIONS.TERMINAL_OUTPUT, { data: ptyDataToString(data) });
      });
      ptyProc.onExit((code, signal) => {
        activeTerminals.delete(socket.id);
        socket.emit(ACTIONS.TERMINAL_EXIT, { code, signal });
      });
      const cwdDisplay = cwdSafe.replace(/\\/g, "/");
      socket.emit(ACTIONS.TERMINAL_OUTPUT, {
        data: `\x1b[90m# Terminal mounted at: ${cwdDisplay}\x1b[0m\r\n\x1b[90m# Virtual workspace scripts have been synchronized physically.\x1b[0m\r\n`,
      });
    } catch (err) {
      socket.emit(ACTIONS.TERMINAL_ERROR, {
        message: err.message || "Failed to start shell",
      });
    }
  });

  socket.on(ACTIONS.TERMINAL_INPUT, ({ data } = {}) => {
    const ptyProc = activeTerminals.get(socket.id);
    if (!ptyProc || data === undefined || data === null) return;
    try {
      ptyProc.write(data);
    } catch (e) {
      /* ignore */
    }
  });

  socket.on(ACTIONS.TERMINAL_RESIZE, ({ cols, rows } = {}) => {
    const ptyProc = activeTerminals.get(socket.id);
    if (!ptyProc) return;
    try {
      ptyProc.resize(
        Math.min(Math.max(cols || 80, 40), 500),
        Math.min(Math.max(rows || 24, 8), 200)
      );
    } catch (e) {
      /* ignore */
    }
  });

  socket.on(ACTIONS.TERMINAL_KILL, () => {
    killTerminalSession(socket.id);
  });
  
  // Physical synchronization engines
  socket.on("SYNC_FULL_WORKSPACE", ({ roomId, files }) => {
    if (!roomId || !files) return;
    try {
      const workspaceDir = path.join(__dirname, 'temp_workspaces', roomId);
      if (fs.existsSync(workspaceDir)) {
          fs.rmSync(workspaceDir, { recursive: true, force: true });
      }
      fs.mkdirSync(workspaceDir, { recursive: true });
      for (const [p, content] of Object.entries(files)) {
         const safePath = p.replace(/\.\./g, ""); // Security sanitization against path traversal
         const fullPath = path.join(workspaceDir, safePath);
         fs.mkdirSync(path.dirname(fullPath), { recursive: true });
         fs.writeFileSync(fullPath, content || "");
      }
    } catch (e) {
      console.warn("Failed syncing full workspace to physical sandbox", e);
    }
  });

  socket.on("SYNC_SINGLE_FILE", ({ roomId, filePath, code }) => {
    if (!roomId || !filePath) return;
    try {
      const workspaceDir = path.join(__dirname, 'temp_workspaces', roomId);
      const safePath = filePath.replace(/\.\./g, ""); // Security
      const fullPath = path.join(workspaceDir, safePath);
      if (!fs.existsSync(workspaceDir)) {
         fs.mkdirSync(workspaceDir, { recursive: true });
      }
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, code || "");
    } catch (e) {
      /* ignore */
    }
  });

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);

    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });

    Promise.resolve()
      .then(() => getRoomHistory(roomId))
      .then((messages) => socket.emit(ACTIONS.CHAT_HISTORY, { roomId, messages }))
      .catch(() => socket.emit(ACTIONS.CHAT_HISTORY, { roomId, messages: roomChatHistory.get(roomId) || [] }));
  });

  socket.on(ACTIONS.CHAT_MESSAGE, ({ roomId, text, tempId, kind, meta } = {}, ack) => {
    const msgText = safeTrimmedString(text, 2000);
    if (!roomId || !msgText) return;

    const username = userSocketMap[socket.id] || "Guest";
    const message = {
      id: safeTrimmedString(tempId, 80) || `${Date.now()}_${socket.id}`,
      username,
      text: msgText,
      ts: Date.now(),
      kind: safeTrimmedString(kind, 20) || "text",
      meta: meta && typeof meta === "object" ? meta : {},
      pinned: false,
      reactions: {},
    };

    upsertMessage(roomId, message);

    io.to(roomId).emit(ACTIONS.CHAT_MESSAGE, { roomId, message });

    if (typeof ack === "function") {
      ack({ ok: true });
    }
  });

  socket.on(ACTIONS.CHAT_TYPING, ({ roomId } = {}) => {
    if (!roomId) return;
    socket.to(roomId).emit(ACTIONS.CHAT_TYPING, {
      roomId,
      username: userSocketMap[socket.id] || "Guest",
      socketId: socket.id,
    });
  });

  socket.on(ACTIONS.CHAT_STOP_TYPING, ({ roomId } = {}) => {
    if (!roomId) return;
    socket.to(roomId).emit(ACTIONS.CHAT_STOP_TYPING, {
      roomId,
      username: userSocketMap[socket.id] || "Guest",
      socketId: socket.id,
    });
  });

  socket.on(ACTIONS.CHAT_REACTION, async ({ roomId, messageId, emoji } = {}, ack) => {
    if (!roomId) return;
    const mid = safeTrimmedString(messageId, 120);
    const em = safeTrimmedString(emoji, 8);
    if (!mid || !em) return;
    const who = userSocketMap[socket.id] || "Guest";

    const history = roomChatHistory.get(roomId) || [];
    const idx = history.findIndex((m) => m && m.id === mid);
    if (idx >= 0) {
      const msg = history[idx];
      msg.reactions = msg.reactions && typeof msg.reactions === "object" ? msg.reactions : {};
      const arr = Array.isArray(msg.reactions[em]) ? msg.reactions[em] : [];
      const has = arr.includes(who);
      msg.reactions[em] = has ? arr.filter((x) => x !== who) : arr.concat(who);
      addMessageToMemory(roomId, history[idx]); // refresh trim
    }

    if (chatDbReady && ChatMessage) {
      try {
        const doc = await ChatMessage.findOne({ roomId, id: mid });
        if (doc) {
          const reactions = doc.reactions && typeof doc.reactions === "object" ? doc.reactions : {};
          const arr = Array.isArray(reactions[em]) ? reactions[em] : [];
          reactions[em] = arr.includes(who) ? arr.filter((x) => x !== who) : arr.concat(who);
          doc.reactions = reactions;
          await doc.save();
        }
      } catch (e) {
        /* ignore */
      }
    }

    // Grab updated reactions from memory or default to empty
    let updatedReactions = {};
    const memMsg = (roomChatHistory.get(roomId) || []).find((m) => m && m.id === mid);
    if (memMsg) {
      updatedReactions = memMsg.reactions || {};
    }

    io.to(roomId).emit(ACTIONS.CHAT_REACTION, { roomId, messageId: mid, emoji: em, reactions: updatedReactions });
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on(ACTIONS.CHAT_PIN, async ({ roomId, messageId, pinned } = {}, ack) => {
    if (!roomId) return;
    const mid = safeTrimmedString(messageId, 120);
    if (!mid) return;
    const val = !!pinned;

    const history = roomChatHistory.get(roomId) || [];
    const idx = history.findIndex((m) => m && m.id === mid);
    if (idx >= 0) {
      history[idx].pinned = val;
      addMessageToMemory(roomId, history[idx]);
    }

    if (chatDbReady && ChatMessage) {
      try {
        await ChatMessage.updateOne({ roomId, id: mid }, { $set: { pinned: val } });
      } catch (e) {
        /* ignore */
      }
    }

    io.to(roomId).emit(ACTIONS.CHAT_PIN, { roomId, messageId: mid, pinned: val });
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.to(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on("disconnecting", () => {
    killTerminalSession(socket.id);
    killActiveCodeRun(socket.id);
    const rooms = [...socket.rooms];

    rooms.forEach((roomId) => {
      socket.to(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });

    delete userSocketMap[socket.id];
  });
});

// ================= AI CODING ASSISTANT (Gemini) =================

const { GoogleGenAI } = require("@google/genai");

const AI_SYSTEM_PROMPT = `You are an expert AI coding assistant embedded in a collaborative code editor called SyncCode. You help developers write, understand, debug, and improve code.

Capabilities & Rules:
- Be concise, precise, and code-focused. Prefer showing code over explaining in words.
- Use markdown formatting: code blocks with language tags, bold for emphasis, bullet lists for steps.
- When the user shares code, analyze it carefully before responding.
- For "explain" — break down logic step-by-step with inline annotations.
- For "find bugs" — identify bugs, edge cases, security issues, and performance problems. Rank by severity.
- For "refactor" — show the improved version with brief rationale for each change.
- For "add comments" — return the full code with clear, professional inline comments.
- For "optimize" — suggest performance improvements with big-O analysis if relevant.
- If you're unsure about something, say so honestly.
- Remember previous messages in the conversation for context.`;

// Models to try in order (fallback chain) — using current non-deprecated models
const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

// Per-session conversation history (keyed by session ID from client)
const aiConversationHistory = new Map();
const MAX_AI_HISTORY = 20; // max turns to keep per session
const AI_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Cleanup stale AI sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of aiConversationHistory) {
    if (now - session.lastUsed > AI_SESSION_TTL_MS) {
      aiConversationHistory.delete(key);
    }
  }
}, 5 * 60 * 1000);

function getOrCreateSession(sessionId) {
  if (!aiConversationHistory.has(sessionId)) {
    aiConversationHistory.set(sessionId, { history: [], lastUsed: Date.now() });
  }
  const session = aiConversationHistory.get(sessionId);
  session.lastUsed = Date.now();
  return session;
}

async function tryGenerateStream(ai, contents, modelIndex = 0) {
  if (modelIndex >= GEMINI_MODELS.length) {
    throw new Error("All models are currently unavailable. Please try again in a minute.");
  }

  const modelName = GEMINI_MODELS[modelIndex];

  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const stream = await ai.models.generateContentStream({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction: AI_SYSTEM_PROMPT,
          temperature: 0.4,
          maxOutputTokens: 4096,
        },
      });
      return stream;
    } catch (err) {
      const status = err?.status || err?.httpErrorCode || 0;
      const msg = err?.message || "";

      // 429 = rate limit — retry with exponential backoff
      if (status === 429 || msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
        const waitMs = Math.min(Math.pow(2, attempt + 1) * 1000, 32000); // 2s, 4s, 8s, 16s, 32s
        console.log(`[AI] Rate limited on ${modelName}, retry ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      // 404/model not found — try next model immediately
      if (status === 404 || msg.includes("not found") || msg.includes("not available")) {
        console.log(`[AI] Model ${modelName} not available. Trying next model...`);
        return tryGenerateStream(ai, contents, modelIndex + 1);
      }

      // Other errors — try next model
      console.log(`[AI] Error on ${modelName}: ${msg}. Trying next model...`);
      return tryGenerateStream(ai, contents, modelIndex + 1);
    }
  }

  // If all retries exhausted for this model, try the next one
  console.log(`[AI] All retries exhausted for ${modelName}. Trying next model...`);
  return tryGenerateStream(ai, contents, modelIndex + 1);
}

app.post("/api/ai", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY not set. Add it to your .env file. Get a free key at https://aistudio.google.com",
    });
  }

  const { prompt, code, language, sessionId, clearHistory } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  // Session management
  const sid = sessionId || "default";
  if (clearHistory) {
    aiConversationHistory.delete(sid);
  }
  const session = getOrCreateSession(sid);

  // Build the user message with code context if available
  let userMessage = prompt;
  if (code && code.trim()) {
    userMessage = `Current code (${language || "unknown"}):\n\`\`\`${language || ""}\n${code}\n\`\`\`\n\nUser request: ${prompt}`;
  }

  // Build conversation contents with history for multi-turn
  const contents = [];
  for (const turn of session.history) {
    contents.push({ role: turn.role, parts: [{ text: turn.text }] });
  }
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  // Set up streaming response headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Timeout protection — abort after 60 seconds
  const timeout = setTimeout(() => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: "Request timed out. Please try again." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }, 60000);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const stream = await tryGenerateStream(ai, contents);

    let fullResponse = "";

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    // Save conversation history
    session.history.push({ role: "user", text: userMessage });
    session.history.push({ role: "model", text: fullResponse });
    // Trim history to max
    while (session.history.length > MAX_AI_HISTORY * 2) {
      session.history.shift();
      session.history.shift();
    }

    clearTimeout(timeout);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    clearTimeout(timeout);
    console.error("[AI] Final error:", err.message);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: err.message || "AI request failed. Please try again." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
});

// Clear AI history endpoint
app.post("/api/ai/clear", (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    aiConversationHistory.delete(sessionId);
  }
  res.json({ ok: true });
});

// ================= RUN CODE =================

app.post("/run", (req, res) => {
  const { code, language } = req.body;
  const timeout = 10000;

  if (!code || !language) {
    return res.status(400).json({ output: "", error: "code and language are required" });
  }

  const timestamp = Date.now();
  let filePath;

  const cleanup = (paths) => {
    paths.forEach((p) => {
      try {
        if (p) fs.unlinkSync(p);
      } catch (e) {}
    });
  };

  const sendError = (message) => {
    res.json({ output: "", error: message });
  };

  try {
    if (language === "python" || language === "python3") {
      filePath = `temp_${timestamp}.py`;
      fs.writeFileSync(filePath, code);
      const childProcess = spawn("python", [filePath]);

      let output = "";
      let error = "";
      const timer = setTimeout(() => {
        childProcess.kill();
      }, timeout);

      childProcess.stdout.on("data", (data) => (output += data.toString()));
      childProcess.stderr.on("data", (data) => (error += data.toString()));

      childProcess.on("close", () => {
        clearTimeout(timer);
        cleanup([filePath]);
        res.json({ output: output || error || "No output" });
      });

      childProcess.on("error", (err) => {
        clearTimeout(timer);
        cleanup([filePath]);
        sendError(`Execution error: ${err.message}`);
      });

      return;
    }

    if (language === "javascript") {
      filePath = `temp_${timestamp}.js`;
      fs.writeFileSync(filePath, code);
      const childProcess = spawn("node", [filePath]);

      let output = "";
      let error = "";
      const timer = setTimeout(() => {
        childProcess.kill();
      }, timeout);

      childProcess.stdout.on("data", (data) => (output += data.toString()));
      childProcess.stderr.on("data", (data) => (error += data.toString()));

      childProcess.on("close", () => {
        clearTimeout(timer);
        cleanup([filePath]);
        res.json({ output: output || error || "No output" });
      });

      childProcess.on("error", (err) => {
        clearTimeout(timer);
        cleanup([filePath]);
        sendError(`Execution error: ${err.message}`);
      });

      return;
    }

    if (language === "java") {
      filePath = `temp_${timestamp}.java`;
      fs.writeFileSync(filePath, code);
      const className = "Main";

      const compileProcess = spawn("javac", [filePath]);
      let compileError = "";

      compileProcess.stderr.on("data", (data) => (compileError += data.toString()));

      compileProcess.on("close", (exitCode) => {
        if (exitCode !== 0) {
          cleanup([filePath]);
          return sendError(compileError || "Compilation failed");
        }

        const runProcess = spawn("java", ["-cp", ".", className]);
        let output = "";
        let runError = "";
        const timer = setTimeout(() => runProcess.kill(), timeout);

        runProcess.stdout.on("data", (data) => (output += data.toString()));
        runProcess.stderr.on("data", (data) => (runError += data.toString()));

        runProcess.on("close", () => {
          clearTimeout(timer);
          cleanup([filePath, `${className}.class`]);
          res.json({ output: output || runError || "No output" });
        });

        runProcess.on("error", (err) => {
          clearTimeout(timer);
          cleanup([filePath, `${className}.class`]);
          sendError(`Execution error: ${err.message}`);
        });
      });

      return;
    }

    if (language === "c" || language === "cpp") {
      const isCpp = language === "cpp";
      filePath = `temp_${timestamp}.${isCpp ? "cpp" : "c"}`;
      fs.writeFileSync(filePath, code);
      const exePath = `temp_${timestamp}${process.platform === "win32" ? ".exe" : ""}`;
      const compiler = isCpp ? "g++" : "gcc";

      const compileProcess = spawn(compiler, [filePath, "-o", exePath]);
      let compileError = "";

      compileProcess.stderr.on("data", (data) => (compileError += data.toString()));

      compileProcess.on("close", (exitCode) => {
        if (exitCode !== 0) {
          cleanup([filePath]);
          return sendError(compileError || "Compilation failed");
        }

        const execPath = process.platform === "win32" ? exePath : `./${exePath}`;
        const runProcess = spawn(execPath, []);
        let output = "";
        let runError = "";
        const timer = setTimeout(() => runProcess.kill(), timeout);

        runProcess.stdout.on("data", (data) => (output += data.toString()));
        runProcess.stderr.on("data", (data) => (runError += data.toString()));

        runProcess.on("close", () => {
          clearTimeout(timer);
          cleanup([filePath, exePath]);
          res.json({ output: output || runError || "No output" });
        });

        runProcess.on("error", (err) => {
          clearTimeout(timer);
          cleanup([filePath, exePath]);
          sendError(`Execution error: ${err.message}`);
        });
      });

      return;
    }

    return res.status(400).json({ output: "", error: `Language '${language}' is not supported. Supported: python, javascript, c, cpp, java` });
  } catch (err) {
    cleanup([filePath]);
    return res.status(500).json({ output: "", error: err.message || "Internal server error" });
  }
});

// ================= PRACTICE PLATFORM (LeetCode-style) =================

const problems = require("./src/practice/problemsData");

// ---- MongoDB Models for Practice Platform ----
let PracticeSubmission = null;
let UserProgress = null;
let practiceDbReady = false;

async function initPracticeModels() {
  // Wait for mongoose to be connected (chat init handles connection)
  // We just define models — the connection is shared
  try {
    if (mongoose.connection.readyState !== 1) {
      // Not connected yet; will try to use models later
      console.log("[practice] MongoDB not connected yet; will use in-memory fallback.");
      return;
    }

    // Submission model — every attempt by a user
    const submissionSchema = new mongoose.Schema(
      {
        username: { type: String, required: true, index: true },
        problemId: { type: String, required: true, index: true },
        problemTitle: { type: String, default: "" },
        language: { type: String, required: true },
        code: { type: String, required: true },
        result: { type: String, required: true }, // "Accepted"|"Wrong Answer"|"Runtime Error"|"Time Limit Exceeded"
        passedCount: { type: Number, default: 0 },
        totalCount: { type: Number, default: 0 },
        testResults: { type: Array, default: [] },
        createdAt: { type: Date, default: Date.now, index: true },
      },
      { timestamps: false }
    );
    submissionSchema.index({ username: 1, problemId: 1 });
    submissionSchema.index({ username: 1, createdAt: -1 });
    PracticeSubmission = mongoose.model("PracticeSubmission", submissionSchema);

    // UserProgress model — tracks solved status per user+problem
    const progressSchema = new mongoose.Schema(
      {
        username: { type: String, required: true },
        problemId: { type: String, required: true },
        solved: { type: Boolean, default: false },
        lastLanguage: { type: String, default: "javascript" },
        lastCode: { type: String, default: "" },
        attempts: { type: Number, default: 0 },
        solvedAt: { type: Date, default: null },
      },
      { timestamps: true }
    );
    progressSchema.index({ username: 1, problemId: 1 }, { unique: true });
    UserProgress = mongoose.model("UserProgress", progressSchema);

    practiceDbReady = true;
    console.log("[practice] MongoDB models initialized.");
  } catch (e) {
    console.warn("[practice] Could not initialize models:", e.message);
  }
}

// Try initializing models after a short delay to let chat init connect first
setTimeout(initPracticeModels, 3000);
// Also try when mongoose connects
mongoose.connection.on("connected", () => {
  if (!practiceDbReady) initPracticeModels();
});

// In-memory fallback for submissions when MongoDB is unavailable
const inMemorySubmissions = [];
const inMemoryProgress = new Map(); // key: "username::problemId"

// ---- Helper: Execute code against test cases in a sandbox ----
function executePracticeCode(code, language, testCases, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const results = [];
    let caseIndex = 0;

    function runNextCase() {
      if (caseIndex >= testCases.length) {
        const allPassed = results.every((r) => r.passed);
        return resolve({ results, allPassed });
      }

      const tc = testCases[caseIndex];
      const inputJson = JSON.stringify(tc.input);
      const expectedJson = JSON.stringify(tc.expected);
      const timestamp = Date.now() + "_" + caseIndex;

      let filePath;
      let command;
      let args;

      try {
        if (language === "python" || language === "python3") {
          filePath = path.join(__dirname, `practice_temp_${timestamp}.py`);
          fs.writeFileSync(filePath, code);
          command = "python";
          args = ["-u", filePath];
        } else if (language === "javascript") {
          // For JavaScript, replace /dev/stdin read with direct input injection
          const jsCode = code.replace(
            /require\(['"]fs['"]\)\.readFileSync\(['"]\/dev\/stdin['"],\s*['"]utf8['"]\)/g,
            `(${JSON.stringify(inputJson)})`
          );
          filePath = path.join(__dirname, `practice_temp_${timestamp}.js`);
          fs.writeFileSync(filePath, jsCode);
          command = "node";
          args = [filePath];
        } else {
          results.push({
            caseNumber: caseIndex + 1,
            input: inputJson,
            expected: expectedJson,
            actual: "",
            passed: false,
            error: `Unsupported language: ${language}`,
          });
          caseIndex++;
          return runNextCase();
        }
      } catch (err) {
        results.push({
          caseNumber: caseIndex + 1,
          input: inputJson,
          expected: expectedJson,
          actual: "",
          passed: false,
          error: `Setup error: ${err.message}`,
        });
        caseIndex++;
        return runNextCase();
      }

      const child = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: timeoutMs,
      });

      let stdout = "";
      let stderr = "";
      let killed = false;
      const MAX_OUTPUT = 1024 * 1024; // 1MB

      const timer = setTimeout(() => {
        killed = true;
        try { child.kill("SIGKILL"); } catch (_) {}
      }, timeoutMs);

      child.stdout.on("data", (data) => {
        stdout += data.toString();
        if (stdout.length > MAX_OUTPUT) {
          killed = true;
          try { child.kill("SIGKILL"); } catch (_) {}
        }
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        if (stderr.length > MAX_OUTPUT) {
          killed = true;
          try { child.kill("SIGKILL"); } catch (_) {}
        }
      });

      // Send input via stdin for Python
      if (language === "python" || language === "python3") {
        try {
          child.stdin.write(inputJson);
          child.stdin.end();
        } catch (_) {}
      }

      child.on("close", (exitCode) => {
        clearTimeout(timer);
        // Cleanup temp file
        try { if (filePath) fs.unlinkSync(filePath); } catch (_) {}

        if (killed) {
          results.push({
            caseNumber: caseIndex + 1,
            input: inputJson,
            expected: expectedJson,
            actual: "",
            passed: false,
            error: "Time Limit Exceeded",
          });
        } else if (exitCode !== 0) {
          results.push({
            caseNumber: caseIndex + 1,
            input: inputJson,
            expected: expectedJson,
            actual: "",
            passed: false,
            error: stderr.trim().slice(0, 500) || "Runtime Error",
          });
        } else {
          const actualRaw = stdout.trim();
          // Compare parsed JSON values for robust matching
          let passed = false;
          try {
            const actualParsed = JSON.parse(actualRaw);
            const expectedParsed = JSON.parse(expectedJson);
            passed = JSON.stringify(actualParsed) === JSON.stringify(expectedParsed);
          } catch (_) {
            passed = actualRaw === expectedJson;
          }

          results.push({
            caseNumber: caseIndex + 1,
            input: inputJson,
            expected: expectedJson,
            actual: actualRaw,
            passed,
            error: null,
          });
        }

        caseIndex++;
        runNextCase();
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        try { if (filePath) fs.unlinkSync(filePath); } catch (_) {}
        results.push({
          caseNumber: caseIndex + 1,
          input: inputJson,
          expected: expectedJson,
          actual: "",
          passed: false,
          error: `Execution error: ${err.message}`,
        });
        caseIndex++;
        runNextCase();
      });
    }

    runNextCase();
  });
}

// ---- API: List all problems ----
app.get("/api/problems", async (req, res) => {
  try {
    const { difficulty, username } = req.query;

    let filtered = problems;
    if (difficulty && difficulty !== "All") {
      filtered = problems.filter(
        (p) => p.difficulty.toLowerCase() === difficulty.toLowerCase()
      );
    }

    // Build lightweight list (no test cases or full descriptions)
    const list = filtered.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      category: p.category,
    }));

    // If username provided, attach solved status
    if (username) {
      const solvedSet = new Set();

      if (practiceDbReady && UserProgress) {
        try {
          const progressDocs = await UserProgress.find(
            { username, solved: true },
            { problemId: 1 }
          ).lean();
          progressDocs.forEach((d) => solvedSet.add(d.problemId));
        } catch (_) {}
      } else {
        // In-memory fallback
        for (const [key, val] of inMemoryProgress) {
          if (key.startsWith(username + "::") && val.solved) {
            solvedSet.add(val.problemId);
          }
        }
      }

      list.forEach((p) => {
        p.solved = solvedSet.has(p.id);
      });
    }

    res.json({ problems: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- API: Get single problem details ----
app.get("/api/problems/:id", async (req, res) => {
  try {
    const problem = problems.find((p) => p.id === req.params.id);
    if (!problem) {
      return res.status(404).json({ error: "Problem not found" });
    }

    const { username } = req.query;

    // Build response (exclude hidden test cases)
    const response = {
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      category: problem.category,
      description: problem.description,
      constraints: problem.constraints,
      examples: problem.examples,
      visibleTestCases: problem.visibleTestCases,
      codeTemplates: problem.codeTemplates,
    };

    // If username provided, attach user's last saved code and progress
    if (username) {
      let progress = null;

      if (practiceDbReady && UserProgress) {
        try {
          progress = await UserProgress.findOne({
            username,
            problemId: problem.id,
          }).lean();
        } catch (_) {}
      } else {
        const key = `${username}::${problem.id}`;
        progress = inMemoryProgress.get(key) || null;
      }

      if (progress) {
        response.userProgress = {
          solved: progress.solved,
          lastLanguage: progress.lastLanguage,
          lastCode: progress.lastCode,
          attempts: progress.attempts,
          solvedAt: progress.solvedAt,
        };
      }
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- API: Run code against visible test cases only ----
app.post("/api/problems/:id/run", async (req, res) => {
  try {
    const problem = problems.find((p) => p.id === req.params.id);
    if (!problem) {
      return res.status(404).json({ error: "Problem not found" });
    }

    const { code, language } = req.body;
    if (!code || !language) {
      return res.status(400).json({ error: "code and language are required" });
    }

    if (!["python", "python3", "javascript"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language. Use python or javascript." });
    }

    const testCases = problem.visibleTestCases;
    const { results, allPassed } = await executePracticeCode(code, language, testCases);

    res.json({
      status: allPassed ? "All Passed" : "Some Failed",
      allPassed,
      testCases: results,
      totalPassed: results.filter((r) => r.passed).length,
      totalCases: results.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- API: Submit code against ALL test cases ----
app.post("/api/problems/:id/submit", async (req, res) => {
  try {
    const problem = problems.find((p) => p.id === req.params.id);
    if (!problem) {
      return res.status(404).json({ error: "Problem not found" });
    }

    const { code, language, username } = req.body;
    if (!code || !language) {
      return res.status(400).json({ error: "code and language are required" });
    }
    if (!username) {
      return res.status(400).json({ error: "username is required for submission" });
    }

    if (!["python", "python3", "javascript"].includes(language)) {
      return res.status(400).json({ error: "Unsupported language. Use python or javascript." });
    }

    // Run against ALL test cases (visible + hidden)
    const allTestCases = [...problem.visibleTestCases, ...problem.hiddenTestCases];
    const { results, allPassed } = await executePracticeCode(code, language, allTestCases);

    const passedCount = results.filter((r) => r.passed).length;
    const hasTimeLimitExceeded = results.some((r) => r.error === "Time Limit Exceeded");
    const hasRuntimeError = results.some(
      (r) => r.error && r.error !== "Time Limit Exceeded" && !r.passed
    );

    let resultStatus = "Wrong Answer";
    if (allPassed) resultStatus = "Accepted";
    else if (hasTimeLimitExceeded) resultStatus = "Time Limit Exceeded";
    else if (hasRuntimeError) resultStatus = "Runtime Error";

    // Only show visible test case details in response (hide hidden test case details)
    const visibleCount = problem.visibleTestCases.length;
    const visibleResults = results.slice(0, visibleCount);
    const hiddenResults = results.slice(visibleCount).map((r, idx) => ({
      caseNumber: visibleCount + idx + 1,
      passed: r.passed,
      error: r.error,
      hidden: true,
      // Don't expose input/expected for hidden cases
    }));

    // Save submission to database
    const submissionData = {
      username,
      problemId: problem.id,
      problemTitle: problem.title,
      language,
      code,
      result: resultStatus,
      passedCount,
      totalCount: allTestCases.length,
      testResults: [...visibleResults, ...hiddenResults],
      createdAt: new Date(),
    };

    if (practiceDbReady && PracticeSubmission) {
      try {
        await PracticeSubmission.create(submissionData);
      } catch (e) {
        console.warn("[practice] Failed to save submission:", e.message);
      }
    } else {
      inMemorySubmissions.push(submissionData);
    }

    // Update user progress
    if (practiceDbReady && UserProgress) {
      try {
        const update = {
          $set: {
            lastLanguage: language,
            lastCode: code,
          },
          $inc: { attempts: 1 },
        };
        if (allPassed) {
          update.$set.solved = true;
          update.$set.solvedAt = new Date();
        }
        await UserProgress.updateOne(
          { username, problemId: problem.id },
          update,
          { upsert: true }
        );
      } catch (e) {
        console.warn("[practice] Failed to update progress:", e.message);
      }
    } else {
      const key = `${username}::${problem.id}`;
      const prev = inMemoryProgress.get(key) || {
        username,
        problemId: problem.id,
        solved: false,
        lastLanguage: language,
        lastCode: code,
        attempts: 0,
        solvedAt: null,
      };
      prev.lastLanguage = language;
      prev.lastCode = code;
      prev.attempts += 1;
      if (allPassed) {
        prev.solved = true;
        prev.solvedAt = new Date();
      }
      inMemoryProgress.set(key, prev);
    }

    res.json({
      status: resultStatus,
      allPassed,
      passedCount,
      totalCount: allTestCases.length,
      visibleResults,
      hiddenResults,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- API: Get submission history ----
app.get("/api/submissions", async (req, res) => {
  try {
    const { username, problemId } = req.query;
    if (!username) {
      return res.status(400).json({ error: "username query parameter is required" });
    }

    let submissions = [];

    if (practiceDbReady && PracticeSubmission) {
      try {
        const query = { username };
        if (problemId) query.problemId = problemId;
        submissions = await PracticeSubmission.find(query)
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
      } catch (_) {}
    } else {
      submissions = inMemorySubmissions
        .filter((s) => s.username === username && (!problemId || s.problemId === problemId))
        .reverse()
        .slice(0, 50);
    }

    res.json({ submissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- API: Leaderboard ----
app.get("/api/leaderboard", async (req, res) => {
  try {
    let leaderboard = [];

    if (practiceDbReady && UserProgress) {
      try {
        const agg = await UserProgress.aggregate([
          { $match: { solved: true } },
          {
            $group: {
              _id: "$username",
              problemsSolved: { $sum: 1 },
              lastSolvedAt: { $max: "$solvedAt" },
            },
          },
          { $sort: { problemsSolved: -1, lastSolvedAt: 1 } },
          { $limit: 50 },
        ]);
        leaderboard = agg.map((entry, idx) => ({
          rank: idx + 1,
          username: entry._id,
          problemsSolved: entry.problemsSolved,
          lastSolvedAt: entry.lastSolvedAt,
        }));
      } catch (_) {}
    } else {
      // In-memory fallback
      const userMap = new Map();
      for (const [, val] of inMemoryProgress) {
        if (val.solved) {
          const prev = userMap.get(val.username) || { count: 0, lastSolved: null };
          prev.count += 1;
          if (!prev.lastSolved || (val.solvedAt && val.solvedAt > prev.lastSolved)) {
            prev.lastSolved = val.solvedAt;
          }
          userMap.set(val.username, prev);
        }
      }
      const sorted = [...userMap.entries()]
        .sort((a, b) => b[1].count - a[1].count || (a[1].lastSolved || 0) - (b[1].lastSolved || 0));
      leaderboard = sorted.map(([username, data], idx) => ({
        rank: idx + 1,
        username,
        problemsSolved: data.count,
        lastSolvedAt: data.lastSolved,
      }));
    }

    res.json({ leaderboard, totalProblems: problems.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= FRONTEND BUILD =================

// ⚠️ KEEP THIS AT BOTTOM
app.use(express.static("build"));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

// ================= YJS WEBSOCKET RUNNER =================
const WebSocket = require('ws');
let setupWSConnection;
try {
  setupWSConnection = require('y-websocket/bin/utils').setupWSConnection;
  const wss = new WebSocket.Server({ port: 5002 });
  wss.on('connection', setupWSConnection);
  console.log(`Yjs WebSocket server running on port 5002`);
} catch (e) {
  console.warn("Could not start y-websocket server (run npm install y-websocket ws)", e.message);
}

// ================= START =================

const PORT = 5001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});