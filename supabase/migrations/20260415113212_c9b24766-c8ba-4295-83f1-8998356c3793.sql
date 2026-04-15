
-- Drop and recreate the SELECT policy to also directly allow owner access
DROP POLICY IF EXISTS "Users see own and shared documents" ON public.documents;

CREATE POLICY "Users see own and shared documents" ON public.documents
  FOR SELECT TO authenticated
  USING (
    is_deleted = false 
    AND (
      owner_id = auth.uid() 
      OR has_document_access(id, auth.uid())
    )
  );
