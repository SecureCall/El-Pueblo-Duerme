import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
const hook = readFileSync(resolve(process.cwd(), 'hooks/useVoiceChat.ts'), 'utf8');

describe('voice signaling authority guards', () => {
  it('binds presence to the authenticated player and an authorized channel', () => {
    expect(rules).toContain("match /games/{gameId}/voicePresence/{uid}");
    expect(rules).toContain("request.auth.uid == uid");
    expect(rules).toContain("request.resource.data.keys().hasOnly(['uid','name','channel','joinedAt'])");
    expect(rules).toContain("resource.data.channel == 'main'");
    expect(rules).toContain("resource.data.channel == 'wolves'");
    expect(rules).toContain("resource.data.channel == 'ghost'");
    expect(rules).toContain("p.isAlive == true");
    expect(rules).toContain("p.isAlive == false");
  });

  it('binds offers and answers to explicit from/to identities and pair document IDs', () => {
    expect(rules).toContain("offerId == request.auth.uid + '_' + request.resource.data.to");
    expect(rules).toContain("answerId == request.auth.uid + '_' + request.resource.data.to");
    expect(rules).toContain("request.resource.data.from == request.auth.uid");
    expect(rules).toContain("request.resource.data.to is string");
    expect(rules).toContain("request.resource.data.to != request.auth.uid");
    expect(rules).toContain("request.resource.data.sdp.size() <= 20000");
  });

  it('binds ICE candidates to the sender, recipient and pair', () => {
    expect(rules).toContain("pairId == request.auth.uid + '_' + request.resource.data.to");
    expect(rules).toContain("request.resource.data.from == request.auth.uid");
    expect(rules).toContain("request.resource.data.candidate.size() <= 4096");
    expect(rules).toContain("allow update, delete: if false;");
  });

  it('uses Firestore queries compatible with recipient/channel-scoped reads', () => {
    expect(hook).toContain("query(collection(db, 'games', gameId, 'voicePresence'), where('channel', '==', channelRef.current))");
    expect(hook).toContain("query(collection(db, 'games', gameId, 'voiceOffers'), where('to', '==', userId), where('channel', '==', channelRef.current))");
    expect(hook).not.toContain("onSnapshot(\n      collection(db, 'games', gameId, 'voiceOffers')");
  });
});
