import { useAdminGetUser, useAdminActivateSubscription, useAdminUpdateSubscription, useGetSubscriptionPlans, getAdminGetUserQueryKey, getAdminGetUsersQueryKey, getAdminGetStatsQueryKey } from "@workspace/api-client-react";
import { useLocation, useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Save, Plus } from "lucide-react";

export default function AdminUserDetailPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const userId = Number(params.userId);
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useAdminGetUser(userId, {
    query: { enabled: !!userId, queryKey: getAdminGetUserQueryKey(userId) },
  });
  const { data: plans } = useGetSubscriptionPlans();
  const activateMutation = useAdminActivateSubscription();
  const updateMutation = useAdminUpdateSubscription();

  const [editMode, setEditMode] = useState(false);
  const [hookahsRemaining, setHookahsRemaining] = useState<number | "">("");
  const [fruitRemaining, setFruitRemaining] = useState<number | "">("");
  const [electricAvailable, setElectricAvailable] = useState(false);
  const [cheapAvailable, setCheapAvailable] = useState(true);
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
          invalidate();
        },
        onError: () => toast({ title: "Ошибка", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) return <div className="p-4 text-muted-foreground">Гость не найден</div>;

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
          <div className="flex justify-between">
            <span className="text-muted-foreground">Роль</span>
            <span className="text-foreground">{user.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Регистрация</span>
            <span className="text-foreground">{new Date(user.createdAt).toLocaleDateString("ru-RU")}</span>
          </div>
        </div>

        {/* Subscription */}
        {user.subscription ? (
          <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Подписка</p>
                <p className="font-bold text-primary">{user.subscription.plan.nameRu}</p>
              </div>
              {!editMode && (
                <button
                  data-testid="button-edit-subscription"
                  onClick={openEdit}
                  className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-medium"
                >
                  Изменить
                </button>
              )}
            </div>

            {editMode ? (
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
                    <span className="text-foreground">350 RSD калик</span>
                  </label>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Заметка</label>
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
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-background rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground">Кальянов</p>
                  <p className="font-bold text-foreground">{user.subscription.hookahsRemaining}</p>
                </div>
                <div className="bg-background rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground">Фруктовых</p>
                  <p className="font-bold text-foreground">{user.subscription.fruitHookahsRemaining}</p>
                </div>
                <div className={`bg-background rounded-lg px-3 py-2 ${user.subscription.cheapHookahAvailable ? "border border-primary/20" : ""}`}>
                  <p className="text-xs text-muted-foreground">350 RSD калик</p>
                  <p className={`font-bold ${user.subscription.cheapHookahAvailable ? "text-primary" : "text-muted-foreground"}`}>
                    {user.subscription.cheapHookahAvailable ? "Доступно" : "Нет"}
                  </p>
                </div>
                <div className={`bg-background rounded-lg px-3 py-2 ${user.subscription.electricAvailable ? "border border-primary/20" : ""}`}>
                  <p className="text-xs text-muted-foreground">Электронная</p>
                  <p className={`font-bold ${user.subscription.electricAvailable ? "text-primary" : "text-muted-foreground"}`}>
                    {user.subscription.electricAvailable ? "Доступно" : "Нет"}
                  </p>
                </div>
                {user.subscription.note && (
                  <div className="col-span-2 bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">Заметка</p>
                    <p className="text-sm text-foreground">{user.subscription.note}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-3">Нет активной подписки</p>

            {activateMode ? (
              <div className="space-y-3">
                <select
                  data-testid="select-plan"
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Выберите план...</option>
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
                    disabled={!selectedPlanId || activateMutation.isPending}
                    className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
                  >
                    {activateMutation.isPending ? "Активируем..." : "Активировать"}
                  </button>
                  <button
                    data-testid="button-cancel-activate"
                    onClick={() => setActivateMode(false)}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
