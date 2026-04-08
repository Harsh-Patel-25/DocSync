import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, Check, Reply } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  author_id: string;
  resolved: boolean;
  parent_id: string | null;
  created_at: string;
  author_name?: string;
}

export function CommentsPanel({ documentId, userRole }: { documentId: string; userRole: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const canComment = ['owner', 'editor', 'commenter'].includes(userRole);

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments:${documentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `document_id=eq.${documentId}`,
      }, () => fetchComments())
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [documentId]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (data) {
      // Fetch author names
      const userIds = [...new Set(data.map(c => c.author_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
      setComments(data.map(c => ({ ...c, author_name: nameMap.get(c.author_id) || 'Unknown' })));
    }
  };

  const addComment = async (parentId?: string) => {
    const content = parentId ? replyContent : newComment;
    if (!content.trim() || !user) return;

    await supabase.from('comments').insert({
      document_id: documentId,
      author_id: user.id,
      content: content.trim(),
      parent_id: parentId || null,
    });

    if (parentId) {
      setReplyContent('');
      setReplyTo(null);
    } else {
      setNewComment('');
    }
  };

  const resolveComment = async (commentId: string) => {
    await supabase.from('comments').update({ resolved: true }).eq('id', commentId);
  };

  const topLevel = comments.filter(c => !c.parent_id);
  const replies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  const formatTime = (date: string) =>
    new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquare className="h-4 w-4" />
        <h3 className="font-semibold text-sm">Comments</h3>
        <span className="text-xs text-muted-foreground">({topLevel.length})</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {topLevel.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No comments yet</p>
        )}
        {topLevel.map(comment => (
          <div key={comment.id} className={`rounded-lg border p-3 text-sm ${comment.resolved ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between mb-1">
              <span className="font-medium text-xs">{comment.author_name}</span>
              <span className="text-xs text-muted-foreground">{formatTime(comment.created_at)}</span>
            </div>
            <p className="mb-2">{comment.content}</p>

            {/* Replies */}
            {replies(comment.id).map(reply => (
              <div key={reply.id} className="ml-3 mt-2 border-l-2 border-border pl-3">
                <div className="flex items-start justify-between">
                  <span className="font-medium text-xs">{reply.author_name}</span>
                  <span className="text-xs text-muted-foreground">{formatTime(reply.created_at)}</span>
                </div>
                <p className="text-sm">{reply.content}</p>
              </div>
            ))}

            {/* Actions */}
            <div className="mt-2 flex gap-2">
              {canComment && !comment.resolved && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                  >
                    <Reply className="mr-1 h-3 w-3" /> Reply
                  </Button>
                  {(user?.id === comment.author_id || userRole === 'owner') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => resolveComment(comment.id)}
                    >
                      <Check className="mr-1 h-3 w-3" /> Resolve
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Reply input */}
            {replyTo === comment.id && (
              <div className="mt-2 flex gap-2">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Reply..."
                  className="min-h-[60px] text-sm"
                />
                <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => addComment(comment.id)}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New comment */}
      {canComment && (
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="min-h-[60px] text-sm"
            />
            <Button size="icon" className="h-8 w-8 shrink-0 self-end" onClick={() => addComment()}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
