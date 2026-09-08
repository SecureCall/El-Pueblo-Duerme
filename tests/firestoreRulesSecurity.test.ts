import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('Firestore security rules — regression guards', () => {
  it('does not expose vote or night-log documents to every authenticated user', () => {
    expect(rules).toContain("match /games/{gameId}/votes/{voterUid} { allow read: if isAuth() && isHost(gameId);");
    expect(rules).toContain("match /games/{gameId}/nightLogs/{round} { allow read: if isAuth() && isHost(gameId);");
    expect(rules).not.toContain("match /games/{gameId}/votes/{voterUid} { allow read: if isAuth();");
    expect(rules).not.toContain("match /games/{gameId}/nightLogs/{round} { allow read: if isAuth();");
  });

  it('restricts private twin chat to the twin roles', () => {
    expect(rules).toContain("get(/databases/$(database)/documents/games/$(gameId)).data.roles[request.auth.uid] == 'Gemela'");
    expect(rules).toContain("get(/databases/$(database)/documents/games/$(gameId)).data.roles[request.auth.uid] == 'Gemelas'");
  });

  it('restricts fairy chat to the linked Hada Buscadora', () => {
    expect(rules).toContain("get(/databases/$(database)/documents/games/$(gameId)).data.roles[request.auth.uid] == 'Hada Buscadora'");
    expect(rules).toContain("get(/databases/$(database)/documents/games/$(gameId)).data.hadaLinked == true");
  });

  it('prevents cross-game access to chat and voice signaling', () => {
    expect(rules).toContain("allow read: if isAuth() && (isHost(gameId) || get(/databases/$(database)/documents/games/$(gameId)).data.players.exists(p, p.uid == request.auth.uid));");
    expect(rules).not.toContain("match /games/{gameId}/publicChat/{messageId} { allow read: if isAuth();");
    expect(rules).not.toContain("match /games/{gameId}/voiceOffers/{offerId} { allow read, create, delete: if isAuth();");
    expect(rules).not.toContain("match /games/{gameId}/voiceAnswers/{answerId} { allow read, create, delete: if isAuth();");
    expect(rules).not.toContain("match /games/{gameId}/voiceIce/{pairId}/candidates/{candidateId} { allow read, create: if isAuth();");
  });

  it('allows the Médium to read ghost chat while keeping writes restricted to dead players/host', () => {
    expect(rules).toContain("data.roles[request.auth.uid] == 'Médium'");
    expect(rules).toContain("p.uid == request.auth.uid && p.isAlive == false");
  });
});
