
CREATE OR REPLACE FUNCTION public.search_documents(search_query text, uid uuid)
RETURNS TABLE (
  id uuid,
  title text,
  owner_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  is_starred boolean,
  is_deleted boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT d.id, d.title, d.owner_id, d.created_at, d.updated_at, d.is_starred, d.is_deleted
  FROM public.documents d
  WHERE (d.owner_id = uid OR EXISTS (
    SELECT 1 FROM public.document_permissions dp WHERE dp.document_id = d.id AND dp.user_id = uid
  ))
  AND d.is_deleted = false
  AND (
    d.title ILIKE '%' || search_query || '%'
    OR d.content::text ILIKE '%' || search_query || '%'
  )
  ORDER BY d.updated_at DESC
  LIMIT 50;
$$;
