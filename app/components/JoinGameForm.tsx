
"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useGameSession } from "../hooks/use-game-session";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";

export function JoinGameForm() {
  const router = useRouter();
  const { displayName: sessionDisplayName, setDisplayName } = useGameSession();

  const [gameId, setGameId] = useState("");
  const [displayName, setDisplayNameState] = useState(sessionDisplayName || "");
  const [errors, setErrors] = useState<{ gameId?: string; displayName?: string }>({});

  useEffect(() => {
    if (sessionDisplayName) {
      setDisplayNameState(sessionDisplayName);
    }
  }, [sessionDisplayName]);

  const validate = () => {
    const newErrors: { gameId?: string; displayName?: string } = {};

    const trimmedGameId = gameId.trim();
    if (!trimmedGameId || trimmedGameId.length !== 5) {
      newErrors.gameId = "El ID debe tener 5 caracteres.";
    } else if (!/^[A-Z0-9]+$/.test(trimmedGameId)) {
      newErrors.gameId = "El ID solo puede contener letras mayúsculas y números.";
    }

    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName || trimmedDisplayName.length < 2 || trimmedDisplayName.length > 20) {
      newErrors.displayName = "El nombre debe tener entre 2 y 20 caracteres.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setDisplayName(displayName.trim());
      router.push(`/game/${gameId.toUpperCase().trim()}`);
    }
  };

  return (
    <Card className="bg-card/80 border-border/50 backdrop-blur-sm w-full">
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Input
              id="gameId"
              placeholder="ID DE LA PARTIDA"
              value={gameId}
              onChange={(e) => setGameId(e.target.value.toUpperCase())}
              className="text-center text-lg tracking-widest uppercase"
              maxLength={5}
            />
            {errors.gameId && <p className="text-sm font-medium text-destructive">{errors.gameId}</p>}
          </div>
          <div className="space-y-1">
            <Input
              id="displayName"
              placeholder="Tu nombre"
              value={displayName}
              onChange={(e) => setDisplayNameState(e.target.value)}
              className="text-center text-lg"
              minLength={2}
              maxLength={20}
            />
            {errors.displayName && <p className="text-sm font-medium text-destructive">{errors.displayName}</p>}
          </div>
          <Button type="submit" className="w-full font-bold text-lg" variant="secondary">
            Unirse a la Partida
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
