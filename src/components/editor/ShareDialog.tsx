import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Trash2, Share2 } from "lucide-react";
import { sendEmailNotification } from "@/lib/emailService";
import type { Database } from "@/integrations/supabase/types";

type DocumentRole = Database["public"]["Enums"]["document_role"];

interface Permission {
  id: string;
  user_id: string;
  role: DocumentRole;
  email?: string;
}

export function ShareDialog({
  documentId,
  isOwner,
  open,
  onOpenChange,
}: {
  documentId: string;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<DocumentRole>("viewer");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) fetchPermissions();
  }, [open, documentId]);

  const fetchPermissions = async () => {
    const { data } = await supabase
      .from("document_permissions")
      .select("*")
      .eq("document_id", documentId);

    if (data) {
      const userIds = data.map((p) => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);

      const emailMap = new Map(profiles?.map((p) => [p.user_id, p.email || p.display_name]) || []);
      setPermissions(data.map((p) => ({ ...p, email: emailMap.get(p.user_id) || p.user_id })));
    }
  };

  const addPermission = async () => {
    if (!email.trim()) return;
    setAdding(true);

    // Find user by email
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", email.trim());

    if (!profiles || profiles.length === 0) {
      toast({
        title: "User not found",
        description: "No user with that email exists.",
        variant: "destructive",
      });
      setAdding(false);
      return;
    }

    const userId = profiles[0].user_id;

    const { error } = await supabase.from("document_permissions").upsert(
      {
        document_id: documentId,
        user_id: userId,
        role,
      },
      { onConflict: "document_id,user_id" }
    );

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Create notification for the user who was granted access
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "access_granted",
        message: `You've been given ${role} access to a document`,
        document_id: documentId,
      });

      // Send email for share
      sendEmailNotification(userId, "share", documentId);

      toast({ title: "Permission added" });
      setEmail("");
      fetchPermissions();
    }
    setAdding(false);
  };

  const removePermission = async (permId: string) => {
    await supabase.from("document_permissions").delete().eq("id", permId);
    fetchPermissions();
  };

  const updateRole = async (permId: string, newRole: DocumentRole) => {
    await supabase.from("document_permissions").update({ role: newRole }).eq("id", permId);
    fetchPermissions();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" /> Share Document
          </DialogTitle>
        </DialogHeader>

        {isOwner && (
          <div className="space-y-3">
            <Label>Invite by email</Label>
            <div className="flex gap-2">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="flex-1"
              />
              <Select value={role} onValueChange={(v: DocumentRole) => setRole(v)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="commenter">Commenter</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addPermission} disabled={adding} size="icon">
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <Label>People with access</Label>
          {permissions.map((perm) => (
            <div
              key={perm.id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <span className="truncate">{perm.email}</span>
              <div className="flex items-center gap-2">
                {isOwner && perm.role !== "owner" ? (
                  <>
                    <Select
                      value={perm.role}
                      onValueChange={(v: DocumentRole) => updateRole(perm.id, v)}
                    >
                      <SelectTrigger className="h-8 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="commenter">Commenter</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removePermission(perm.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </>
                ) : (
                  <span className="text-xs capitalize text-muted-foreground">{perm.role}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
