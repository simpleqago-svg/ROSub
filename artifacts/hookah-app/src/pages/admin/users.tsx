import { useAdminGetUsers } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";

export default function AdminUsersPage() {
  const [, setLocation] = useLocation();
  const { data: users, isLoading } = useAdminGetUsers();
  const [search, setSearch] = useState("");

  const filtered = users?.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      (u.lastName ?? "").toLowerCase().includes(q) ||
      (u.username ?? "").toLowerCase().includes(q) ||
      String(u.id).includes(q)
    );
  });

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <button
          data-testid="button-back-admin"
          onClick={() => setLocation("/admin")}
          className="text-xs text-muted-foreground mb-2 flex items-center gap-1"
        >
          ← Назад
        </button>
        <h1 className="text-xl font-bold text-foreground">Гости клуба</h1>
      </div>

      {/* Search */}
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

      <div className="px-4 pt-2 space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : filtered?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Гости не найдены
          </div>
        ) : (
          filtered?.map((user) => (
            <button
              key={user.id}
              data-testid={`button-user-${user.id}`}
              onClick={() => setLocation(`/admin/users/${user.id}`)}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-card/80 transition-colors text-left"
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
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    Активна
                  </span>
                ) : (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    Нет
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
