'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useGameStore } from '@/store/useGameStore';
import { socket } from '@/lib/socket';
import { Room } from '@/components/Room';
import { Loader } from 'lucide-react';

export default function RoomPage() {
  const { roomId } = useParams();
  const { room, error, setError } = useGameStore(state => ({
    room: state.room,
    error: state.error,
    setError: state.setError
  }));

  useEffect(() => {
    if (roomId) {
      socket.emit('joinRoom', { roomId }, (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          console.error('Failed to join room:', response.error);
          setError(response.error || 'No se pudo unir a la sala.');
          // Optionally, redirect to home page
        }
      });
    }

    return () => {
      if (roomId) {
        socket.emit('leaveRoom', { roomId });
      }
    };
  }, [roomId, setError]);
  
  if (error) {
    return (
      <div className="text-center text-red-500">
        <h2 className="text-2xl font-bold">Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Loader className="animate-spin h-12 w-12" />
        <p>Uniéndose a la sala...</p>
      </div>
    );
  }

  return <Room />;
}
