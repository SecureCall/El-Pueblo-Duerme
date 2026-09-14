import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');

describe('GamePlay special-action authority guard', () => {
  it('does not resolve Cazador shots by directly mutating the game document', () => {
    expect(source).not.toMatch(/applyCazadorShot/);
    expect(source).not.toMatch(/cazadorPendingShot:\s*null/);
  });

  it('does not resolve Chivo choices by directly mutating the game document', () => {
    expect(source).not.toMatch(/applyChivoChoice/);
    expect(source).not.toMatch(/chivoPendingChoice:\s*null/);
  });

  it('does not directly mutate authoritative day timing for Juez second vote', () => {
    expect(source).not.toMatch(/juezCallSecondVote/);
    expect(source).not.toMatch(/juezUsed:\s*true[\s\S]{0,250}dayStartedAt:/);
  });

  it('does not send Fantasma messages by directly writing anonymous chat or consuming its pending state', () => {
    expect(source).not.toMatch(/sendGhostMessage/);
    expect(source).not.toMatch(/fantasmaPending:\s*newPending/);
    expect(source).not.toMatch(/senderId:\s*['\"]ghost['\"]/);
    expect(source).not.toMatch(/text:\s*['\"]👻 Mensaje Anónimo['\"]/);
  });
});
