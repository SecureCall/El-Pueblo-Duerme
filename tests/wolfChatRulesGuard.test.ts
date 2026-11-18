import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
const nightPhase = readFileSync(resolve(process.cwd(), 'components/game/play/NightPhase.tsx'), 'utf8');

describe('wolf chat authorization', () => {
  it('allows the explicitly wolf-aligned Bruja to read and send wolf chat', () => {
    const wolfChatRule = rules.match(/match \/games\/\{gameId\}\/wolfChat\/\{messageId\}[\s\S]*?allow update, delete: if false;/)?.[0] ?? '';
    expect(wolfChatRule).toContain("'Bruja'");
    expect(wolfChatRule.match(/'Bruja'/g)).toHaveLength(2);
    expect(nightPhase).toContain("const isLoboBruja = effectiveRole === 'Bruja'");
    expect(nightPhase).toContain('const canSeeWolfChat = isWolfTeam || isLoboBruja');
  });

  it('does not grant wolf chat access to ordinary villagers', () => {
    const wolfChatRule = rules.match(/match \/games\/\{gameId\}\/wolfChat\/\{messageId\}[\s\S]*?allow update, delete: if false;/)?.[0] ?? '';
    expect(wolfChatRule).not.toContain('players.exists(p, p.uid == request.auth.uid)');
    expect(wolfChatRule).toContain('privateRole(gameId, request.auth.uid)');
  });
});
