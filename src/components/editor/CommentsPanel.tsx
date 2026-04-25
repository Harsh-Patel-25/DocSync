import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Check, Reply } from "lucide-react";
import { sendEmailNotification } from "@/lib/emailService";

interface Comment {
  id: string;
  content: string;
  author_id: string;
  resolved: boolean;
  parent_id: string | null;
  created_at: string;
  author_name?: string;
}

interface ProfileSuggestion {
  user_id: string;
  display_name: string;
  email: string | null;
}

function MentionTextarea({
  value,
  onChange,
  placeholder,
  documentId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  documentId: string;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorIdx, setCursorIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    onChange(val);
    setCursorIdx(pos);

    // Check for @ trigger
    const textBefore = val.slice(0, pos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setShowSuggestions(true);
      // Fetch users who have access to this document
      const { data } = await supabase
        .from("document_permissions")
        .select("user_id")
        .eq("document_id", documentId);

      if (data) {
        const userIds = data.map((d) => d.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", userIds);

        const q = atMatch[1].toLowerCase();
        const filtered = (profiles || []).filter(
          (p) =>
            p.display_name.toLowerCase().includes(q) ||
            (p.email && p.email.toLowerCase().includes(q))
        );
        setSuggestions(filtered);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = (profile: ProfileSuggestion) => {
    const textBefore = value.slice(0, cursorIdx);
    const atIdx = textBefore.lastIndexOf("@");
    const newText = value.slice(0, atIdx) + `@${profile.display_name} ` + value.slice(cursorIdx);
    onChange(newText);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="relative flex-1">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="min-h-[60px] text-sm"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 z-50 w-full max-h-32 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {suggestions.map((s) => (
            <button
              key={s.user_id}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent text-left"
              onClick={() => insertMention(s)}
            >
              <span className="font-medium">{s.display_name}</span>
              {s.email && <span className="text-muted-foreground truncate">{s.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentsPanel({ documentId, userRole }: { documentId: string; userRole: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const canComment = ["owner", "editor", "commenter"].includes(userRole);

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments:${documentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `document_id=eq.${documentId}`,
        },
        () => fetchComments()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [documentId]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });

    if (data) {
      const userIds = [...new Set(data.map((c) => c.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const nameMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) || []);
      setComments(data.map((c) => ({ ...c, author_name: nameMap.get(c.author_id) || "Unknown" })));
    }
  };

  const extractMentions = (text: string): string[] => {
    const matches = text.match(/@(\w[\w\s]*?)(?=\s@|\s[^@]|$)/g);
    return matches ? matches.map((m) => m.slice(1).trim()) : [];
  };

  const addComment = async (parentId?: string) => {
    const content = parentId ? replyContent : newComment;
    if (!content.trim() || !user) return;

    const { data: comment } = await supabase
      .from("comments")
      .insert({
        document_id: documentId,
        author_id: user.id,
        content: content.trim(),
        parent_id: parentId || null,
      })
      .select("id")
      .single();

    // Create notifications for @mentions
    const mentions = extractMentions(content);
    if (mentions.length > 0 && comment) {
      const { data: mentionedUsers } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("display_name", mentions);

      if (mentionedUsers) {
        const notifications = mentionedUsers
          .filter((u) => u.user_id !== user.id)
          .map((u) => ({
            user_id: u.user_id,
            type: "comment_mention" as const,
            message: `${user.email || "Someone"} mentioned you in a comment`,
            document_id: documentId,
          }));
        if (notifications.length > 0) {
          await supabase.from("notifications").insert(notifications);
          // Send emails for mentions
          for (const u of mentionedUsers) {
            if (u.user_id !== user.id) {
              sendEmailNotification(u.user_id, "mention", documentId);
            }
          }
        }
      }
    }

    // Notify parent comment author on reply
    if (parentId && comment) {
      const parentComment = comments.find((c) => c.id === parentId);
      if (parentComment && parentComment.author_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: parentComment.author_id,
          type: "comment_reply" as const,
          message: `${user.email || "Someone"} replied to your comment`,
          document_id: documentId,
        });
      }
    }

    if (parentId) {
      setReplyContent("");
      setReplyTo(null);
    } else {
      setNewComment("");
    }
  };

  const resolveComment = async (commentId: string) => {
    await supabase.from("comments").update({ resolved: true }).eq("id", commentId);
  };

  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  const formatTime = (date: string) =>
    new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderContent = (text: string) => {
    // Highlight @mentions
    const parts = text.split(/(@\w[\w\s]*?)(?=\s@|\s[^@]|$)/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="font-semibold text-primary">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquare className="h-4 w-4" />
        <h3 className="font-semibold text-sm">Comments</h3>
        <span className="text-xs text-muted-foreground">({topLevel.length})</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {topLevel.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No comments yet. Use @ to mention collaborators.
          </p>
        )}
        {topLevel.map((comment) => (
          <div
            key={comment.id}
            className={`rounded-lg border p-3 text-sm ${comment.resolved ? "opacity-50" : ""}`}
          >
            <div className="flex items-start justify-between mb-1">
              <span className="font-medium text-xs">{comment.author_name}</span>
              <span className="text-xs text-muted-foreground">
                {formatTime(comment.created_at)}
              </span>
            </div>
            <p className="mb-2">{renderContent(comment.content)}</p>

            {replies(comment.id).map((reply) => (
              <div key={reply.id} className="ml-3 mt-2 border-l-2 border-border pl-3">
                <div className="flex items-start justify-between">
                  <span className="font-medium text-xs">{reply.author_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(reply.created_at)}
                  </span>
                </div>
                <p className="text-sm">{renderContent(reply.content)}</p>
              </div>
            ))}

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
                  {(user?.id === comment.author_id || userRole === "owner") && (
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

            {replyTo === comment.id && (
              <div className="mt-2 flex gap-2">
                <MentionTextarea
                  value={replyContent}
                  onChange={setReplyContent}
                  placeholder="Reply... (use @ to mention)"
                  documentId={documentId}
                />
                <Button
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => addComment(comment.id)}
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canComment && (
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <MentionTextarea
              value={newComment}
              onChange={setNewComment}
              placeholder="Add a comment... (use @ to mention)"
              documentId={documentId}
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
