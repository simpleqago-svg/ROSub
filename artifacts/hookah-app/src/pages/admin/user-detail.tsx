import {
  useAdminGetUser,
  useAdminActivateSubscription,
  useAdminUpdateSubscription,
  useAdminUseHookah,
  useAdminUseFruit,
  useAdminUseCheap,
  useAdminUseElectric,
  useAdminGetUserLogs,
  useAdminUpdateUserRole,
  useGetSubscriptionPlans,
  useGetMe,
  getAdminGetUserQueryKey,
  getAdminGetUsersQueryKey,
  getAdminGetStatsQueryKey,
  getAdminGetUserLogsQueryKey,
} from "@workspace/api-client-react";
import { useLocation, useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Save, Plus, Lock } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  hookah: "🌿 Кальян",
  fruit: "🍉 Фрукт",
  cheap: "💰 350 RSD кальян",
  electric: "⚡ Электронная чаша",
  activate: "✅ Активация подписки",
  manual_adjust: "✏️ Ручная корректировка",
};

export default function AdminUserDetailPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const userId = Number(params.userId);
  const queryClient = useQueryClient();

  const { data: me } = useGetMe();
  const isSuperAdmin = me?.role === "admin";

  const { data: user, isLoading } = useAdminGetUser(userId, {
    query: { enabled: !!userId, queryKey: getAdminGetUserQueryKey(userId) },
  });
  const { data: plans, isLoading: plansLoading } = useGetSubscriptionPlans();
  const { data: logs } = useAdminGetUserLogs(userId, {
    query: { enabled: !!userId, queryKey: getAdminGetUserLogsQueryKey(userId) },
  });

  const activateMutation = useAdminActivateSubscription();
  const updateMutation = useAdminUpdateSubscription();
  const updateRoleMutation = useAdminUpdateUserRole();
  const useHookahMutation = useAdminUseHookah();
  const useFruitMutation = useAdminUseFruit();
  const useCheapMutation = useAdminUseCheap();
  const useElectricMutation = useAdminUseElectric();

  const [editMode, setEditMode] = useState(false);
  const [hookahsRemaining, setHookahsRemaining] = useState<number | "">("");
  const [fruitRemaining, setFruitRemaining] = useState<number | "">("");
  const [electricAvailable, setElectricAvailable] = useState(false);
  const [cheapAvailable, setCheapAvailable] = useState(false);
  const [note, setNote] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<number | "">("");
  const [activateMode, setActivateMode] = useState(false);

  const openEdit = () => {
    if (!user?.subscription) return;
    setHookahsRemaining(user.subscription.hookahsRemaining);
    setFruitRemaining(user.subscription.fruitHookahsRemaining);
    setElectricAvailable(user.subscription.electricAvailable);
    setCheapAvailable(user.subscription.cheapHookahAvailable);
    setNote(user.subscription.note ?? "");
    setEditMode(true);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
    queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getAdminGetUserLogsQueryKey(userId) });
  };

  const handleSave = () => {
    updateMutation.mutate(
      {
        userId,
        data: {
          hookahsRemaining: hookahsRemaining === "" ? undefined : hookahsRemaining,
          fruitHookahsRemaining: fruitRemaining === "" ? undefined : fruitRemaining,
          electricAvailable,
          cheapHookahAvailable: cheapAvailable,
          note: note || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Сохранено", description: "Данные обновлены" });
          setEditMode(false);
          invalidate();
        },
        onError: () => toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" }),
      }
    );
  };

  const handleActivate = () => {
    if (!selectedPlanId) return;
    activateMutation.mutate(
      { userId, data: { planId: selectedPlanId as number, note: note || null } },
      {
        onSuccess: () => {
          toast({ title: "Подписка активирована" });
          setActivateMode(false);
          setNote("");
          setSelectedPlanId("");
          invalidate();
        },
        onError: (e) => {
          const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Ошибка";
          toast({ title: "Ошибка", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const doAction = (
    mutation: typeof useHookahMutation,
    label: string,
    errorCheck?: () => string | null
  ) => {
    const err = errorCheck?.();
    if (err) { toast({ title: "Нельзя", description: err, variant: "destructive" }); return; }
    mutation.mutate(
      { userId },
      {
        onSuccess: () => { toast({ title: label, description: "Успешно списано" }); invalidate(); },
        onError: (e) => {
          const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Ошибка";
          toast({ title: "Ошибка", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const isPending = useHookahMutation.isPending || useFruitMutation.isPending || useCheapMutation.isPending || useElectricMutation.isPending;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) return <div className="p-4 text-muted-foreground">Гость не найден</div>;

  const sub = user.subscription;

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <button
          data-testid="button-back-users"
          onClick={() => setLocation("/admin/users")}
          className="text-xs text-muted-foreground mb-2 flex items-center gap-1"
        >
          ← Назад
        </button>
        <h1 className="text-xl font-bold text-foreground">
          {user.firstName} {user.lastName ?? ""}
        </h1>
        {user.username && <p className="text-sm text-muted-foreground">@{user.username}</p>}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* User info */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ID</span>
            <span data-testid="text-user-id" className="text-foreground font-mono">{user.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Telegram ID</span>
            <span className="text-foreground font-mono">{user.telegramId}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Роль</span>
            {isSuperAdmin ? (
              <select
                data-testid="select-user-role"
                value={user.role}
                disabled={updateRoleMutation.isPending}
                onChange={(e) => {
                  const role = e.target.value as "user" | "staff" | "admin";
                  updateRoleMutation.mutate(
                    { userId, data: { role } },
                    {
                      onSuccess: () => {
                        toast({ title: "Роль обновлена", description: `Теперь: ${role}` });
                        invalidate();
                      },
                      onError: () => toast({ title: "Ошибка", description: "Не удалось изменить роль", variant: "destructive" }),
                    }
                  );
                }}
                className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              >
                <option value="user">Гость</option>
                <option value="staff">Персонал</option>
                <option value="admin">Администратор</option>
              </select>
            ) : (
              <span className="text-foreground">{user.role}</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Регистрация</span>
            <span className="text-foreground">{new Date(user.createdAt).toLocaleDateString("ru-RU")}</span>
          </div>
        </div>

        {/* Guest note (read-only for admin) */}
        {user.note && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-400 mb-1">Заметка гостя</p>
            <p className="text-sm text-foreground">{user.note}</p>
          </div>
        )}

        {/* Subscription */}
        {sub ? (
          <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Подписка</p>
                <p className="font-bold text-primary">{sub.plan.nameRu}</p>
                {sub.activatedAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    с {new Date(sub.activatedAt).toLocaleDateString("ru-RU")}
                    {sub.expiresAt && ` по ${new Date(sub.expiresAt).toLocaleDateString("ru-RU")}`}
                  </p>
                )}
              </div>
              {isSuperAdmin && !editMode && (
                <button
                  data-testid="button-edit-subscription"
                  onClick={openEdit}
                  className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-medium"
                >
                  Изменить
                </button>
              )}
            </div>

            {editMode && isSuperAdmin ? (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Кальянов осталось</label>
                    <input
                      data-testid="input-hookahs-remaining"
                      type="number"
                      min={0}
                      value={hookahsRemaining}
                      onChange={(e) => setHookahsRemaining(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Фруктовых осталось</label>
                    <input
                      data-testid="input-fruit-remaining"
                      type="number"
                      min={0}
                      value={fruitRemaining}
                      onChange={(e) => setFruitRemaining(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      data-testid="checkbox-electric"
                      type="checkbox"
                      checked={electricAvailable}
                      onChange={(e) => setElectricAvailable(e.target.checked)}
                      className="accent-primary"
                    />
                    <span className="text-foreground">Электронная чаша</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      data-testid="checkbox-cheap"
                      type="checkbox"
                      checked={cheapAvailable}
                      onChange={(e) => setCheapAvailable(e.target.checked)}
                      className="accent-primary"
                    />
                    <span className="text-foreground">350 RSD кальян</span>
                  </label>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Заметка персонала (видна гостю)</label>
                  <textarea
                    data-testid="input-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Заметка для гостя..."
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    data-testid="button-save-subscription"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    {updateMutation.isPending ? "Сохраняем..." : "Сохранить"}
                  </button>
                  <button
                    data-testid="button-cancel-edit"
                    onClick={() => setEditMode(false)}
                    className="px-4 bg-muted text-muted-foreground rounded-lg py-2.5 text-sm font-medium"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Balance display */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-background rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">Кальяны</p>
                    <p className="font-bold text-foreground">{sub.hookahsRemaining} / {sub.plan.hookahCount}</p>
                  </div>
                  <div className="bg-background rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">Фруктовых</p>
                    <p className="font-bold text-foreground">{sub.fruitHookahsRemaining} / {sub.plan.bonusHookahFruit}</p>
                  </div>
                  <div className={`bg-background rounded-lg px-3 py-2 ${sub.cheapHookahAvailable ? "border border-primary/20" : ""}`}>
                    <p className="text-xs text-muted-foreground">350 RSD кальян</p>
                    {!sub.cheapHookahAvailable && sub.hookahsRemaining > 0 ? (
                      <div className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">В конце подписки</p>
                      </div>
                    ) : (
                      <p className={`font-bold ${sub.cheapHookahAvailable ? "text-primary" : "text-muted-foreground"}`}>
                        {sub.cheapHookahAvailable ? "Доступен" : "Использован"}
                      </p>
                    )}
                  </div>
                  <div className={`bg-background rounded-lg px-3 py-2 ${sub.electricAvailable ? "border border-primary/20" : ""}`}>
                    <p className="text-xs text-muted-foreground">Электронная чаша</p>
                    <p className={`font-bold ${sub.electricAvailable ? "text-primary" : "text-muted-foreground"}`}>
                      {sub.electricAvailable ? "Доступна" : "Использована"}
                    </p>
                  </div>
                  {sub.note && (
                    <div className="col-span-2 bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">Заметка персонала</p>
                      <p className="text-sm text-foreground">{sub.note}</p>
                    </div>
                  )}
                </div>

                {/* Quick action buttons */}
                <div className="space-y-2 pt-1 border-t border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Быстрое списание</p>
                  <button
                    data-testid="button-use-hookah"
                    onClick={() => doAction(useHookahMutation, "Кальян списан", () => sub.hookahsRemaining <= 0 ? "Кальяны закончились" : null)}
                    disabled={isPending || sub.hookahsRemaining <= 0}
                    className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
                  >
                    🌿 Списать 1 кальян
                    {sub.hookahsRemaining <= 0 ? " (нет)" : ` (осталось ${sub.hookahsRemaining})`}
                  </button>
                  {sub.plan.bonusHookahFruit > 0 && (
                    <button
                      data-testid="button-use-fruit"
                      onClick={() => doAction(useFruitMutation, "Фрукт списан", () =>
                        sub.fruitHookahsRemaining <= 0 ? "Фруктовые закончились" :
                        sub.hookahsRemaining <= 0 ? "Кальяны закончились" : null
                      )}
                      disabled={isPending || sub.fruitHookahsRemaining <= 0 || sub.hookahsRemaining <= 0}
                      className="w-full bg-amber-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
                    >
                      🍉 Фрукт (−1 кальян и −1 фруктовый)
                      {sub.fruitHookahsRemaining <= 0 ? " (нет)" : ` (ост. ${sub.fruitHookahsRemaining})`}
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      data-testid="button-use-cheap"
                      onClick={() => doAction(useCheapMutation, "350 RSD кальян списан")}
                      disabled={isPending || !sub.cheapHookahAvailable}
                      className="bg-zinc-700 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
                    >
                      💰 350 RSD
                    </button>
                    <button
                      data-testid="button-use-electric"
                      onClick={() => doAction(useElectricMutation, "Электронная чаша списана")}
                      disabled={isPending || !sub.electricAvailable}
                      className="bg-zinc-700 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
                    >
                      ⚡ Эл. чаша
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-3">Нет активной подписки</p>

            {isSuperAdmin ? (
              activateMode ? (
                <div className="space-y-3">
                  <select
                    data-testid="select-plan"
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value === "" ? "" : Number(e.target.value))}
                    disabled={plansLoading}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                  >
                    <option value="">{plansLoading ? "Загрузка планов..." : "Выберите план..."}</option>
                    {plans?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameRu} — {p.priceRsd.toLocaleString("ru-RU")} RSD
                      </option>
                    ))}
                  </select>
                  <textarea
                    data-testid="input-activate-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Заметка (необязательно)"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      data-testid="button-confirm-activate"
                      onClick={handleActivate}
                      disabled={!selectedPlanId || activateMutation.isPending || plansLoading}
                      className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
                    >
                      {activateMutation.isPending ? "Активируем..." : "Активировать"}
                    </button>
                    <button
                      data-testid="button-cancel-activate"
                      onClick={() => { setActivateMode(false); setSelectedPlanId(""); setNote(""); }}
                      className="px-4 bg-muted text-muted-foreground rounded-lg py-2.5 text-sm"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  data-testid="button-activate-subscription"
                  onClick={() => setActivateMode(true)}
                  className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Активировать подписку
                </button>
              )
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="w-3.5 h-3.5" />
                Только старший персонал может активировать подписки
              </div>
            )}
          </div>
        )}

        {/* Action logs */}
        {logs && logs.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">История списаний</p>
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-border last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{ACTION_LABELS[log.action] ?? log.action}</p>
                    {log.staffName && (
                      <p className="text-xs text-muted-foreground">Сотрудник: {log.staffName}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {new Date(log.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
