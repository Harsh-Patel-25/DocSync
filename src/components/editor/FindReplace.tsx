import { useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, ChevronDown, ChevronUp, Replace } from "lucide-react";

interface FindReplaceProps {
  editor: Editor;
  onClose: () => void;
}

export function FindReplace({ editor, onClose }: FindReplaceProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);

  const findMatches = useCallback(() => {
    if (!searchTerm) {
      setMatchCount(0);
      return [];
    }
    const text = editor.state.doc.textContent;
    const matches: number[] = [];
    let idx = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    while (idx !== -1) {
      matches.push(idx);
      idx = text.toLowerCase().indexOf(searchTerm.toLowerCase(), idx + 1);
    }
    setMatchCount(matches.length);
    return matches;
  }, [searchTerm, editor]);

  const handleSearch = () => {
    const matches = findMatches();
    if (matches.length > 0) {
      setCurrentMatch(0);
      // Find position in document
      navigateToMatch(0);
    }
  };

  const navigateToMatch = (index: number) => {
    if (!searchTerm) return;
    const doc = editor.state.doc;
    let pos = 0;
    let matchIndex = 0;

    doc.descendants((node, nodePos) => {
      if (!node.isText) return;
      const text = node.text || "";
      let searchIdx = text.toLowerCase().indexOf(searchTerm.toLowerCase());
      while (searchIdx !== -1) {
        if (matchIndex === index) {
          const from = nodePos + searchIdx;
          const to = from + searchTerm.length;
          editor.chain().focus().setTextSelection({ from, to }).run();
          return false;
        }
        matchIndex++;
        searchIdx = text.toLowerCase().indexOf(searchTerm.toLowerCase(), searchIdx + 1);
      }
    });
  };

  const handleNext = () => {
    const next = (currentMatch + 1) % matchCount;
    setCurrentMatch(next);
    navigateToMatch(next);
  };

  const handlePrev = () => {
    const prev = (currentMatch - 1 + matchCount) % matchCount;
    setCurrentMatch(prev);
    navigateToMatch(prev);
  };

  const handleReplace = () => {
    if (!searchTerm) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
    if (selectedText.toLowerCase() === searchTerm.toLowerCase()) {
      editor.chain().focus().insertContentAt({ from, to }, replaceTerm).run();
      findMatches();
    }
  };

  const handleReplaceAll = () => {
    if (!searchTerm) return;
    const doc = editor.state.doc;
    let text = "";
    doc.descendants((node) => {
      if (node.isText) text += node.text;
    });
    // Use editor commands for each replacement from end to start
    const positions: { from: number; to: number }[] = [];
    doc.descendants((node, pos) => {
      if (!node.isText) return;
      const nodeText = node.text || "";
      let idx = nodeText.toLowerCase().indexOf(searchTerm.toLowerCase());
      while (idx !== -1) {
        positions.push({ from: pos + idx, to: pos + idx + searchTerm.length });
        idx = nodeText.toLowerCase().indexOf(searchTerm.toLowerCase(), idx + 1);
      }
    });
    // Replace from end to start to preserve positions
    const chain = editor.chain();
    positions.reverse().forEach(({ from, to }) => {
      chain.insertContentAt({ from, to }, replaceTerm);
    });
    chain.run();
    setMatchCount(0);
  };

  return (
    <div className="absolute top-0 right-4 z-50 w-80 rounded-b-lg border border-border bg-card shadow-lg p-3 space-y-2 animate-fade-in">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Find..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          className="h-8 text-sm"
          autoFocus
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : "0/0"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrev}
          disabled={matchCount === 0}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNext}
          disabled={matchCount === 0}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setShowReplace(!showReplace)}
        >
          <Replace className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      {showReplace && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Replace with..."
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            className="h-8 text-sm"
          />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleReplace}>
            Replace
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleReplaceAll}>
            All
          </Button>
        </div>
      )}
    </div>
  );
}
