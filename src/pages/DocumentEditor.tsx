import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentStore } from '@/store/documentStore';
import { getUserColor } from '@/lib/colors';
import { useToast } from '@/hooks/use-toast';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { EditorContent as TiptapEditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import LinkExt from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import { CommentsPanel } from '@/components/editor/CommentsPanel';
import { VersionHistory } from '@/components/editor/VersionHistory';
import { ShareDialog } from '@/components/editor/ShareDialog';
import { PresenceBar } from '@/components/editor/PresenceBar';
import { ConnectionStatus } from '@/components/editor/ConnectionStatus';
import { WordCount } from '@/components/editor/WordCount';
import { FindReplace } from '@/components/editor/FindReplace';
import { KeyboardShortcuts } from '@/components/editor/KeyboardShortcuts';
import { ExportMenu } from '@/components/editor/ExportMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  ArrowLeft, MessageSquare, History, Share2, Loader2, Search, Keyboard, Maximize, Minimize,
} from 'lucide-react';
import { NotificationsDropdown } from '@/components/NotificationsDropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { setOnline, setActiveUsers } = useDocumentStore();

  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [userRole, setUserRole] = useState<string>('viewer');
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const canEdit = userRole === 'owner' || userRole === 'editor';

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      LinkExt.configure({ openOnClick: false }),
      Highlight.configure({ multicolor: true }),
    ],
    editable: canEdit,
    onUpdate: ({ editor }) => {
      if (!canEdit) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveContent(editor.getJSON());
      }, 1000);
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          setShowFindReplace(prev => !prev);
        }
        if (e.key === '/' ) {
          e.preventDefault();
          setShowShortcuts(prev => !prev);
        }
        if (e.shiftKey && (e.key === 'f' || e.key === 'F')) {
          e.preventDefault();
          setFocusMode(prev => !prev);
        }
        if (e.key === 'p' || e.key === 'P') {
          if (!e.shiftKey) {
            e.preventDefault();
            handlePrint();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, title]);

  const handlePrint = () => {
    if (!editor) return;
    const html = editor.getHTML();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7}
