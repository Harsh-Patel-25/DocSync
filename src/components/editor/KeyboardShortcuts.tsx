import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  { category: 'Text Formatting', items: [
    { keys: 'Ctrl+B', action: 'Bold' },
    { keys: 'Ctrl+I', action: 'Italic' },
    { keys: 'Ctrl+U', action: 'Underline' },
    { keys: 'Ctrl+Shift+X', action: 'Strikethrough' },
    { keys: 'Ctrl+Shift+H', action: 'Highlight' },
    { keys: 'Ctrl+E', action: 'Code' },
  ]},
  { category: 'Paragraphs', items: [
    { keys: 'Ctrl+Alt+1', action: 'Heading 1' },
    { keys: 'Ctrl+Alt+2', action: 'Heading 2' },
    { keys: 'Ctrl+Alt+3', action: 'Heading 3' },
    { keys: 'Ctrl+Shift+8', action: 'Bullet List' },
    { keys: 'Ctrl+Shift+9', action: 'Ordered List' },
    { keys: 'Ctrl+Shift+B', action: 'Blockquote' },
  ]},
  { category: 'General', items: [
    { keys: 'Ctrl+Z', action: 'Undo' },
    { keys: 'Ctrl+Shift+Z', action: 'Redo' },
    { keys: 'Ctrl+H', action: 'Find & Replace' },
    { keys: 'Ctrl+/', action: 'Keyboard Shortcuts' },
    { keys: 'Ctrl+Shift+F', action: 'Focus Mode' },
    { keys: 'Ctrl+P', action: 'Print' },
  ]},
];

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {shortcuts.map((group) => (
            <div key={group.category}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group.category}</h3>
              <div className="space-y-1">
                {group.items.map((s) => (
                  <div key={s.keys} className="flex items-center justify-between py-1">
                    <span className="text-sm">{s.action}</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono">{s.keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
