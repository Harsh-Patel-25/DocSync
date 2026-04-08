import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { History, RotateCcw } from 'lucide-react';

interface Version {
  id: string;
  content_snapshot: any;
  created_at: string;
  created_by: string | null;
}

export function VersionHistory({
  documentId,
  onRestore,
  canEdit,
}: {
  documentId: string;
  onRestore: (content: any) => void;
  canEdit: boolean;
}) {
  const [versions, setVersions] = useState<Version[]>([]);

  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  const fetchVersions = async () => {
    const { data } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setVersions(data);
  };

  const formatTime = (date: string) =>
    new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <History className="h-4 w-4" />
        <h3 className="font-semibold text-sm">Version History</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {versions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No versions saved yet. Versions are auto-saved every 30 seconds during editing.
          </p>
        )}
        {versions.map((version) => (
          <div
            key={version.id}
            className="flex items-center justify-between rounded-lg border p-3 text-sm"
          >
            <span className="text-muted-foreground">{formatTime(version.created_at)}</span>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onRestore(version.content_snapshot)}
              >
                <RotateCcw className="mr-1 h-3 w-3" /> Restore
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
