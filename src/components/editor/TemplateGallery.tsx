import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Users, Lightbulb, ClipboardList, BookOpen } from "lucide-react";

import { JSONContent } from "@tiptap/react";

interface TemplateGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (content: JSONContent) => void;
}

const templates = [
  {
    id: "blank",
    name: "Blank Document",
    icon: FileText,
    description: "Start from scratch",
    content: { type: "doc", content: [{ type: "paragraph" }] },
  },
  {
    id: "meeting",
    name: "Meeting Notes",
    icon: Users,
    description: "Agenda, attendees, action items",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Meeting Notes" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Date & Attendees" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "Date: " }] },
        { type: "paragraph", content: [{ type: "text", text: "Attendees: " }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Agenda" }] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Topic 1" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Topic 2" }] }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Discussion" }] },
        { type: "paragraph" },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "[ ] Action item 1 — Owner" }],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "project",
    name: "Project Brief",
    icon: Lightbulb,
    description: "Goals, scope, timeline",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Project Brief" }],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Overview" }] },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Brief description of the project..." }],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Goals" }] },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Goal 1" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Goal 2" }] }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Scope" }] },
        { type: "paragraph" },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Timeline" }] },
        { type: "paragraph" },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Team" }] },
        { type: "paragraph" },
      ],
    },
  },
  {
    id: "todo",
    name: "Task List",
    icon: ClipboardList,
    description: "Organized to-do list",
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Task List" }] },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "🔴 High Priority" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "[ ] Task" }] }],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "🟡 Medium Priority" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "[ ] Task" }] }],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "🟢 Low Priority" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "[ ] Task" }] }],
            },
          ],
        },
      ],
    },
  },
  {
    id: "journal",
    name: "Daily Journal",
    icon: BookOpen,
    description: "Reflection and planning",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Daily Journal" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "✨ Highlights" }],
        },
        { type: "paragraph" },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "📝 Notes" }] },
        { type: "paragraph" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "🎯 Tomorrow's Goals" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Goal 1" }] }],
            },
          ],
        },
      ],
    },
  },
];

export function TemplateGallery({ open, onOpenChange, onSelect }: TemplateGalleryProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {templates.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
              onClick={() => {
                onSelect(t.content);
                onOpenChange(false);
              }}
            >
              <CardContent className="p-4 text-center">
                <t.icon className="mx-auto mb-2 h-8 w-8 text-primary" />
                <h4 className="font-medium text-sm">{t.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
