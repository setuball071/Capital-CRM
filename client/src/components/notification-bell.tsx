import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, ExternalLink, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  carteira: "bg-blue-500",
  demanda: "bg-amber-500",
  tarefa: "bg-green-500",
  agendamento: "bg-purple-500",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d`;
  return date.toLocaleDateString("pt-BR");
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.isRead) markReadMutation.mutate(notif.id);
    if (notif.actionUrl) {
      setIsOpen(false);
      setLocation(notif.actionUrl);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className={cn("h-6 w-6", unreadCount > 0 && "animate-bell-ring")} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-bell-glow"
              data-testid="text-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h4 className="text-sm font-semibold" data-testid="text-notifications-title">Notificações</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs text-muted-foreground"
              onClick={() => markAllReadMutation.mutate()}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="max-h-80">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground" data-testid="text-loading">Carregando...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Inbox className="h-8 w-8 text-muted-foreground/50" />
              <span className="text-sm text-muted-foreground" data-testid="text-empty-notifications">Nenhuma notificação</span>
            </div>
          ) : (
            <div>
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 hover-elevate cursor-pointer border-b last:border-b-0",
                    !notif.isRead && "bg-muted/40"
                  )}
                  onClick={() => handleNotificationClick(notif)}
                  data-testid={`notification-item-${notif.id}`}
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className={cn("h-2 w-2 rounded-full", TYPE_COLORS[notif.type] || "bg-muted-foreground")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={cn("text-sm truncate", !notif.isRead && "font-semibold")} data-testid={`text-notification-title-${notif.id}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {timeAgo(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5" data-testid={`text-notification-message-${notif.id}`}>
                      {notif.message}
                    </p>
                    {notif.actionUrl && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <ExternalLink className="h-2.5 w-2.5" /> Ver
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {!notif.isRead && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); markReadMutation.mutate(notif.id); }}
                        data-testid={`button-read-${notif.id}`}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(notif.id); }}
                      data-testid={`button-delete-notification-${notif.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
