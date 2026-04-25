import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TemplateGallery } from "@/components/editor/TemplateGallery";
import {
  FileText,
  Plus,
  Search,
  LogOut,
  Trash2,
  Loader2,
  Clock,
  Star,
  StarOff,
  Copy,
  RotateCcw,
  LayoutTemplate,
} from "lucide-react";
import { JSONContent } from "@tiptap/react";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Document = Tables<"documents">;

type TabValue = "all" | "starred" | "trash";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<TabValue>("all");
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (user) fetchDocuments();
  }, [user]);

  /**
   * Fetches all documents from Supabase, including those in trash.
   */
  const fetchDocuments = async () => {
    // Fetch all docs including deleted ones (for trash tab)
    const { data, error } = await supabase
      .from("documents")
      .select("id, title, owner_id, created_at, updated_at, is_starred, is_deleted, content")
      .order("updated_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  };

  /**
   * Creates a new document with an optional initial content.
   */
  const createDocument = async (content?: JSONContent) => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("documents")
      .insert({
        title: "Untitled Document",
        owner_id: user.id,
        content: content || { type: "doc", content: [{ type: "paragraph" }] },
      })
      .select("id")
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      navigate(`/doc/${data.id}`);
    }
    setCreating(false);
  };

  /**
   * Moves a document to the trash.
   */
  const deleteDocument = async (id: string) => {
    const { error } = await supabase.from("documents").update({ is_deleted: true }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, is_deleted: true } : d)));
      toast({ title: "Moved to trash" });
    }
  };

  const restoreDocument = async (id: string) => {
    const { error } = await supabase.from("documents").update({ is_deleted: false }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, is_deleted: false } : d)));
      toast({ title: "Document restored" });
    }
  };

  /**
   * Permanently deletes a document from the database.
   */
  const permanentlyDeleteDocument = async (id: string) => {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast({ title: "Document permanently deleted" });
    }
  };

  const toggleStar = async (id: string, starred: boolean) => {
    const { error } = await supabase
      .from("documents")
      .update({ is_starred: !starred })
      .eq("id", id);
    if (!error) {
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, is_starred: !starred } : d)));
    }
  };

  const duplicateDocument = async (doc: Document) => {
    if (!user) return;
    // Fetch full content
    const { data: full } = await supabase
      .from("documents")
      .select("content")
      .eq("id", doc.id)
      .single();
    const { data, error } = await supabase
      .from("documents")
      .insert({ title: `${doc.title} (Copy)`, owner_id: user.id, content: full?.content || {} })
      .select("id")
      .single();
    if (!error && data) {
      toast({ title: "Document duplicated" });
      fetchDocuments();
    }
  };

  // Server-side search
  const [searchResults, setSearchResults] = useState<Document[] | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!search.trim() || !user) {
      setSearchResults(null);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      const { data } = await supabase.rpc("search_documents", {
        search_query: search.trim(),
        uid: user.id,
      });
      if (data) setSearchResults(data as Document[]);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search, user]);

  const getFilteredDocs = () => {
    if (searchResults !== null) return searchResults;
    let filtered = documents;
    if (tab === "all") filtered = filtered.filter((d) => !d.is_deleted);
    else if (tab === "starred") filtered = filtered.filter((d) => d.is_starred && !d.is_deleted);
    else if (tab === "trash") filtered = filtered.filter((d) => d.is_deleted);
    return filtered;
  };

  const filtered = getFilteredDocs();

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
            <ThemeToggle />
            <NotificationsDropdown />
            <Button variant="ghost" size="icon" onClick={() => useAuthStore.getState().signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">My Documents</h2>
            <p className="text-sm text-muted-foreground">
              {documents.filter((d) => !d.is_deleted).length} document
              {documents.filter((d) => !d.is_deleted).length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTemplates(true)}>
              <LayoutTemplate className="mr-2 h-4 w-4" /> Templates
            </Button>
            <Button onClick={() => createDocument()} disabled={creating}>
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              New Document
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="starred" className="flex items-center gap-1">
              <Star className="h-3 w-3" /> Starred
            </TabsTrigger>
            <TabsTrigger value="trash" className="flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> Trash
            </TabsTrigger>
          </TabsList>
        </Tabs>

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
              {tab === "trash"
                ? "Trash is empty"
                : search
                  ? "No documents found"
                  : tab === "starred"
                    ? "No starred documents"
                    : "No documents yet"}
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">
              {tab === "trash"
                ? "Deleted documents appear here"
                : search
                  ? "Try a different search term"
                  : "Create your first document to get started"}
            </p>
            {tab === "all" && !search && (
              <Button onClick={() => createDocument()} disabled={creating}>
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
                <Link
                  to={tab === "trash" ? "#" : `/doc/${doc.id}`}
                  className="block"
                  onClick={tab === "trash" ? (e) => e.preventDefault() : undefined}
                >
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex items-center gap-1">
                        {doc.is_starred && !doc.is_deleted && (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        )}
                        {doc.owner_id === user?.id && (
                          <Badge variant="secondary" className="text-xs">
                            Owner
                          </Badge>
                        )}
                      </div>
                    </div>
                    <h3 className="mb-2 font-semibold leading-tight line-clamp-1">{doc.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatDate(doc.updated_at)}
                      </span>
                    </div>
                  </CardContent>
                </Link>

                {/* Context menu */}
                <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {tab === "trash" ? (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => restoreDocument(doc.id)}
                        title="Restore"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            title="Delete Permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the
                              document "{doc.title}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => permanentlyDeleteDocument(doc.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Permanently
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.preventDefault()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toggleStar(doc.id, doc.is_starred)}>
                          {doc.is_starred ? (
                            <StarOff className="mr-2 h-4 w-4" />
                          ) : (
                            <Star className="mr-2 h-4 w-4" />
                          )}
                          {doc.is_starred ? "Unstar" : "Star"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateDocument(doc)}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </DropdownMenuItem>
                        {doc.owner_id === user?.id && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteDocument(doc.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Template Gallery */}
      <TemplateGallery
        open={showTemplates}
        onOpenChange={setShowTemplates}
        onSelect={(content) => createDocument(content)}
      />
    </div>
  );
}
