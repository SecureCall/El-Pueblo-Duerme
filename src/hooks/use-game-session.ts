
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/firebase";
import { signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import type { Game, Player } from "@/types";
import { getObjectiveLogic, secretObjectives } from "@/lib/objectives";
import { PlayerRoleEnum } from "@/types";

type RoleStats = Partial<Record<PlayerRoleEnum, { played: number; won: number; }>>;

export interface GameHistoryEvent {
    type: 'achievement' | 'victory' | 'notable_play';
    title: string;
    description: string;
    timestamp: number;
}

interface PlayerStats {
    victories: number;
    defeats: number;
    roleStats: RoleStats;
    achievements: string[];
    history: GameHistoryEvent[];
}

export function useGameSession() {
  const auth = useAuth();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null);
  const [stats, setStats] = useState<PlayerStats>({
      victories: 0,
      defeats: 0,
      roleStats: {},
      achievements: [],
      history: [],
  });
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  useEffect(() => {
    const storedDisplayName = localStorage.getItem("werewolf_displayName");
    if (storedDisplayName) setDisplayNameState(storedDisplayName);
    
    let storedAvatarUrl = localStorage.getItem("werewolf_avatarUrl");

    const storedStatsRaw = localStorage.getItem("werewolf_stats");
    if (storedStatsRaw && storedStatsRaw.length > 2) {
        try {
            const parsedStats = JSON.parse(storedStatsRaw);
            if (!Array.isArray(parsedStats.history)) {
                parsedStats.history = [];
            }
            setStats(parsedStats);
        } catch (e) {
            console.error("Failed to parse stats from localStorage", e);
            localStorage.removeItem("werewolf_stats");
        }
    }


    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous sign-in failed:", error);
          setIsSessionLoaded(true);
        });
        return;
      }
      
      setFirebaseUser(user);

      if (!storedAvatarUrl) {
        const defaultAvatarId = Math.floor(Math.random() * 20) + 1;
        const defaultAvatar = PlaceHolderImages.find(img => img.id === `avatar-${defaultAvatarId}`);
        if(defaultAvatar) {
            storedAvatarUrl = defaultAvatar.imageUrl;
            localStorage.setItem("werewolf_avatarUrl", storedAvatarUrl);
        }
      }
      setAvatarUrlState(storedAvatarUrl);
      
      if (user && storedAvatarUrl) {
        setIsSessionLoaded(true);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  const setDisplayName = useCallback((name: string | null) => {
    if (name === null) {
      localStorage.removeItem("werewolf_displayName");
      setDisplayNameState(null);
    } else {
      localStorage.setItem("werewolf_displayName", name);
      setDisplayNameState(name);
    }
  }, []);
  
  const setAvatarUrl = useCallback((url: string) => {
    localStorage.setItem("werewolf_avatarUrl", url);
    setAvatarUrlState(url);
  }, []);

  const updateStats = useCallback((winners: Player[], losers: Player[], allPlayers: Player[], game: Game) => {
      if (!firebaseUser) return;
      
      const myPlayerInfo = allPlayers.find(p => p.userId === firebaseUser.uid);
      if (!myPlayerInfo || !myPlayerInfo.role) return;

      const isWinner = winners.some(p => p.userId === firebaseUser.uid);
      const objectiveLogic = myPlayerInfo.secretObjectiveId ? getObjectiveLogic(myPlayerInfo.secretObjectiveId) : undefined;
      const objectiveMet = objectiveLogic ? objectiveLogic(myPlayerInfo, game) : false;


      setStats(prevStats => {
        const newStats: PlayerStats = JSON.parse(JSON.stringify(prevStats));
        
        if (isWinner) newStats.victories += 1;
        else newStats.defeats += 1;
        
        if (!newStats.roleStats[myPlayerInfo.role!]) {
            newStats.roleStats[myPlayerInfo.role!] = { played: 0, won: 0 };
        }
        const roleStat = newStats.roleStats[myPlayerInfo.role!]!;
        roleStat.played += 1;
        if(isWinner) roleStat.won += 1;

        if (objectiveMet && myPlayerInfo.secretObjectiveId && !newStats.achievements.includes(myPlayerInfo.secretObjectiveId)) {
            newStats.achievements.push(myPlayerInfo.secretObjectiveId);
            if (!newStats.history) newStats.history = [];
            const objectiveData = secretObjectives.find(o => o.id === myPlayerInfo.secretObjectiveId);
            if(objectiveData) {
                newStats.history.unshift({
                    type: 'achievement',
                    title: `¡Logro Desbloqueado!`,
                    description: objectiveData.name,
                    timestamp: Date.now(),
                });
            }
        }
        
        const winningTeam = winners.length > 0 ? (winners[0].role === PlayerRoleEnum.WEREWOLF ? 'los Lobos' : 'el Pueblo') : 'nadie';
        if (!newStats.history) newStats.history = [];
        newStats.history.unshift({
            type: 'victory',
            title: isWinner ? '¡Victoria!' : 'Derrota',
            description: `Terminó la partida. Ganaron ${winningTeam}.`,
            timestamp: Date.now(),
        });


        localStorage.setItem("werewolf_stats", JSON.stringify(newStats));
        return newStats;
      });

  }, [firebaseUser]);

  const addGameEventToHistory = useCallback((event: Omit<GameHistoryEvent, 'timestamp'>) => {
      setStats(prevStats => {
          const newStats = { ...prevStats };
          if (!newStats.history) {
              newStats.history = [];
          }
          newStats.history.unshift({ ...event, timestamp: Date.now() });
          newStats.history = newStats.history.slice(0, 10); 
          localStorage.setItem("werewolf_stats", JSON.stringify(newStats));
          return newStats;
      });
  }, []);

  return { 
    userId: firebaseUser?.uid || "",
    user: firebaseUser,
    displayName, 
    setDisplayName,
    avatarUrl,
    setAvatarUrl, 
    stats,
    updateStats,
    addGameEventToHistory,
    gameHistory: stats.history,
    isSessionLoaded 
  };
}
