
-- Create custom types
CREATE TYPE public.document_role AS ENUM ('owner', 'editor', 'commenter', 'viewer');
CREATE TYPE public.notification_type AS ENUM ('comment_mention', 'access_granted', 'comment_reply');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  content JSONB DEFAULT '{}',
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create document_permissions table
CREATE TABLE public.document_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role document_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, user_id)
);
ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;

-- Create comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  text_range JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Create document_versions table
CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  content_snapshot JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type notification_type NOT NULL,
  message TEXT NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check document access
CREATE OR REPLACE FUNCTION public.has_document_access(doc_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents WHERE id = doc_id AND owner_id = uid AND is_deleted = false
    UNION ALL
    SELECT 1 FROM public.document_permissions WHERE document_id = doc_id AND user_id = uid
  )
$$;

-- Helper to check minimum role
CREATE OR REPLACE FUNCTION public.has_document_role(doc_id UUID, uid UUID, min_role document_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents WHERE id = doc_id AND owner_id = uid AND is_deleted = false
  )
  OR EXISTS (
    SELECT 1 FROM public.document_permissions
    WHERE document_id = doc_id AND user_id = uid
    AND (
      CASE min_role
        WHEN 'viewer' THEN role IN ('viewer','commenter','editor','owner')
        WHEN 'commenter' THEN role IN ('commenter','editor','owner')
        WHEN 'editor' THEN role IN ('editor','owner')
        WHEN 'owner' THEN role = 'owner'
      END
    )
  )
$$;

-- Document policies
CREATE POLICY "Users see own and shared documents" ON public.documents
  FOR SELECT USING (
    is_deleted = false AND public.has_document_access(id, auth.uid())
  );
CREATE POLICY "Users create documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Editors and owners update documents" ON public.documents
  FOR UPDATE USING (public.has_document_role(id, auth.uid(), 'editor'));
CREATE POLICY "Only owners delete documents" ON public.documents
  FOR DELETE USING (auth.uid() = owner_id);

-- Permission policies
CREATE POLICY "Users see permissions for accessible docs" ON public.document_permissions
  FOR SELECT USING (public.has_document_access(document_id, auth.uid()));
CREATE POLICY "Owners manage permissions" ON public.document_permissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.documents WHERE id = document_id AND owner_id = auth.uid())
  );
CREATE POLICY "Owners update permissions" ON public.document_permissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.documents WHERE id = document_id AND owner_id = auth.uid())
  );
CREATE POLICY "Owners delete permissions" ON public.document_permissions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.documents WHERE id = document_id AND owner_id = auth.uid())
  );

-- Comment policies
CREATE POLICY "Users see comments on accessible docs" ON public.comments
  FOR SELECT USING (public.has_document_access(document_id, auth.uid()));
CREATE POLICY "Commenters can add comments" ON public.comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_id AND public.has_document_role(document_id, auth.uid(), 'commenter')
  );
CREATE POLICY "Authors update own comments" ON public.comments
  FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors delete own comments" ON public.comments
  FOR DELETE USING (auth.uid() = author_id);

-- Version policies
CREATE POLICY "Users see versions of accessible docs" ON public.document_versions
  FOR SELECT USING (public.has_document_access(document_id, auth.uid()));
CREATE POLICY "Editors create versions" ON public.document_versions
  FOR INSERT WITH CHECK (public.has_document_role(document_id, auth.uid(), 'editor'));

-- Notification policies
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System creates notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create owner permission when document is created
CREATE OR REPLACE FUNCTION public.handle_new_document()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.document_permissions (document_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_document_created
  AFTER INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_document();

-- Indexes
CREATE INDEX idx_documents_owner ON public.documents(owner_id);
CREATE INDEX idx_documents_deleted ON public.documents(is_deleted);
CREATE INDEX idx_permissions_document ON public.document_permissions(document_id);
CREATE INDEX idx_permissions_user ON public.document_permissions(user_id);
CREATE INDEX idx_comments_document ON public.comments(document_id);
CREATE INDEX idx_versions_document ON public.document_versions(document_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- Enable realtime for documents and presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
