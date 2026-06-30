import { useAdminGetLogs } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import BackButton from "@/components/back-button";

const ACTION_LABELS: Record<string, string> = {
  hookah: "🌿 Кальян",
  fruit: "🍉 Фрукт",
  electric: "⚡ Электронная чаша",
  activate: "✅ Активация подписки",
  manual_adjust: "✏️ Корректировка",
};

const ACTION_COLORS: Record<string, string> = {
  hookah: "text-primary",
  fruit: "text-primary",
  cheap: "text-zinc-400",
  electric: "text-blue-400",
  activate: "text-green-400",
  manual_adjust: "text-orange-400",
};

export default function AdminActivityPage() {
  const [, setLocation] = useLocation();
  const { data: logs, isLoading } = useAdminGetLogs();

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <BackButton onClick={() => setLocation("/admin")} />
        <h1 className="text-xl font-bold text-foreground">Активность</h1>
        <p className="text-sm text-muted-foreground">Последние 100 действий</p>
      </div>

      <div className="px-4 pt-3 space-y-2">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : !logs || logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Активности пока нет
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="bg-card border border-border rounded-xl px-4 py-3 space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-medium ${ACTION_COLORS[log.action] ?? "text-foreground"}`}>
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {log.guestName && <span>Гость: <span className="text-foreground">{log.guestName}</span></span>}
                {log.guestName && log.staffName && <span>·</span>}
                {log.staffName && <span>Сотрудник: <span className="text-foreground">{log.staffName}</span></span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
