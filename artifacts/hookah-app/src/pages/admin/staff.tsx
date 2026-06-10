import { useAdminGetStaff } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import BackButton from "@/components/back-button";

const ROLE_CONFIG = {
  admin: { label: "Администратор", className: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  staff: { label: "Персонал", className: "bg-blue-500/15 text-blue-400 border border-blue-500/25" },
} as const;

export default function AdminStaffPage() {
  const [, setLocation] = useLocation();
  const { data: staff, isLoading } = useAdminGetStaff();

  const admins = staff?.filter((u) => u.role === "admin") ?? [];
  const members = staff?.filter((u) => u.role === "staff") ?? [];

  const renderCard = (user: NonNullable<typeof staff>[0]) => {
    const role = ROLE_CONFIG[user.role as keyof typeof ROLE_CONFIG];
    return (
      <button
        key={user.id}
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
            {user.username ? `@${user.username}` : `ID ${user.telegramId}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {role && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${role.className}`}>
              {role.label}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <BackButton onClick={() => setLocation("/admin")} />
        <h1 className="text-xl font-bold text-foreground">Персонал</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Загрузка..." : `${staff?.length ?? 0} сотрудников`}
        </p>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : staff?.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            <p className="text-4xl mb-3">👥</p>
            <p>Сотрудников пока нет</p>
            <p className="text-xs mt-1">Назначьте роль гостю в разделе «Гости»</p>
          </div>
        ) : (
          <>
            {admins.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide px-1">
                  Администраторы
                </p>
                {admins.map(renderCard)}
              </div>
            )}
            {members.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide px-1">
                  Линейный персонал
                </p>
                {members.map(renderCard)}
              </div>
            )}
          </>
        )}

        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Для добавления сотрудника: найдите его в разделе «Гости» и назначьте роль в карточке.
          </p>
        </div>
      </div>
    </div>
  );
}
