import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { getFirebaseHandles } from '../firebase';

/**
 * Sincroniza el reloj del cliente con `.info/serverTimeOffset` de Firebase
 * para que todos los dispositivos muestren la misma cuenta regresiva.
 */
export function useServerClock(tickMs = 250): number {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const { mode, db } = getFirebaseHandles();
    if (mode !== 'local-broadcast' && db) {
      const offsetRef = ref(db, '.info/serverTimeOffset');
      const unsub = onValue(offsetRef, (snap) => {
        setOffset(Number(snap.val() || 0));
      });
      return () => unsub();
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now() + offset);
    }, tickMs);
    return () => window.clearInterval(id);
  }, [offset, tickMs]);

  return now;
}
