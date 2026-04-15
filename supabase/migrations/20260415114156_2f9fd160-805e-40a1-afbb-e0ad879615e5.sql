
DROP POLICY IF EXISTS "Users see own and shared documents" ON public.documents;

CREATE POLICY "Users see own and shared documents" ON public.documents
  FOR SELECT TO authenticated
  USING (
    (owner_id = auth.uid() OR has_document_access(id, auth.uid()))
    AND (is_deleted = false OR owner_id = auth.uid())
  );
