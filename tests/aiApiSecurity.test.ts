import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('AI API authentication regression guards', () => {
  it('requires Firebase authentication on Gemini-backed routes', () => {
    for (const path of ['app/api/ai-chat/route.ts', 'app/api/wolf-agree/route.ts', 'app/api/narrator/route.ts']) {
      const source = read(path);
      expect(source).toContain("import { verifyAuthToken } from '@/lib/firebase/verifyAuth'");
      expect(source).toContain('const uid = await verifyAuthToken(req);');
      expect(source).toContain("return NextResponse.json({ error: 'No autorizado' }, { status: 401 });");
    }
  });

  it('does not expose the AI API token requirement only through the client', () => {
    const provider = read('app/providers/AuthProvider.tsx');
    expect(provider).toContain("'/api/wolf-agree'");
    expect(provider).toContain("'/api/narrator'");
    expect(provider).toContain('getIdToken()');
    expect(provider).toContain('Authorization');
  });

  it('authorizes wolf-agree from private playerRoles, never public wolfTeam', () => {
    const source = read('app/api/wolf-agree/route.ts');
    expect(source).toContain("collection('playerRoles').doc(uid)");
    expect(source).toContain("collection('playerRoles').doc(bot.uid)");
    expect(source).not.toContain('game.wolfTeam');
    expect(source).toContain('const canonicalAlivePlayers');
    expect(source).toContain('caller.name');
    expect(source).toContain("caller.isAI === true");
    expect(source).toContain('player.isAI !== true');
  });

  it('keeps the authoritative wolf target private on the server', () => {
    const source = read('app/api/wolf-agree/route.ts');
    expect(source).toContain("payload: { wolfTarget: targetUid }");
    expect(source).toContain("source: 'server-wolf-chat'");
    expect(source).toContain('// Deliberately do not return targetUid');
    expect(source).toContain('return NextResponse.json({ messages, submitted, resolved });');
    expect(source).not.toContain('return NextResponse.json({ messages, targetUid, submitted, resolved });');
  });
});
