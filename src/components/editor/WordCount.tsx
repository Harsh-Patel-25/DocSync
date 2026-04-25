import type { Editor } from "@tiptap/react";

interface WordCountProps {
  editor: Editor;
}

export function WordCount({ editor }: WordCountProps) {
  const text = editor.state.doc.textContent;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 border-t border-border bg-muted/30 text-xs text-muted-foreground">
      <span>
        {words} word{words !== 1 ? "s" : ""}
      </span>
      <span>·</span>
      <span>
        {chars} character{chars !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
