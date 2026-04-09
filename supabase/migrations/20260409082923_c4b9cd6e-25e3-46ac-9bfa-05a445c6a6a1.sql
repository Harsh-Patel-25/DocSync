-- Drop and recreate the documents INSERT policy for authenticated users
DROP POLICY IF EXISTS "Users create documents" ON public.documents;
CREATE POLICY "Users create documents"
  ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Also fix the other documents policies to target authenticated
DROP POLICY IF EXISTS "Users see own and shared documents" ON public.documents;
CREATE POLICY "Users see own and shared documents"
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (is_deleted = false AND has_document_access(id, auth.uid()));

DROP POLICY IF EXISTS "Editors and owners update documents" ON public.documents;
CREATE POLICY "Editors and owners update documents"
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (has_document_role(id, auth.uid(), 'editor'::document_role));

DROP POLICY IF EXISTS "Only owners delete documents" ON public.documents;
CREATE POLICY "Only owners delete documents"
  ON public.documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Fix document_permissions policies
DROP POLICY IF EXISTS "Users see permissions for accessible docs" ON public.document_permissions;
CREATE POLICY "Users see permissions for accessible docs"
  ON public.document_permissions
  FOR SELECT
  TO authenticated
  USING (has_document_access(document_id, auth.uid()));

DROP POLICY IF EXISTS "Owners manage permissions" ON public.document_permissions;
CREATE POLICY "Owners manage permissions"
  ON public.document_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM documents WHERE id = document_permissions.document_id AND owner_id = auth.uid()));

DROP POLICY IF EXISTS "Owners update permissions" ON public.document_permissions;
CREATE POLICY "Owners update permissions"
  ON public.document_permissions
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM documents WHERE id = document_permissions.document_id AND owner_id = auth.uid()));

DROP POLICY IF EXISTS "Owners delete permissions" ON public.document_permissions;
CREATE POLICY "Owners delete permissions"
  ON public.document_permissions
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM documents WHERE id = document_permissions.document_id AND owner_id = auth.uid()));

-- Fix comments policies
DROP POLICY IF EXISTS "Users see comments on accessible docs" ON public.comments;
CREATE POLICY "Users see comments on accessible docs"
  ON public.comments
  FOR SELECT
  TO authenticated
  USING (has_document_access(document_id, auth.uid()));

DROP POLICY IF EXISTS "Commenters can add comments" ON public.comments;
CREATE POLICY "Commenters can add comments"
  ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id AND has_document_role(document_id, auth.uid(), 'commenter'::document_role));

DROP POLICY IF EXISTS "Authors update own comments" ON public.comments;
CREATE POLICY "Authors update own comments"
  ON public.comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors delete own comments" ON public.comments;
CREATE POLICY "Authors delete own comments"
  ON public.comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- Fix document_versions policies
DROP POLICY IF EXISTS "Users see versions of accessible docs" ON public.document_versions;
CREATE POLICY "Users see versions of accessible docs"
  ON public.document_versions
  FOR SELECT
  TO authenticated
  USING (has_document_access(document_id, auth.uid()));

DROP POLICY IF EXISTS "Editors create versions" ON public.document_versions;
CREATE POLICY "Editors create versions"
  ON public.document_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (has_document_role(document_id, auth.uid(), 'editor'::document_role));

-- Fix notifications policies
DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users create notifications" ON public.notifications;
CREATE POLICY "Authenticated users create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix profiles policies
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by everyone"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);