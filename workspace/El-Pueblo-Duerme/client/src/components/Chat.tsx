"use client";
import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/store/useGameStore";
import { socket } from "@/lib/socket";
import { Send } from "lucide-react";

export function Chat() {
  const [message, setMessage] = useState("");
  const { room, chat, addChatMessage } = useGameStore();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && room) {
      socket.emit("chatMessage", { roomId: room.id, message });
      setMessage("");
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 flex flex-col h-[60vh]">
      <div className="flex-grow overflow-y-auto pr-2">
        <ul className="space-y-2">
          {chat.map((msg, index) => (
            <li key={index} className="text-sm">
              {msg.type === 'system' ? (
                <span className="text-yellow-400 italic">{msg.text}</span>
              ) : (
                <>
                  <span className="font-bold text-purple-300">{msg.sender}: </span>
                  <span className="text-gray-200">{msg.text}</span>
                </>
              )}
            </li>
          ))}
        </ul>
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-grow px-4 py-2 rounded-md bg-gray-700/60 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="submit"
          disabled={!message.trim()}
          className="px-4 py-2 rounded-md bg-purple-600 text-white font-bold hover:bg-purple-700 disabled:bg-gray-500 transition-colors"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
