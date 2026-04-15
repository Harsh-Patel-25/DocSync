import type { Editor } from '@tiptap/react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Download, FileText, Code, Printer } from 'lucide-react';

interface ExportMenuProps {
  editor: Editor;
  title: string;
}

export function ExportMenu({ editor, title }: ExportMenuProps) {
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'document';

  const exportTxt = () => {
    const text = editor.state.doc.textContent;
    download(`${sanitizedTitle}.txt`, text, 'text/plain');
  };

  const exportHtml = () => {
    const html = `<!DOCTYPE html>
<html>
<head><title>${title}</title>
<style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1a1a2e}
h1{font-size:2em;margin-top:1.5em}h2{font-size:1.5em}h3{font-size:1.25em}
blockquote{border-left:3px solid #ddd;padding-left:1em;color:#666;font-style:italic}
code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-size:0.9em}
pre{background:#f4f4f4;padding:16px;border-radius:8px;overflow-x:auto}
a{color:#2563eb}</style></head>
<body>${editor.getHTML()}</body></html>`;
    download(`${sanitizedTitle}.html`, html, 'text/html');
  };

  const exportJson = () => {
    const json = JSON.stringify(editor.getJSON(), null, 2);
    download(`${sanitizedTitle}.json`, json, 'application/json');
  };

  const handlePrint = () => {
    const html = editor.getHTML();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7}
h1{font-size:2em}h2{font-size:1.5em}h3{font-size:1.25em}
blockquote{border-left:3px solid #ddd;padding-left:1em;color:#666;font-style:italic}
code{background:#f4f4f4;padding:2px 6px;border-radius:3px}
@media print{body{margin:0;padding:20px}}</style></head>
<body>${html}</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Export">
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportTxt}>
          <FileText className="mr-2 h-4 w-4" /> Export as TXT
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportHtml}>
          <Code className="mr-2 h-4 w-4" /> Export as HTML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportJson}>
          <FileText className="mr-2 h-4 w-4" /> Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
