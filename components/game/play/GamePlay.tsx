'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { db } from '@/lib/firebase/config';
import { doc, onSnapshot, addDoc, collection, serverTimestamp, query, orderBy, limit, getDoc, writeBatch } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { assignRoles, checkWinCondition, ROLES, ROLE_SUBMISSION_KEY, drawRandomEvent } from './roles';
import { BOT_VOTE_CONFIG, pickBotVoteTarget, type BotType, FALLBACK_BOT_MESSAGES, BOT_NARRATOR_SPOTLIGHTS } from '@/lib/bots/botSystem';
import { recordVote, recordGameResult } from '@/lib/bots/playerStats';
import { sendPushToMany } from '@/lib/firebase/push';
import { RoleReveal } from './RoleReveal';
import { NightPhase } from './NightPhase';
import { DayPhase } from './DayPhase';
import { EndGame } from './EndGame';
import { NightTransition } from './NightTransition';
import { DayTransition } from './DayTransition';
import { ChaosEventScreen } from './ChaosEventScreen';
import { NarratorBroadcast } from './NarratorBroadcast';
import { useNarrator, NARRATIONS } from '@/hooks/useNarrator';
import { DeathOverlay } from './DeathOverlay';
import { MomentBanner, buildMoment, type Moment } from './MomentBanner';
import { playNightAmbience, playDayAmbience, stopAllAmbience, playDeathSting, playVoteAlarm, playGameStart, playVictory, playDefeat } from '@/lib/gameAudio';
import { requestNightAction } from '@/lib/game/nightActions';
import { requestResolveNight } from '@/lib/game/resolveNight';
import { requestStartNight } from '@/lib/game/startNight';
import { requestNarratorBroadcast } from '@/lib/game/narratorBroadcast';
import { requestHostTakeover } from '@/lib/game/hostTakeover';
import { getPrivateGameState } from '@/lib/game/privateStateClient';

export interface Player { uid: string; name: string; photoURL: string; isHost: boolean; isAlive: boolean; role: string | null; isAI?: boolean; botType?: BotType; }
export interface GameState {
  name:string; code:string; hostUid:string; maxPlayers:number; wolves:number; specialRoles:string[]; fillWithAI:boolean; players:Player[]; status:string; phase:string;
  roles?: Record<string,string>; wolfTeam?: Record<string,boolean>; roundNumber?:number;
  nightActions?: Record<string, unknown>; nightSubmissions?:Record<string,boolean>; dayVotes?:Record<string,string>; dayEliminatedUid?:string|null; dayStartedAt?:number; dayDuration?:number;
  seerReveal?:{targetUid:string;isWolf:boolean}|null; seerReveal2?:{targetUid:string;isWolf:boolean}|null; profetaReveal?:{targetUid:string;isWolf:boolean}|null; lovers?:[string,string]|null; winners?:string|null; winMessage?:string; eliminatedHistory?:{uid:string;name:string;role:string;round:number}[];
  enchanted?:string[]; guardianLastTarget?:string|null; doctorLastTarget?:string|null; doctorSelfUsed?:boolean; antiguoHit?:string[]; perroLoboChoices?:Record<string,'wolves'|'village'>; salvajeMentors?:Record<string,string>; bearGrowl?:boolean; cazadorPendingShot?:string|null; juezUsed?:boolean; espiaUsed?:boolean; chivoPendingChoice?:string|null; voteBanned?:string[]; alquimistaPotion?:'save'|'reveal'|'nothing'|null; alquimistaRevealUid?:string|null;
  brujaFoundVidente?:boolean; brujaProtectedUid?:string|null; lobosBlocked?:boolean; criaLoboRage?:boolean; silencedPlayers?:string[]; sirenaUid?:string|null; sirenaLinked?:string|null; vigiaUsed?:boolean; vigiaKnowsWolves?:boolean; angelResucitadorUsed?:boolean; bansheePoints?:number; bansheePredictionUid?:string|null; cultMembers?:string[]; vampiroBites?:Record<string,number>; vampiroKills?:number; pescadorBoat?:string[]; pescadorUid?:string|null; hadaLinked?:boolean; verdugos?:Record<string,string>; principeUsed?:boolean; cambiaformasTargets?:Record<string,string>; virginiawoolFate?:Record<string,string>; fantasmaPending?:string[]; fantasmaUsed?:string[]; alborotadoraFight?:[string,string]|null; alborotadoraUsed?:boolean; hechiceraLifeUsed?:boolean; hechiceraPoisonUsed?:boolean; malditoUid?:string|null;
  nightStartedAt?:number; phaseEndsAt?:number; currentEvent?:{id:string;emoji:string;name:string;description:string;mechanical:string}|null; eventRound?:number; saboteadorBan?:string|null; forenseResults?:Record<string,string>; iluminadoReveal?:Record<string,string>; eclipseActive?:boolean; doubleSeerActive?:boolean; anonymousVotesActive?:boolean; noExileActive?:boolean; narratorBroadcast?:{text:string;type:'warning'|'suspicion'|'chaos'|'irony'|'accusation';triggeredAt:number}|null; confessionUid?:string|null; cursed?:{uid:string;round:number}|null; lastXpAwardedAt?:number; revealDeadResult?:{uid:string;name:string;role:string}|null;
}
const VALID_TRANSITIONS: Record<string,string[]>={lobby:['roleReveal'],roleReveal:['night'],night:['day','ended'],day:['voting','night','ended'],voting:['night','day','ended'],ended:[]};
function isValidTransition(from:string|undefined,to:string){return !!from&&VALID_TRANSITIONS[from]?.includes(to);}

export default function GamePlay(props:any){
  const {user}=useAuth(); const router=useRouter();
  const [game,setGame]=useState<GameState|null>(null); const [privateState,setPrivateState]=useState<any>(null);
  const gameId=props.gameId as string;
  useEffect(()=>{ if(!gameId)return; return onSnapshot(doc(db,'games',gameId),s=>{if(s.exists())setGame(s.data() as GameState)});},[gameId]);
  useEffect(()=>{let cancelled=false; getPrivateGameState(gameId).then(s=>{if(!cancelled)setPrivateState(s)}).catch(()=>{}); return()=>{cancelled=true}},[gameId,game?.phase,game?.roundNumber]);
  const myRole=privateState?.myRole ?? props.myRole ?? null;
  const isWolfSide=privateState?.myTeam==='wolves';
  const wolfRoster=privateState?.wolfRoster ?? [];
  if(!game)return <Loader2 className="animate-spin"/>;
  if(game.phase==='ended'){
    return <EndGame {...props} game={game} myRole={myRole} myUid={user?.uid} />;
  }
  if(game.phase==='night') return <NightPhase game={game} gameId={gameId} myRole={myRole} me={game.players.find(p=>p.uid===user?.uid)} userId={user?.uid??''} userName={user?.displayName??''} isHost={game.hostUid===user?.uid} onSubmitAction={async a=>{await requestNightAction(gameId,a)}} />;
  return <DayPhase game={game} gameId={gameId} myRole={myRole} myUid={user?.uid} />;
}
