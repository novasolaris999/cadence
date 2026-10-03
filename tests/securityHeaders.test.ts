// Runs in Node (outside src/, like supabase/migrations.test.ts): reads vercel.json and index.html.
// The Content Security Policy in vercel.json allows exactly one inline script: the theme script in
// index.html, pinned by its SHA-256 hash. If that script changes, the hash must change too, or the
// browser would block it in production (the page would flash the wrong theme). This test keeps them in step.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as {
  headers: { headers: { key: string; value: string }[] }[];
};
const header = (key: string) => vercel.headers[0]!.headers.find((h) => h.key === key)?.value ?? '';

describe('security headers', () => {
  it('allows every inline script in index.html by its hash, and nothing else inline', () => {
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    expect(inline.length).toBeGreaterThan(0);
    const csp = header('Content-Security-Policy');
    for (const body of inline) {
      const hash = createHash('sha256').update(body).digest('base64');
      expect(csp).toContain(`'sha256-${hash}'`);
    }
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it('only lets the app talk to itself and Supabase, and never be framed', () => {
    const csp = header('Content-Security-Policy');
    expect(csp).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('X-Content-Type-Options')).toBe('nosniff');
  });
});
