"use client";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useGameStore } from "@/store/useGameStore";
import { socket } from "@/lib/socket";

export function CreateRoom() {
  const [userName, setUserName] = useState("");
  const router = useRouter();

  useEffect(() => {
    function onRoomCreated(data: { roomId: string }) {
      console.log('Server created room, redirecting to:', data.roomId);
      router.push(`/room/${data.roomId}`);
    }

    socket.on('roomCreated', onRoomCreated);

    return () => {
      socket.off('roomCreated', onRoomCreated);
    };
  }, [router]);

  const handleCreateRoom = () => {
    if (userName.trim()) {
      socket.emit("createRoom", { userName });
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        type="text"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        placeholder="Escribe tu nombre"
        className="w-full max-w-xs px-4 py-2 rounded-md bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
      <button
        onClick={handleCreateRoom}
        disabled={!userName.trim()}
        className="w-full max-w-xs px-6 py-3 rounded-md bg-purple-600 text-white font-bold text-lg hover:bg-purple-700 disabled:bg-gray-500 transition-colors"
      >
        Crear Sala y Jugar
      </button>
    </div>
  );
}
