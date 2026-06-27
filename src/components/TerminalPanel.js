import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import ACTIONS from "../actions/Actions";

/**
 * VS Code–style integrated terminal: shell runs on the server (node-pty) and streams via Socket.IO.
 */
const TerminalPanel = ({ socketRef, isOpen, roomId, workspaceLabel, hasWorkspace }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const el = containerRef.current;
    const socket = socketRef.current;
    if (!el || !socket) return undefined;

    let disposed = false;
    let term = null;
    let fitAddon = null;
    let resizeObserver = null;

    const decodeTerminalData = (data) => {
      if (data === undefined || data === null) return "";
      if (typeof data === "string") return data;
      if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(data)) {
        return data.toString("utf8");
      }
      if (data && data.type === "Buffer" && Array.isArray(data.data)) {
        try {
          return new TextDecoder("utf-8", { fatal: false }).decode(
            new Uint8Array(data.data)
          );
        } catch (e) {
          return String.fromCharCode.apply(null, data.data);
        }
      }
      return String(data);
    };

    const onOutput = ({ data }) => {
      if (!disposed && term) {
        term.write(decodeTerminalData(data));
      }
    };

    const onExit = ({ code, signal }) => {
      if (!disposed && term) {
        term.write(
          `\r\n\x1b[33m[Process exited with code ${code ?? "?"}${signal ? ` (${signal})` : ""}]\x1b[0m\r\n`
        );
      }
    };

    const onError = ({ message }) => {
      if (!disposed && term) {
        term.write(`\r\n\x1b[31m${message || "Terminal error"}\x1b[0m\r\n`);
      }
    };

    const tearDown = () => {
      disposed = true;
      window.removeEventListener("resize", fitAndResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      socket.off(ACTIONS.TERMINAL_OUTPUT, onOutput);
      socket.off(ACTIONS.TERMINAL_EXIT, onExit);
      socket.off(ACTIONS.TERMINAL_ERROR, onError);
      socket.emit(ACTIONS.TERMINAL_KILL);
      if (term) {
        try {
          term.dispose();
        } catch (e) {
          /* ignore */
        }
        term = null;
      }
      fitAddon = null;
    };

    const fitAndResize = () => {
      if (disposed || !term || !fitAddon || !el) return;
      try {
        fitAddon.fit();
        socket.emit(ACTIONS.TERMINAL_RESIZE, {
          cols: term.cols,
          rows: term.rows,
        });
      } catch (e) {
        /* ignore */
      }
    };

    let started = false;

    const start = () => {
      if (disposed || !el || started) return;
      started = true;

      term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
        theme: {
          background: "#0c0c0c",
          foreground: "#cccccc",
          cursor: "#aeafad",
        },
        scrollback: 5000,
      });
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(el);
      fitAddon.fit();

      term.onData((data) => {
        socket.emit(ACTIONS.TERMINAL_INPUT, { data });
      });

      socket.on(ACTIONS.TERMINAL_OUTPUT, onOutput);
      socket.on(ACTIONS.TERMINAL_EXIT, onExit);
      socket.on(ACTIONS.TERMINAL_ERROR, onError);

      const emitStart = () => {
        try {
          fitAddon.fit();
        } catch (e) {
          /* ignore */
        }
        const c = Math.max(term.cols || 80, 40);
        const r = Math.max(term.rows || 24, 12);
        
        socket.emit(ACTIONS.TERMINAL_START, { 
          cols: c, 
          rows: r,
          cwd: hasWorkspace ? `temp_workspaces/${roomId}/${workspaceLabel}` : undefined,
          promptName: hasWorkspace ? workspaceLabel : "SyncCode"
        });
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          emitStart();
          fitAndResize();
        });
      });

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => fitAndResize());
        resizeObserver.observe(el);
      }
      window.addEventListener("resize", fitAndResize);
    };

    const onSocketConnect = () => {
      if (!disposed) start();
    };

    if (socket.connected) {
      onSocketConnect();
    } else {
      socket.on("connect", onSocketConnect);
    }

    const fullTearDown = () => {
      socket.off("connect", onSocketConnect);
      tearDown();
    };

    return fullTearDown;
  }, [isOpen, socketRef]);

  return (
    <div
      ref={containerRef}
      className="terminalXtermHost"
      style={{ width: "100%", height: "100%", minHeight: 0 }}
      aria-label="Integrated terminal"
    />
  );
};

export default TerminalPanel;
