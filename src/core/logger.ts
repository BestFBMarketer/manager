// =====================================
// MODULE: Logger
// Purpose: Seviyeli, zaman damgali konsol logu (Rule 11)
// Dependencies: yok
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

type Level = 'info' | 'success' | 'warn' | 'error' | 'debug';

const PREFIX: Record<Level, string> = {
  info: 'i',
  success: '+',
  warn: '!',
  error: 'x',
  debug: '.',
};

function emit(level: Level, message: string, detail?: unknown): void {
  const line = `[${new Date().toISOString()}] ${PREFIX[level]} ${message}`;
  const stream = level === 'error' || level === 'warn' ? console.error : console.log;
  if (detail === undefined) {
    stream(line);
  } else {
    stream(line, detail);
  }
}

export const Logger = {
  info: (m: string, d?: unknown) => emit('info', m, d),
  success: (m: string, d?: unknown) => emit('success', m, d),
  warn: (m: string, d?: unknown) => emit('warn', m, d),
  error: (m: string, d?: unknown) => emit('error', m, d),
  debug: (m: string, d?: unknown) => {
    if (process.env.DEBUG) emit('debug', m, d);
  },
};
