
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/firebase/provider";
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

const defaultStats: PlayerStats = {
    victories: 0,
    defeats: 0,
    roleStats: {},
    achievements: [],
    history: [],
};


export function useGameSession() {
  const auth = useAuth();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null);
  const [stats, setStats] = useState<PlayerStats>(defaultStats);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  useEffect(() => {
    const storedDisplayName = localStorage.getItem("werewolf_displayName");
    const storedAvatarUrl = localStorage.getItem("werewolf_avatarUrl");
    const storedStatsRaw = localStorage.getItem("werewolf_stats");

    if (storedDisplayName) {
        setDisplayNameState(storedDisplayName);
    }
    
    // Set the avatar right away if it exists
    if (storedAvatarUrl) {
      setAvatarUrlState(storedAvatarUrl);
    }
    
    // Robust parsing of stats
    if (storedStatsRaw) {
        try {
            const parsedStats = JSON.parse(storedStatsRaw);
            // Basic validation to ensure it's a plausible stats object
            if (typeof parsedStats === 'object' && parsedStats !== null && 'victories' in parsedStats) {
                 if (!Array.isArray(parsedStats.history)) {
                    parsedStats.history = []; // Ensure history array exists
                }
                setStats(parsedStats);
            } else {
                 // The stored data is not in the expected format
                 throw new Error("Parsed stats object is invalid.");
            }
        } catch (e) {
            console.error("Failed to parse stats from localStorage, resetting.", e);
            localStorage.removeItem("werewolf_stats"); // Clear corrupted data
            setStats(defaultStats);
        }
    } else {
        // No stats found, use default
        setStats(defaultStats);
    }


    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous sign-in failed:", error);
        });
        return;
      }
      
      setFirebaseUser(user);
      
      // Only generate a new avatar if one isn't already loaded or stored.
      if (!avatarUrl && !localStorage.getItem("werewolf_avatarUrl")) {
        const defaultAvatarId = Math.floor(Math.random() * 20) + 1;
        const defaultAvatar = PlaceHolderImages.find(img => img.id === `avatar-${defaultAvatarId}`);
        if(defaultAvatar) {
            const newAvatarUrl = defaultAvatar.imageUrl;
            localStorage.setItem("werewolf_avatarUrl", newAvatarUrl);
            setAvatarUrlState(newAvatarUrl);
        }
      }
      
      setIsSessionLoaded(true);
    });

    return () => unsubscribe();
  }, [auth, avatarUrl]); // Added avatarUrl to dependency array to prevent re-runs after it's set

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

  const updateStats = useCallback((isWinner: boolean, myPlayerInfo: Player, game: Game) => {
      if (!firebaseUser || !myPlayerInfo?.role) return;

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
        
        const winningTeamText = () => {
            const lastEvent = game.events.find(e => e.type === 'game_over');
            const winnerCode = lastEvent?.data?.winnerCode;
            switch(winnerCode) {
                case 'villagers': return 'el Pueblo';
                case 'wolves': return 'los Lobos';
                case 'lovers': return 'los Enamorados';
                default: return 'un equipo inesperado';
            }
        };

        if (!newStats.history) {
            newStats.history = [];
        }
        newStats.history.unshift({
            type: 'victory',
            title: isWinner ? '¡Victoria!' : 'Derrota',
            description: `Terminó la partida. Ganaron ${winningTeamText()}.`,
            timestamp: Date.now(),
        });

        // Cap the history at the most recent 10 events
        newStats.history = newStats.history.slice(0, 10);

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
