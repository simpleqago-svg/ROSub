import { useAdminGetStats, useAdminGetLogs, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { QrCode, ChevronRight } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  hookah: "🌿 Кальян",
  fruit: "🍉 Фрукт",
  cheap: "💰 350 RSD",
  electric: "⚡ Эл. чаша",
  activate: "✅ Активация",
  manual_adjust: "✏️ Корректировка",
};

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { data: user, error } = useGetMe();
  const { data: stats, isLoading } = useAdminGetStats();
  const { data: logs } = useAdminGetLogs();

  useEffect(() => {
    if (error) {
      localStorage.removeItem("auth_token");
      setLocation("/");
    }
  }, [error, setLocation]);

  useEffect(() => {
    if (user && user.role === "user") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const recentLogs = logs?.slice(0, 7) ?? [];

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">Админ-панель</h1>
        <p className="text-sm text-muted-foreground">Управление клубом</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Stats — clickable cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <button
                data-testid="button-stat-users"
                onClick={() => setLocation("/admin/users")}
                className="bg-card border border-border rounded-xl p-4 text-left hover:bg-card/80 transition-colors"
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Всего гостей</p>
                <p data-testid="text-total-users" className="text-3xl font-bold text-foreground mt-1">{stats.totalUsers}</p>
                <p className="text-xs text-primary mt-1">Список →</p>
              </button>
              <button
                data-testid="button-stat-subs"
                onClick={() => setLocation("/admin/users")}
                className="bg-card border border-primary/20 rounded-xl p-4 text-left hover:bg-card/80 transition-colors"
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Активных подписок</p>
                <p data-testid="text-active-subs" className="text-3xl font-bold text-primary mt-1">{stats.activeSubscriptions}</p>
                <p className="text-xs text-primary mt-1">Список →</p>
              </button>
              <div className="bg-card border border-border rounded-xl p-4 col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Кальянов выкурено (всего)</p>
                <p data-testid="text-hookahs-used" className="text-3xl font-bold text-foreground mt-1">{stats.totalHookahsUsed}</p>
              </div>
            </div>

            {stats.subscriptionsByPlan && stats.subscriptionsByPlan.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">По уровням</p>
                {stats.subscriptionsByPlan.map((item) => (
                  <div key={item.planName} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{item.planName}</span>
                    <span className="text-sm font-semibold text-primary">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}

        {/* Single action: QR scan */}
        <button
          data-testid="button-admin-scan"
          onClick={() => setLocation("/admin/scan")}
          className="w-full bg-primary text-primary-foreground rounded-xl px-4 py-3.5 flex items-center gap-3 font-medium"
        >
          <QrCode className="w-5 h-5" />
          <span className="flex-1 text-left text-sm">Сканировать QR-код</span>
          <ChevronRight className="w-4 h-4 opacity-70" />
        </button>

        {/* Recent activity */}
        {recentLogs.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Последние списания</p>
              <button
                onClick={() => setLocation("/admin/activity")}
                className="text-xs text-primary"
              >
                Все →
              </button>
            </div>
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-border last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm text-foreground">{ACTION_LABELS[log.action] ?? log.action}</span>
                    {log.guestName && (
                      <span className="text-xs text-muted-foreground truncate">— {log.guestName}</span>
                    )}
                  </div>
                  {log.staffName && (
                    <p className="text-xs text-muted-foreground">Сотрудник: {log.staffName}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {new Date(log.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
