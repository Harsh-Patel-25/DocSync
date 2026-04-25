import { useDocumentStore } from "@/store/documentStore";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function PresenceBar() {
  const { activeUsers } = useDocumentStore();

  if (activeUsers.length <= 1) return null;

  return (
    <div className="flex -space-x-2">
      {activeUsers.slice(0, 5).map((u) => (
        <Tooltip key={u.userId}>
          <TooltipTrigger>
            <Avatar className="h-7 w-7 border-2 border-card">
              <AvatarFallback
                className="text-xs font-medium text-primary-foreground"
                style={{ backgroundColor: u.color }}
              >
                {u.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>{u.name}</TooltipContent>
        </Tooltip>
      ))}
      {activeUsers.length > 5 && (
        <Avatar className="h-7 w-7 border-2 border-card">
          <AvatarFallback className="text-xs bg-muted text-muted-foreground">
            +{activeUsers.length - 5}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
