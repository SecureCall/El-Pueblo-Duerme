import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'components/game/GameRoom.tsx'), 'utf8');

describe('GameRoom authority guard', () => {
  it('routes lobby mutations through server helpers', () => {
    expect(source).toContain('requestLobbyJoin');
    expect(source).toContain('requestLobbyLeave');
    expect(source).toContain('requestLobbyKick');
    expect(source).toContain('requestLobbyPresence');
    expect(source).toContain('requestLobbyFillBots');
    expect(source).toContain('requestGameStart');
  });
  it('does not directly mutate the game document for lobby authority', () => {
    expect(source).not.toMatch(/updateDoc\(doc\(db,\s*['"]games['"]/);
    expect(source).not.toMatch(/setDoc\(doc\(db,\s*['"]games['"]/);
    expect(source).not.toMatch(/deleteDoc\(doc\(db,\s*['"]games['"]/);
    expect(source).not.toMatch(/arrayUnion/);
    expect(source).not.toMatch(/arrayRemove/);
  });
  it('does not generate AI players in the browser', () => {
    expect(source).not.toMatch(/generateAIPlayers/);
    expect(source).not.toMatch(/BOT_NAMES/);
    expect(source).not.toMatch(/assignBotType/);
  });
});
