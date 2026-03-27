'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  UserProfile, PresenceData, GameInvite,
  subscribeToMyProfile, subscribeToPresence,
  searchUserByName, sendFriendRequest, acceptFriendRequest,
  rejectFriendRequest, removeFriend, sendGameInvite,
} from '@/lib/firebase/friends';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Users, UserPlus, Search, Check, X, Send, Wifi, WifiOff, Loader2, UserMinus } from 'lucide-react';

interface FriendsPanelProps {
  gameId?: string;
  gameCode?: string;
  gameName?: string;
  compact?: boolean;
}

export function FriendsPanel({ gameId, gameCode, gameName, compact = false }: FriendsPanelProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'friends' | 'add' | 'requests'>('friends');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [presence, setPresence] = useState<Record<string, PresenceData>>({});
  const [friendProfiles, setFriendProfiles] = useState<Record<string, UserProfile>>({});
  const [requestProfiles, setRequestProfiles] = useState<Record<string, UserProfile>>({});
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedUids, setInvitedUids] = useState<Set<string>>(new Set());
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    return subscribeToMyProfile(user.uid, setProfile);
  }, [user]);

  useEffect(() => {
    if (!profile) return;
    const allUids = [...(profile.friends ?? []), ...(profile.friendRequests ?? [])];
    if (allUids.length === 0) return;

    const fetchProfiles = async () => {
      const map: Record<string, UserProfile> = {};
      await Promise.all(allUids.map(async uid => {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) map[uid] = snap.data() as UserProfile;
      }));
      const friendMap: Record<string, UserProfile> = {};
      const reqMap: Record<string, UserProfile> = {};
      (profile.friends ?? []).forEach(uid => { if (map[uid]) friendMap[uid] = map[uid]; });
      (profile.friendRequests ?? []).forEach(uid => { if (map[uid]) reqMap[uid] = map[uid]; });
      setFriendProfiles(friendMap);
      setRequestProfiles(reqMap);
    };
    fetchProfiles();
  }, [profile]);

  useEffect(() => {
    if (!profile || !profile.friends?.length) return;
    return subscribeToPresence(profile.friends, setPresence);
  }, [profile?.friends?.join(',')]);

  const handleSearch = useCallback(async () => {
    if (!searchQ.trim() || !user) return;
    setSearching(true);
    const results = await searchUserByName(searchQ.trim());
    setSearchResults(results.filter(r => r.uid !== user.uid));
    setSearching(false);
  }, [searchQ, user]);

  const handleAddFriend = async (toUid: string) => {
    if (!user) return;
    await sendFriendRequest(user.uid, toUid);
    setSentRequests(s => new Set([...s, toUid]));
  };

  const handleAccept = async (fromUid: string) => {
    if (!user) return;
    await acceptFriendRequest(user.uid, fromUid);
  };

  const handleReject = async (fromUid: string) => {
    if (!user) return;
    await rejectFriendRequest(user.uid, fromUid);
  };

  const handleRemove = async (friendUid: string) => {
    if (!user) return;
    await removeFriend(user.uid, friendUid);
  };

  const handleInvite = async (friendUid: string) => {
    if (!user || !gameId || !gameCode) return;
    await sendGameInvite(friendUid, gameId, gameCode, gameName ?? 'Partida', user.uid, user.displayName ?? 'Jugador');
    setInvitedUids(s => new Set([...s, friendUid]));
  };

  const friends = profile?.friends ?? [];
  const requests = profile?.friendRequests ?? [];
  const onlineFriends = friends.filter(uid => presence[uid]?.online);
  const offlineFriends = friends.filter(uid => !presence[uid]?.online);

  if (!user) return null;

  return (
    <div className={`bg-black/50 border border-white/10 rounded-xl flex flex-col ${compact ? 'text-sm' : ''}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-white/50" />
          <span className="font-medium text-white/80 text-sm">Amigos</span>
          {requests.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{requests.length}</span>
          )}
        </div>
        <div className="flex gap-1">
          <TabBtn active={tab === 'friends'} onClick={() => setTab('friends')}>
            <Users className="h-3.5 w-3.5" />
          </TabBtn>
          <TabBtn active={tab === 'requests'} onClick={() => setTab('requests')}>
            <div className="relative">
              <UserPlus className="h-3.5 w-3.5" />
              {requests.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-[8px] font-bold px-1 rounded-full">{requests.length}</span>}
            </div>
          </TabBtn>
          <TabBtn active={tab === 'add'} onClick={() => setTab('add')}>
            <Search className="h-3.5 w-3.5" />
          </TabBtn>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1 max-h-64">
        {tab === 'friends' && (
          <>
            {friends.length === 0 && (
              <p className="text-white/30 text-xs text-center py-4">No tienes amigos aún.<br />¡Búscalos con la lupa!</p>
            )}
            {onlineFriends.length > 0 && (
              <p className="text-[10px] text-green-400/70 uppercase tracking-widest mb-1">Conectados ({onlineFriends.length})</p>
            )}
            {onlineFriends.map(uid => (
              <FriendRow
                key={uid}
                uid={uid}
                profile={friendProfiles[uid]}
                presenceData={presence[uid]}
                online
                gameId={gameId}
                invited={invitedUids.has(uid)}
                onInvite={() => handleInvite(uid)}
                onRemove={() => handleRemove(uid)}
              />
            ))}
            {offlineFriends.length > 0 && (
              <p className="text-[10px] text-white/30 uppercase tracking-widest mt-2 mb-1">Desconectados</p>
            )}
            {offlineFriends.map(uid => (
              <FriendRow
                key={uid}
                uid={uid}
                profile={friendProfiles[uid]}
                presenceData={presence[uid]}
                online={false}
                gameId={gameId}
                invited={invitedUids.has(uid)}
                onInvite={() => handleInvite(uid)}
                onRemove={() => handleRemove(uid)}
              />
            ))}
          </>
        )}

        {tab === 'requests' && (
          <>
            {requests.length === 0 && (
              <p className="text-white/30 text-xs text-center py-4">No tienes solicitudes pendientes</p>
            )}
            {requests.map(uid => (
              <div key={uid} className="flex items-center gap-2 py-1.5">
                <Avatar name={requestProfiles[uid]?.displayName ?? '?'} photoURL={requestProfiles[uid]?.photoURL} />
                <span className="flex-1 text-xs text-white truncate">{requestProfiles[uid]?.displayName ?? uid.slice(0, 8)}</span>
                <button onClick={() => handleAccept(uid)} className="p-1 rounded-lg bg-green-500/20 hover:bg-green-500/40 text-green-400 transition-colors">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleReject(uid)} className="p-1 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </>
        )}

        {tab === 'add' && (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Buscar por nombre..."
                className="flex-1 bg-white/5 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
              />
              <button onClick={handleSearch} disabled={searching} className="bg-white/10 hover:bg-white/20 border border-white/20 p-1.5 rounded-lg transition-colors disabled:opacity-40">
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              </button>
            </div>
            {searchResults.map(r => {
              const alreadyFriend = profile?.friends?.includes(r.uid);
              const alreadySent = sentRequests.has(r.uid) || profile?.friendRequests?.includes(r.uid);
              return (
                <div key={r.uid} className="flex items-center gap-2 py-1">
                  <Avatar name={r.displayName} photoURL={r.photoURL} />
                  <span className="flex-1 text-xs text-white truncate">{r.displayName}</span>
                  {alreadyFriend ? (
                    <span className="text-[10px] text-green-400">Ya amigo</span>
                  ) : alreadySent ? (
                    <span className="text-[10px] text-white/40">Enviada</span>
                  ) : (
                    <button onClick={() => handleAddFriend(r.uid)} className="p-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition-colors">
                      <UserPlus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {searchResults.length === 0 && searchQ && !searching && (
              <p className="text-white/30 text-xs text-center py-2">No se encontraron usuarios</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/10'}`}
    >
      {children}
    </button>
  );
}

