"use client";
import { useState } from "react";
import { useRouter } from 'next/navigation';
import { useGameStore } from "@/store/useGameStore";
import { socket } from "@/lib/socket";

export function CreateRoom() {
  const [userName, setUserName] = useState("");
  const router = useRouter();
  const setRoom = useGameStore(state => state.setRoom);

  const handleCreateRoom = () => {
    if (userName.trim()) {
      socket.emit("createRoom", { userName }, (response: { success: boolean; room: any; error?: string }) => {
        if (response.success) {
          // The SocketManager will handle updating the store
          // We just need to navigate
          router.push(`/room/${response.room.id}`);
        } else {
          console.error("Failed to create room:", response.error);
        }
      });
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
