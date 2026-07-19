'use client';

import { useEffect, useState } from 'react';
import { io as socketIo } from 'socket.io-client';
import { API, api, getUser, type Board } from './api';

/** Live board state: initial fetch + Socket.IO updates + "you're up" alerts. */
export function useBoard(sessionId: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const [youreUp, setYoureUp] = useState<{ court: number; label: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Board>(`/sessions/${sessionId}/board`)
      .then(setBoard)
      .catch((e) => setError(e.message));

    const socket = socketIo(API);
    socket.emit('join-session', sessionId);
    const user = getUser();
    if (user) socket.emit('join-user', user.id);
    socket.on('board', setBoard);
    socket.on('youre-up', (data: { court: number; label: string }) => {
      setYoureUp(data);
      setTimeout(() => setYoureUp(null), 15_000);
      // browser notification (works while the tab is in the background)
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(`🏓 You're up — Court ${data.court}`, {
          body: data.label || 'Head to your court!',
        });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  return { board, setBoard, youreUp, error, setError };
}
