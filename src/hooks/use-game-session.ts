
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/firebase";
import { signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";

export function useGameSession() {
  const auth = useAuth();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  useEffect(() => {
    const storedDisplayName = localStorage.getItem("werewolf_displayName");
    if (storedDisplayName) {
      setDisplayNameState(storedDisplayName);
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
        setIsSessionLoaded(true);
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous sign-in failed:", error);
          // Handle sign-in failure, maybe show an error to the user
          setIsSessionLoaded(true); // Still finish loading, but with no user
        });
      }
    });

    return () => unsubscribe();
  }, [auth]);

  const setDisplayName = useCallback((name: string) => {
    localStorage.setItem("werewolf_displayName", name);
    setDisplayNameState(name);
  }, []);

  return { 
    userId: firebaseUser?.uid || "", // Return real Firebase UID
    user: firebaseUser,
    displayName, 
    setDisplayName, 
    isSessionLoaded 
  };
}
