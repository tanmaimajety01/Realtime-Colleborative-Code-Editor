const ACTIONS = {
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    LEAVE: 'leave',
    /** Room chat */
    CHAT_MESSAGE: 'chat-message',
    CHAT_HISTORY: 'chat-history',
    CHAT_TYPING: 'chat-typing',
    CHAT_STOP_TYPING: 'chat-stop-typing',
    CHAT_REACTION: 'chat-reaction',
    CHAT_PIN: 'chat-pin',
    /** Interactive code execution (streaming + stdin) */
    RUN_START: 'run-start',
    RUN_STDIN: 'run-stdin',
    RUN_STDOUT: 'run-stdout',
    RUN_STDERR: 'run-stderr',
    RUN_DONE: 'run-done',
    RUN_FAILED: 'run-failed',
    /** Integrated shell (node-pty + xterm) */
    TERMINAL_START: 'terminal-start',
    TERMINAL_INPUT: 'terminal-input',
    TERMINAL_OUTPUT: 'terminal-output',
    TERMINAL_RESIZE: 'terminal-resize',
    TERMINAL_EXIT: 'terminal-exit',
    TERMINAL_ERROR: 'terminal-error',
    TERMINAL_KILL: 'terminal-kill',
};

module.exports = ACTIONS;