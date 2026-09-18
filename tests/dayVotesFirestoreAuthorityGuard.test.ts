import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('day votes Firestore authority guard', () => {
  it('does not expose a client game.dayVotes write path', () => {
    expect(rules).not.toContain("affectedAre(['dayVotes'])");
    expect(rules).not.toMatch(/affectedKeys\(\)\.hasOnly\(\[['"]dayVotes['"]\]\]/);
  });

  it('keeps authoritative vote documents server-write-only', () => {
    expect(rules).toMatch(
      /match \/games\/\{gameId\}\/votes\/\{voterUid\} \{[\s\S]*?allow create, update, delete: if false;/,
    );
  });

  it('does not grant a client update branch access to dayVotes', () => {
    const gameMatch = rules.match(
      /match \/games\/\{gameId\} \{([\s\S]*?)\n    \}\n    match \/games\/\{gameId\}\/playerRoles/,
    );
    expect(gameMatch).not.toBeNull();
    expect(gameMatch?.[1]).not.toContain('dayVotes');
  });
});
