import { useGetMe, useGetMySubscription } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";
import { LogOut, ChevronRight, Calendar, Hash } from "lucide-react";

function formatMemberNumber(id: number): string {
  return `#${String(id).padStart(6, "0")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetMe();
  const { data: sub } = useGetMySubscription();

  useEffect(() => {
    if (error) {
      localStorage.removeItem("auth_token");
      setLocation("/");
    }
  }, [error, setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setLocation("/");
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">Профиль</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* User card */}
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
          {user.photoUrl ? (
            <img src={user.photoUrl} alt="avatar" className="w-14 h-14 rounded-2xl border border-border object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-primary">{user.firstName[0]}</span>
            </div>
          )}
          <div className="min-w-0">
            <h2 data-testid="text-profile-name" className="font-bold text-foreground text-lg leading-tight truncate">
              {user.firstName}{user.lastName ? ` ${user.lastName}` : ""}
            </h2>
            {user.username && (
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            )}
          </div>
        </div>

        {/* Member card */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Клубная карта</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Hash className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Номер участника</p>
                <p className="font-bold text-foreground text-lg tracking-wider">
                  {formatMemberNumber(user.id)}
                </p>
              </div>
            </div>
            {sub && (
              <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                {sub.plan.nameRu}
              </span>
            )}
          </div>

          {user.createdAt && (
            <div className="flex items-center gap-3 pt-3 border-t border-border">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                <Calendar className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">В клубе с</p>
                <p className="text-sm font-medium text-foreground">{formatDate(user.createdAt)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Subscription summary */}
        {sub ? (
          <button
            data-testid="button-view-subscription"
            onClick={() => setLocation("/dashboard")}
            className="w-full bg-card border border-primary/20 rounded-xl px-4 py-3.5 flex items-center justify-between hover:bg-card/80 transition-colors"
          >
            <div className="text-left">
              <p className="text-xs text-muted-foreground">Активная подписка</p>
              <p className="font-semibold text-primary">{sub.plan.nameRu}</p>
              {sub.expiresAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  До {formatDate(sub.expiresAt)}
                </p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ) : (
          <button
            onClick={() => setLocation("/plans")}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 flex items-center justify-between hover:bg-card/80 transition-colors"
          >
            <div className="text-left">
              <p className="text-xs text-muted-foreground">Подписка</p>
              <p className="font-medium text-muted-foreground">Нет активной подписки</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        )}

        {/* Staff note */}
        {sub?.note && (
          <div className="bg-accent/10 border border-accent/20 rounded-xl px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Заметка персонала</p>
            <p className="text-sm text-foreground">{sub.note}</p>
          </div>
        )}

        {/* Logout */}
        <button
          data-testid="button-logout"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-4 py-3.5 font-medium transition-colors hover:bg-destructive/15"
        >
          <LogOut className="w-4 h-4" />
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
