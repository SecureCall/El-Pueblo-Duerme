
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/firebase";
import { signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export function useGameSession() {
  const auth = useAuth();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  useEffect(() => {
    const storedDisplayName = localStorage.getItem("werewolf_displayName");
    if (storedDisplayName) {
      setDisplayNameState(storedDisplayName);
    }
    
    let storedAvatarUrl = localStorage.getItem("werewolf_avatarUrl");

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous sign-in failed:", error);
          setIsSessionLoaded(true); // Finish loading even on error
        });
        return; // Wait for the new user from signInAnonymously
      }
      
      setFirebaseUser(user);

      if (!storedAvatarUrl) {
        const defaultAvatarId = Math.floor(Math.random() * 16) + 1;
        const defaultAvatar = PlaceHolderImages.find(img => img.id === `avatar-${defaultAvatarId}`);
        if(defaultAvatar) {
            storedAvatarUrl = defaultAvatar.imageUrl;
            localStorage.setItem("werewolf_avatarUrl", storedAvatarUrl);
        }
      }
      setAvatarUrlState(storedAvatarUrl);
      
      // The session is only fully loaded when we have a user AND an avatar.
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

  return { 
    userId: firebaseUser?.uid || "",
    user: firebaseUser,
    displayName, 
    setDisplayName,
    avatarUrl,
    setAvatarUrl, 
    isSessionLoaded 
  };
}