function Avatar({ name, photoURL }: { name: string; photoURL?: string }) {
  return (
    <div className="w-7 h-7 rounded-full bg-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold">
      {photoURL ? <img src={photoURL} alt={name} className="w-full h-full object-cover" /> : name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function FriendRow({
  uid, profile, presenceData, online, gameId, invited, onInvite, onRemove,
}: {
  uid: string;
  profile?: UserProfile;
  presenceData?: PresenceData;
  online: boolean;
  gameId?: string;
  invited: boolean;
  onInvite: () => void;
  onRemove: () => void;
}) {
  const [showRemove, setShowRemove] = useState(false);
  const name = profile?.displayName ?? presenceData?.displayName ?? uid.slice(0, 8);

  return (
    <div
      className="flex items-center gap-2 py-1.5 group"
      onMouseEnter={() => setShowRemove(true)}
      onMouseLeave={() => setShowRemove(false)}
    >
      <div className="relative flex-shrink-0">
        <Avatar name={name} photoURL={profile?.photoURL ?? presenceData?.photoURL} />
        <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-black ${online ? 'bg-green-400' : 'bg-gray-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white truncate">{name}</p>
        <p className={`text-[10px] ${online ? 'text-green-400' : 'text-white/30'}`}>{online ? 'En línea' : 'Desconectado'}</p>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {gameId && online && (
          <button
            onClick={onInvite}
            disabled={invited}
            title="Invitar a la partida"
            className={`p-1 rounded-lg transition-colors ${invited ? 'text-green-400 bg-green-500/10' : 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/30'}`}
          >
            {invited ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        )}
        {showRemove && (
          <button onClick={onRemove} title="Eliminar amigo" className="p-1 rounded-lg text-red-400/60 hover:bg-red-500/20 hover:text-red-400 transition-colors">
            <UserMinus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