@media print{body{margin:0;padding:20px}}</style></head><body>${html}</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  useEffect(() => {
    if (!id || !user) return;
    fetchDocument();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [id, user]);

  useEffect(() => {
    if (!id || !user || !profile) return;
    const channel = supabase.channel(`doc:${id}`, {
      config: { presence: { key: user.id } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat().map((p: any) => ({
          userId: p.userId, name: p.name, color: p.color,
        }));
        setActiveUsers(users);
      })
      .on('broadcast', { event: 'content-change' }, ({ payload }) => {
        if (payload.userId !== user.id && editor) {
          const cursorPos = editor.state.selection.from;
          editor.commands.setContent(payload.content);
          try { editor.commands.setTextSelection(Math.min(cursorPos, editor.state.doc.content.size)); } catch {}
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.id,
            name: profile.display_name || user.email || 'Anonymous',
            color: getUserColor(user.id),
          });
        }
      });
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { channel.unsubscribe(); window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [id, user, profile, editor]);

  useEffect(() => {
    if (!id || !canEdit || !editor) return;
    const interval = setInterval(() => {
      supabase.from('document_versions').insert({
        document_id: id, content_snapshot: editor.getJSON() as any, created_by: user!.id,
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [id, canEdit, editor, user]);

  const fetchDocument = async () => {
    if (!id) return;
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
    if (error || !data) { toast({ title: 'Document not found', variant: 'destructive' }); navigate('/'); return; }
    setDoc(data); setTitle(data.title);
    if (editor && data.content) editor.commands.setContent(data.content as any);
    const { data: perm } = await supabase.from('document_permissions').select('role').eq('document_id', id).eq('user_id', user!.id).single();
    setUserRole(perm?.role || 'viewer');
    setLoading(false);
  };

  useEffect(() => { if (editor && doc?.content) editor.commands.setContent(doc.content as any); }, [editor, doc]);
  useEffect(() => { if (editor) editor.setEditable(canEdit); }, [canEdit, editor]);

  const saveContent = useCallback(async (content: any) => {
    if (!id) return;
    setSaving(true);
    supabase.channel(`doc:${id}`).send({ type: 'broadcast', event: 'content-change', payload: { content, userId: user!.id } });
    await supabase.from('documents').update({ content, updated_at: new Date().toISOString() }).eq('id', id);
    setSaving(false);
  }, [id, user]);

  const saveTitle = useCallback(async (newTitle: string) => {
    if (!id) return;
    await supabase.from('documents').update({ title: newTitle }).eq('id', id);
  }, [id]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveTitle(e.target.value), 500);
  };

  const restoreVersion = async (content: any) => {
    if (!editor || !canEdit) return;
    editor.commands.setContent(content);
    await saveContent(content);
    setShowHistory(false);
    toast({ title: 'Version restored' });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen flex-col bg-background ${focusMode ? 'focus-mode' : ''}`}>
      <ConnectionStatus />

      {/* Header — hidden in focus mode */}
      {!focusMode && (
        <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
          <div className="flex h-14 items-center gap-2 px-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Input
              value={title} onChange={handleTitleChange} disabled={!canEdit}
              className="h-9 max-w-xs border-none bg-transparent text-lg font-semibold shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {saving ? <span className="animate-pulse">Saving...</span> : <span>Saved</span>}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <PresenceBar />
              <Button variant="ghost" size="icon" onClick={() => setShowFindReplace(!showFindReplace)} className={showFindReplace ? 'bg-accent' : ''} title="Find & Replace (Ctrl+H)">
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowShortcuts(true)} title="Shortcuts (Ctrl+/)">
                <Keyboard className="h-4 w-4" />
              </Button>
              {editor && <ExportMenu editor={editor} title={title} />}
              <Button variant="ghost" size="icon" onClick={() => setFocusMode(true)} title="Focus Mode (Ctrl+Shift+F)">
                <Maximize className="h-4 w-4" />
              </Button>
              <ThemeToggle />
              <NotificationsDropdown />
              <Button variant="ghost" size="icon" onClick={() => setShowComments(!showComments)} className={showComments ? 'bg-accent' : ''}>
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowHistory(!showHistory)} className={showHistory ? 'bg-accent' : ''}>
                <History className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowShare(true)}>
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {canEdit && editor && <EditorToolbar editor={editor} />}
        </header>
      )}

      {/* Focus mode exit bar */}
      {focusMode && (
        <div className="fixed top-4 right-4 z-50 opacity-0 hover:opacity-100 transition-opacity">
          <Button variant="secondary" size="sm" onClick={() => setFocusMode(false)}>
            <Minimize className="mr-1 h-3 w-3" /> Exit Focus
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Find & Replace overlay */}
        {showFindReplace && editor && (
          <FindReplace editor={editor} onClose={() => setShowFindReplace(false)} />
        )}

        <main className="flex-1 overflow-y-auto">
          <div className={`mx-auto ${focusMode ? 'max-w-3xl' : 'max-w-4xl'}`}>
            <div className="min-h-[calc(100vh-8rem)] rounded-lg bg-[hsl(var(--editor-bg))] shadow-sm">
              {editor && <TiptapEditorContent editor={editor} />}
            </div>
          </div>
        </main>

        {!focusMode && showComments && id && (
          <aside className="w-80 border-l border-border bg-card overflow-y-auto animate-fade-in">
            <CommentsPanel documentId={id} userRole={userRole} />
          </aside>
        )}
        {!focusMode && showHistory && id && (
          <aside className="w-80 border-l border-border bg-card overflow-y-auto animate-fade-in">
            <VersionHistory documentId={id} onRestore={restoreVersion} canEdit={canEdit} />
          </aside>
        )}
      </div>

      {/* Word count footer */}
      {editor && !focusMode && <WordCount editor={editor} />}

      {/* Dialogs */}
      {showShare && id && (
        <ShareDialog documentId={id} isOwner={userRole === 'owner'} open={showShare} onOpenChange={setShowShare} />
      )}
      <KeyboardShortcuts open={showShortcuts} onOpenChange={setShowShortcuts} />
    </div>
  );
}
