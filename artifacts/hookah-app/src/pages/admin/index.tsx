import { useAdminGetStats, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Activity, QrCode, ChevronRight } from "lucide-react";

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { data: user, error } = useGetMe();
  const { data: stats, isLoading } = useAdminGetStats();

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

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">Админ-панель</h1>
        <p className="text-sm text-muted-foreground">Управление клубом</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Stats */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Всего гостей</p>
                <p data-testid="text-total-users" className="text-3xl font-bold text-foreground mt-1">{stats.totalUsers}</p>
              </div>
              <div className="bg-card border border-primary/20 rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Активных подписок</p>
                <p data-testid="text-active-subs" className="text-3xl font-bold text-primary mt-1">{stats.activeSubscriptions}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Кальянов выкурено (всего)</p>
                <p data-testid="text-hookahs-used" className="text-3xl font-bold text-foreground mt-1">{stats.totalHookahsUsed}</p>
              </div>
            </div>

            {/* By plan */}
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

        {/* Quick actions */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide px-1">Действия</p>

          <button
            data-testid="button-admin-users"
            onClick={() => setLocation("/admin/users")}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 flex items-center gap-3 hover:bg-card/80 transition-colors"
          >
            <Users className="w-5 h-5 text-primary" />
            <span className="flex-1 text-left text-sm font-medium">Список гостей</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button
            data-testid="button-admin-scan"
            onClick={() => setLocation("/admin/scan")}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 flex items-center gap-3 hover:bg-card/80 transition-colors"
          >
            <QrCode className="w-5 h-5 text-primary" />
            <span className="flex-1 text-left text-sm font-medium">Сканировать QR</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button
            data-testid="button-admin-activity"
            onClick={() => setLocation("/admin/users")}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 flex items-center gap-3 hover:bg-card/80 transition-colors"
          >
            <Activity className="w-5 h-5 text-primary" />
            <span className="flex-1 text-left text-sm font-medium">Активность</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
