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
import {
  ArrowLeft, MessageSquare, History, Share2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { isOnline, setOnline, setActiveUsers } = useDocumentStore();

  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [userRole, setUserRole] = useState<string>('viewer');
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const versionTimeoutRef = useRef<NodeJS.Timeout>();

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
      // Debounced save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveContent(editor.getJSON());
      }, 1000);
    },
  });

  // Fetch document
  useEffect(() => {
    if (!id || !user) return;
    fetchDocument();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (versionTimeoutRef.current) clearTimeout(versionTimeoutRef.current);
    };
  }, [id, user]);

  // Setup realtime presence
  useEffect(() => {
    if (!id || !user || !profile) return;

    const channel = supabase.channel(`doc:${id}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat().map((p: any) => ({
          userId: p.userId,
          name: p.name,
          color: p.color,
        }));
        setActiveUsers(users);
      })
      .on('broadcast', { event: 'content-change' }, ({ payload }) => {
        if (payload.userId !== user.id && editor) {
          const cursorPos = editor.state.selection.from;
          editor.commands.setContent(payload.content);
          // Try to restore cursor
          try {
            editor.commands.setTextSelection(Math.min(cursorPos, editor.state.doc.content.size));
          } catch {}
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

    // Connection monitoring
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      channel.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [id, user, profile, editor]);

  // Auto version snapshot every 30 seconds
  useEffect(() => {
    if (!id || !canEdit || !editor) return;

    const interval = setInterval(() => {
      const content = editor.getJSON();
      supabase.from('document_versions').insert({
        document_id: id,
        content_snapshot: content as any,
        created_by: user!.id,
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [id, canEdit, editor, user]);

  const fetchDocument = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      toast({ title: 'Document not found', variant: 'destructive' });
      navigate('/');
      return;
    }

    setDoc(data);
    setTitle(data.title);

    if (editor && data.content) {
      editor.commands.setContent(data.content as any);
    }

    // Get user role
    const { data: perm } = await supabase
      .from('document_permissions')
      .select('role')
      .eq('document_id', id)
      .eq('user_id', user!.id)
      .single();

    setUserRole(perm?.role || 'viewer');
    setLoading(false);
  };

  // Set content when editor is ready
  useEffect(() => {
    if (editor && doc?.content) {
      editor.commands.setContent(doc.content as any);
    }
  }, [editor, doc]);

  // Update editable when role changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(canEdit);
    }
  }, [canEdit, editor]);

  const saveContent = useCallback(async (content: any) => {
    if (!id) return;
    setSaving(true);
    
    // Broadcast to other users
    supabase.channel(`doc:${id}`).send({
      type: 'broadcast',
      event: 'content-change',
      payload: { content, userId: user!.id },
    });

    await supabase
      .from('documents')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id);

    setSaving(false);
  }, [id, user]);

  const saveTitle = useCallback(async (newTitle: string) => {
    if (!id) return;
    await supabase
      .from('documents')
      .update({ title: newTitle })
      .eq('id', id);
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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Connection Status */}
      <ConnectionStatus />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex h-14 items-center gap-2 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <Input
            value={title}
            onChange={handleTitleChange}
            disabled={!canEdit}
            className="h-9 max-w-xs border-none bg-transparent text-lg font-semibold shadow-none focus-visible:ring-0"
          />

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {saving ? (
              <span className="animate-pulse-soft">Saving...</span>
            ) : (
              <span>Saved</span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <PresenceBar />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowComments(!showComments)}
              className={showComments ? 'bg-accent' : ''}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(!showHistory)}
              className={showHistory ? 'bg-accent' : ''}
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowShare(true)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        {canEdit && editor && <EditorToolbar editor={editor} />}
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl">
            <div className="min-h-[calc(100vh-8rem)] rounded-lg bg-editor shadow-sm">
              {editor && <TiptapEditorContent editor={editor} />}
            </div>
          </div>
        </main>

        {/* Side panels */}
        {showComments && id && (
          <aside className="w-80 border-l border-border bg-card overflow-y-auto animate-slide-in">
            <CommentsPanel documentId={id} userRole={userRole} />
          </aside>
        )}
        {showHistory && id && (
          <aside className="w-80 border-l border-border bg-card overflow-y-auto animate-slide-in">
            <VersionHistory
              documentId={id}
              onRestore={restoreVersion}
              canEdit={canEdit}
            />
          </aside>
        )}
      </div>

      {/* Share dialog */}
      {showShare && id && (
        <ShareDialog
          documentId={id}
          isOwner={userRole === 'owner'}
          open={showShare}
          onOpenChange={setShowShare}
        />
      )}
    </div>
  );
}
