
DROP POLICY "System creates notifications" ON public.notifications;
CREATE POLICY "Authenticated users create notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
