import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');

describe('GamePlay authority guard', () => {
  it('does not assign roles or write playerRoles directly from the client', () => {
    expect(source).not.toMatch(/assignRoles\(game\.players/);
    expect(source).not.toMatch(/setDoc\(doc\(db,\s*['"]games['"][\s\S]{0,300}playerRoles/);
    expect(source).not.toMatch(/updateDoc\(doc\(db,\s*['"]games['"][\s\S]{0,300}roles:\s*assigned/);
  });

  it('does not directly transition roleReveal to night in the client', () => {
    expect(source).not.toMatch(/updateDoc\(doc\(db,\s*['"]games['"][\s\S]{0,500}phase:\s*['"]night['"]/);
  });

  it('does not directly write legacy night state anywhere in GamePlay', () => {
    expect(source).not.toMatch(/(?:updateDoc|setDoc|writeBatch|batch\.update|batch\.set)[\s\S]{0,500}nightActions\./);
    expect(source).not.toMatch(/(?:updateDoc|setDoc|writeBatch|batch\.update|batch\.set)[\s\S]{0,500}nightSubmissions\./);
  });

  it('does not contain the browser AI night auto-writer', () => {
    expect(source).not.toMatch(/aiNightSubmittedRound/);
    expect(source).not.toMatch(/AI wolves reply and auto-confirm kill target/);
    expect(source).not.toMatch(/ensureServerAINightSubmissions/);
  });

  it('does not resolve the night from a client-side all-submitted effect', () => {
    expect(source).not.toMatch(/Host processes night when all required submissions received/);
    expect(source).not.toMatch(/requestResolveNight\(gameId\)/);
  });

  it('does not contain the legacy client-side day resolver', () => {
    expect(source).not.toMatch(/async function processDayVotes/);
    expect(source).not.toMatch(/Host processes day votes when all eligible alive players have voted/);
    expect(source).not.toMatch(/action:\s*['"]commit['"][\s\S]{0,500}patch:\s*dayPatch/);
  });
});
