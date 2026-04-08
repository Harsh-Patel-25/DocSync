import { useEffect, useState } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { WifiOff } from 'lucide-react';

export function ConnectionStatus() {
  const { isOnline, setOnline } = useDocumentStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    
    const handleOnline = () => { setOnline(true); setShow(false); };
    const handleOffline = () => { setOnline(false); setShow(true); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  useEffect(() => {
    if (!isOnline) setShow(true);
    else {
      const t = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isOnline]);

  if (!show) return null;

  return (
    <div className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${
      isOnline 
        ? 'bg-success text-success-foreground' 
        : 'bg-destructive text-destructive-foreground animate-pulse-soft'
    }`}>
      {isOnline ? (
        'Connection restored'
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          Connection lost — retrying...
        </>
      )}
    </div>
  );
}
