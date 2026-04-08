import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Plus, Search, LogOut, Trash2, Loader2, Clock, Users,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Document {
  id: string;
  title: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, owner_id, created_at, updated_at')
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  };

  const createDocument = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('documents')
      .insert({ title: 'Untitled Document', owner_id: user.id, content: { type: 'doc', content: [{ type: 'paragraph' }] } })
      .select('id')
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (data) {
      navigate(`/doc/${data.id}`);
    }
    setCreating(false);
  };

  const deleteDocument = async (id: string) => {
    const { error } = await supabase
      .from('documents')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast({ title: 'Document deleted' });
    }
  };

  const filtered = documents.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">DocSync</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {profile?.display_name || user?.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => useAuthStore.getState().signOut()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">My Documents</h2>
            <p className="text-sm text-muted-foreground">
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={createDocument} disabled={creating}>
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New Document
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Document Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="mb-4 h-16 w-16 text-muted-foreground/30" />
            <h3 className="mb-2 text-lg font-medium">
              {search ? 'No documents found' : 'No documents yet'}
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">
              {search
                ? 'Try a different search term'
                : 'Create your first document to get started'}
            </p>
            {!search && (
              <Button onClick={createDocument} disabled={creating}>
                <Plus className="mr-2 h-4 w-4" /> New Document
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((doc) => (
              <Card
                key={doc.id}
                className="group relative transition-all hover:shadow-md hover:border-primary/20 animate-fade-in"
              >
                <Link to={`/doc/${doc.id}`} className="block">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      {doc.owner_id === user?.id && (
                        <Badge variant="secondary" className="text-xs">Owner</Badge>
                      )}
                    </div>
                    <h3 className="mb-2 font-semibold leading-tight line-clamp-1">
                      {doc.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(doc.updated_at)}
                      </span>
                    </div>
                  </CardContent>
                </Link>
                {doc.owner_id === user?.id && (
                  <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.preventDefault()}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete document?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will move "{doc.title}" to trash.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteDocument(doc.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
