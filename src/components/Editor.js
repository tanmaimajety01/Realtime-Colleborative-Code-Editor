import React, {
  useEffect,
  useRef,
  useImperativeHandle,
} from "react";
import { language, cmtheme } from "../atoms";
import { useRecoilValue } from "recoil";
import ACTIONS from "../actions/Actions";

// CODE MIRROR
import Codemirror from "codemirror";
import "codemirror/lib/codemirror.css";

// themes
import "codemirror/theme/material.css";
import "codemirror/theme/dracula.css";
import "codemirror/theme/monokai.css";
import "codemirror/theme/nord.css";

// modes
import "codemirror/mode/clike/clike";
import "codemirror/mode/css/css";
import "codemirror/mode/htmlmixed/htmlmixed";
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/python/python";

// addons
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";

// YJS
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { CodemirrorBinding } from "y-codemirror";
import randomColor from "randomcolor";

const Editor = React.forwardRef(
  ({ socketRef, roomId, username, onCodeChange }, ref) => {
    const editorRef = useRef(null);
    const ydocRef = useRef(null);
    const providerRef = useRef(null);
    const bindingRef = useRef(null);

    const userColor = useRef(randomColor({ luminosity: 'dark' }));

    const lang = useRecoilValue(language);
    const editorTheme = useRecoilValue(cmtheme);

    // ✅ expose method to parent safely
    useImperativeHandle(ref, () => ({
      setCode: (code) => {
        if (
          editorRef.current &&
          code !== editorRef.current.getValue()
        ) {
          // When switching files, this will replace the Y.Text content
          editorRef.current.setValue(code);
        }
      },
      getCode: () => editorRef.current?.getValue() ?? "",
      getSelection: () => {
        try {
          return editorRef.current?.getSelection?.() ?? "";
        } catch {
          return "";
        }
      },
    }));

    // ✅ INIT EDITOR & YJS ONLY ONCE
    useEffect(() => {
      if (editorRef.current) return; // 🔥 prevents double init (React StrictMode fix)

      const editorMode = lang === "c" || lang === "cpp" || lang === "java" ? "clike" : lang;

      editorRef.current = Codemirror.fromTextArea(
        document.getElementById("realtimeEditor"),
        {
          mode: editorMode,
          theme: editorTheme,
          lineNumbers: true,
          autoCloseTags: true,
          autoCloseBrackets: true,
        }
      );

      // We don't setValue("") here because Yjs will sync the initial state
      // editorRef.current.setValue("");

      // Initialize Yjs Document
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      // Connect to the Yjs Websocket server we started on port 5002
      // Using window.location.hostname to adapt if running externally
      const wsUrl = `ws://${window.location.hostname}:5002`;
      const provider = new WebsocketProvider(wsUrl, roomId, ydoc);
      providerRef.current = provider;

      // Setup awareness (cursor and username)
      provider.awareness.setLocalStateField('user', {
        name: username || 'Guest',
        color: userColor.current
      });

      // Bind the Yjs 'codemirror' text to the CodeMirror instance
      const ytext = ydoc.getText("codemirror");
      const binding = new CodemirrorBinding(ytext, editorRef.current, provider.awareness);
      bindingRef.current = binding;

      // Let EditorPage know whenever code changes (so it can save to workspaceFiles)
      editorRef.current.on("change", (instance) => {
        const code = instance.getValue();
        onCodeChange(code);
      });

      // 🧹 CLEANUP
      return () => {
        if (bindingRef.current) {
          bindingRef.current.destroy();
          bindingRef.current = null;
        }
        if (providerRef.current) {
          providerRef.current.disconnect();
          providerRef.current = null;
        }
        if (ydocRef.current) {
          ydocRef.current.destroy();
          ydocRef.current = null;
        }
        if (editorRef.current) {
          editorRef.current.toTextArea();
          editorRef.current = null;
        }
      };
    }, []);

    // ✅ UPDATE LANGUAGE (no re-render)
    useEffect(() => {
      if (editorRef.current) {
        const editorMode =
          lang === "c" || lang === "cpp" || lang === "java" ? "clike" : lang;
        editorRef.current.setOption("mode", editorMode);
      }
    }, [lang]);

    // ✅ UPDATE THEME
    useEffect(() => {
      if (editorRef.current) {
        editorRef.current.setOption("theme", editorTheme);
      }
    }, [editorTheme]);

    return <textarea id="realtimeEditor"></textarea>;
  }
);

export default Editor;