import { useAdminGetUsers, useAdminDeleteUser } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Search, Trash2 } from "lucide-react";
import BackButton from "@/components/back-button";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminGetUsersQueryKey, getAdminGetStatsQueryKey } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";

import type { AdminUserView } from "@workspace/api-client-react";
type User = AdminUserView;

export default function AdminUsersPage() {
  const [, setLocation] = useLocation();
  const { data: users, isLoading } = useAdminGetUsers();
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const deleteMutation = useAdminDeleteUser();

  const filtered = users?.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      (u.lastName ?? "").toLowerCase().includes(q) ||
      (u.username ?? "").toLowerCase().includes(q) ||
      String(u.id).includes(q)
    );
  }) ?? [];

  const withSub = filtered.filter((u) => u.subscription);
  const withoutSub = filtered.filter((u) => !u.subscription);

  const handleDelete = (userId: number) => {
    deleteMutation.mutate({ userId }, {
      onSuccess: () => {
        toast({ title: "Гость удалён" });
        setConfirmId(null);
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
      },
      onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
    });
  };

  const renderCard = (user: User) => (
    <div key={user.id} className="relative">
      <button
        data-testid={`button-user-${user.id}`}
        onClick={() => { if (confirmId === user.id) setConfirmId(null); else setLocation(`/admin/users/${user.id}`); }}
        className="w-full bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-card/80 transition-colors text-left pr-12"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="font-bold text-primary text-sm">{user.firstName[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm truncate">
            {user.firstName} {user.lastName ?? ""}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {user.username ? `@${user.username} · ` : ""}
            {user.subscription
              ? `${user.subscription.plan.nameRu} · ${user.subscription.hookahsRemaining} кал.`
              : "Нет подписки"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {user.subscription?.isLegacy && (
            <span className="text-xs bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
              Старые цены
            </span>
          )}
          {user.subscription ? (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Активна</span>
          ) : (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Нет</span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); setConfirmId(confirmId === user.id ? null : user.id); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {confirmId === user.id && (
        <div className="mt-1 bg-red-950/40 border border-red-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-300">Удалить гостя и все его данные?</p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setConfirmId(null)}
              className="text-xs px-3 py-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={() => handleDelete(user.id)}
              disabled={deleteMutation.isPending}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <BackButton data-testid="button-back-admin" onClick={() => setLocation("/admin")} />
        <h1 className="text-xl font-bold text-foreground">Гости клуба</h1>
      </div>

      <div className="px-4 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            data-testid="input-search-users"
            type="search"
            placeholder="Поиск по имени или @username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="px-4 pt-2 space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Гости не найдены
          </div>
        ) : (
          <>
            {withSub.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide px-1">
                  С подпиской — {withSub.length}
                </p>
                {withSub.map(renderCard)}
              </div>
            )}
            {withoutSub.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide px-1">
                  Без подписки — {withoutSub.length}
                </p>
                {withoutSub.map(renderCard)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
