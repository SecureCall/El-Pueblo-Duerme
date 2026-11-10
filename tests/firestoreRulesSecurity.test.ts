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

  it('authorizes secret role chats from private playerRoles snapshots', () => {
    expect(rules).toContain("function privateRole(gameId, uid)");
    expect(rules).toContain("privateRole(gameId, request.auth.uid) in ['Gemela', 'Gemelas']");
    expect(rules).toContain("privateRole(gameId, request.auth.uid) == 'Hada Buscadora'");
    expect(rules).toContain("privateRole(gameId, request.auth.uid) == 'Médium'");
    expect(rules).not.toContain("data.roles[request.auth.uid] == 'Gemela'");
    expect(rules).not.toContain("data.roles[request.auth.uid] == 'Hada Buscadora'");
    expect(rules).not.toContain("data.roles[request.auth.uid] == 'Médium'");
  });

  it('authorizes wolf chat from the canonical private role snapshot', () => {
    expect(rules).toContain("privateRole(gameId, request.auth.uid) in ['Lobo', 'Lobo Blanco', 'Cría de Lobo', 'Bruja']");
    expect(rules).toContain("privateRole(gameId, request.auth.uid) == 'Espía'");
    expect(rules).not.toContain(".data.wolfTeam[request.auth.uid] == true");
  });

  it('forbids client mutation of public secret role fields and player role snapshots', () => {
    expect(rules).toContain("request.resource.data.roles == resource.data.roles && request.resource.data.wolfTeam == resource.data.wolfTeam");
    expect(rules).toContain("allow create, update, delete: if false;");
  });

  it('forbids the legacy unrestricted participant update after a game has ended', () => {
    expect(rules).not.toContain("(resource.data.phase == 'ended' && resource.data.players.exists(p, p.uid == request.auth.uid))");
  });

  it('prevents cross-game access to chat and voice signaling', () => {
    expect(rules).toContain("allow read: if isAuth() && (isHost(gameId) || get(/databases/$(database)/documents/games/$(gameId)).data.players.exists(p, p.uid == request.auth.uid));");
    expect(rules).not.toContain("match /games/{gameId}/publicChat/{messageId} { allow read: if isAuth();");
    expect(rules).not.toContain("match /games/{gameId}/voiceOffers/{offerId} { allow read, create, delete: if isAuth();");
    expect(rules).not.toContain("match /games/{gameId}/voiceAnswers/{offerId} { allow read, create, delete: if isAuth();");
    expect(rules).not.toContain("match /games/{gameId}/voiceIce/{pairId}/candidates/{candidateId} { allow read, create: if isAuth();");
  });

  it('routes friendship mutations through the authenticated server API and blocks direct friend-list edits', () => {
    expect(rules).toContain("!affectedAre(['friends'])");
  });

  it('limits friend-request writes to adding the caller or removing requests from own profile', () => {
    expect(rules).toContain("request.resource.data.friendRequests.size() == resource.data.friendRequests.size() + 1");
    expect(rules).toContain("request.resource.data.friendRequests.hasAny([request.auth.uid])");
    expect(rules).toContain("resource.data.friendRequests.hasAll(request.resource.data.friendRequests)");
    expect(rules).not.toContain("|| onlyUpdating(['friendRequests'])");
  });

  it('prevents profile creation from granting arbitrary coins or progression', () => {
    expect(rules).toContain("request.resource.data.keys().hasOnly(['uid', 'displayName', 'email', 'photoURL', 'coins', 'createdAt', 'friends', 'friendRequests', 'xp', 'gamesPlayed', 'gamesWon', 'consecutiveWins'])");
    expect(rules).toContain("request.resource.data.coins == 100");
    expect(rules).toContain("request.resource.data.xp == 0");
    expect(rules).toContain("request.resource.data.gamesWon == 0");
    expect(rules).toContain("request.resource.data.consecutiveWins == 0");
    expect(rules).not.toContain("allow create: if isAuth() && request.auth.uid == userId;");
  });

  it('restricts game invites to the authenticated sender in a game they joined', () => {
    expect(rules).toContain("request.resource.data.hostUid == request.auth.uid");
    expect(rules).toContain("request.resource.data.keys().hasOnly(['gameId', 'gameCode', 'gameName', 'hostUid', 'hostName', 'sentAt'])");
    expect(rules).toContain("get(/databases/$(database)/documents/games/$(request.resource.data.gameId)).data.players.exists(p, p.uid == request.auth.uid)");
    expect(rules).not.toContain("match /gameInvites/{userId}/items/{inviteId} { allow read, delete: if isAuth() && request.auth.uid == userId; allow create: if isAuth();");
  });

  it('keeps ghost writes restricted to dead players/host', () => {
    expect(rules).toContain("p.uid == request.auth.uid && p.isAlive == false");
  });
});