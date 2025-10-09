
"use client";

import { useState, useEffect, useCallback } from "react";

// Note: This hook is for client-side use only.
// It uses localStorage which is not available on the server.
// The `useEffect` ensures this code runs only on the client.

export function useGameSession() {
  const [userId, setUserId] = useState<string>("");
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  useEffect(() => {
    // This code runs only on the client
    let storedUserId = localStorage.getItem("werewolf_userId");
    if (!storedUserId) {
      storedUserId = crypto.randomUUID();
      localStorage.setItem("werewolf_userId", storedUserId);
    }
    setUserId(storedUserId);

    const storedDisplayName = localStorage.getItem("werewolf_displayName");
    setDisplayNameState(storedDisplayName);
    
    setIsSessionLoaded(true);
  }, []);

  const setDisplayName = useCallback((name: string) => {
    localStorage.setItem("werewolf_displayName", name);
    setDisplayNameState(name);
  }, []);

  return { userId, displayName, setDisplayName, isSessionLoaded };
}
