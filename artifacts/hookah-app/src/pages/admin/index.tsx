import { useAdminGetStats, useAdminGetLogs, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { QrCode, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
  const [purging, setPurging] = useState(false);
  const [purged, setPurged] = useState(false);

  const handlePurge = async () => {
    if (!confirm("Удалить всех тестовых пользователей и их данные? Оставить только себя.")) return;
    setPurging(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/admin/purge-test-data", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (data.ok) {
        setPurged(true);
        toast({ title: "✅ База очищена", description: data.message });
      } else {
        toast({ title: "Ошибка", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка сети", variant: "destructive" });
    } finally {
      setPurging(false);
    }
  };

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
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <>
            {/* Guests & subscriptions */}
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
                <p className="text-xs text-muted-foreground mt-1">Всего: {stats.totalActivations}</p>
              </button>
            </div>

            {/* Legacy users counter */}
            {(stats.legacyActiveCount ?? 0) > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-orange-400 font-medium">Гостей на старых ценах</span>
                <span className="text-sm font-bold text-orange-400">{stats.legacyActiveCount} / 10</span>
              </div>
            )}

            {/* All-time usage counters */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Списания за всё время</p>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">🌿 Кальяны</span>
                  <span data-testid="text-hookahs-used" className="text-sm font-bold text-foreground">{stats.totalHookahsUsed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">🍉 Фруктовых</span>
                  <span className="text-sm font-bold text-foreground">{stats.totalFruitUsed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">💰 350 RSD</span>
                  <span className="text-sm font-bold text-foreground">{stats.totalCheapUsed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">⚡ Эл. чаш</span>
                  <span className="text-sm font-bold text-foreground">{stats.totalElectricUsed}</span>
                </div>
              </div>
            </div>

            {/* Subscriptions by plan */}
            {stats.subscriptionsByPlan && stats.subscriptionsByPlan.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">По уровням подписок</p>
                <div className="space-y-2">
                  {stats.subscriptionsByPlan.map((item) => (
                    <div key={item.planName} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.planName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">Всего: {item.totalEver}</span>
                        <span className="font-semibold text-primary min-w-[2rem] text-right">{item.activeCount} акт.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}

        {/* TEMPORARY: purge test data */}
        {!purged ? (
          <button
            onClick={handlePurge}
            disabled={purging}
            className="w-full bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-40"
          >
            {purging ? "Очищаем..." : "🗑 Очистить тестовые данные (оставить только меня)"}
          </button>
        ) : (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-center text-sm text-green-400 font-medium">
            ✅ База очищена
          </div>
        )}

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
                  {new Date(log.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                  {" "}
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
