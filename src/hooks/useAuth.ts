import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';

export function useAuth() {
  const { user, profile, loading, setUser, setLoading, fetchProfile } = useAuthStore();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchProfile(currentUser.id), 0);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setUser, setLoading, fetchProfile]);

  return { user, profile, loading };
}
