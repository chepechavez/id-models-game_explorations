import { useEffect, useState } from 'react';
import { RoomData } from '../types';
import { subscribeToRoom } from './roomApi';
import { ensureParticipantIdentity } from '../firebase';

export function useRoom(code: string | undefined): {
  room: RoomData | null;
  loading: boolean;
  uid: string | null;
} {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | null = null;

    if (!code) {
      setLoading(false);
      return;
    }

    ensureParticipantIdentity()
      .then((identity) => {
        if (!active) return;
        setUid(identity.uid);
        unsub = subscribeToRoom(code, (data) => {
          if (!active) return;
          setRoom(data);
          setLoading(false);
        });
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, [code]);

  return { room, loading, uid };
}
