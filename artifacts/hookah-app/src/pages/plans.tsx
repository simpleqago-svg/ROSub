import { useGetSubscriptionPlans } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

const LEVEL_COLORS = [
  "from-zinc-900 to-zinc-800",
  "from-zinc-900 to-amber-900/40",
  "from-amber-900/50 to-amber-800/30",
  "from-amber-800/60 to-amber-700/40",
];

const LEVEL_BORDERS = [
  "border-zinc-700",
  "border-amber-800/50",
  "border-amber-600/50",
  "border-amber-500/60",
];

export default function PlansPage() {
  const { data: plans, isLoading } = useGetSubscriptionPlans();

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">Планы подписки</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Выберите подходящий уровень</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))
        ) : (
          plans?.map((plan, idx) => (
            <div
              key={plan.id}
              data-testid={`card-plan-${plan.id}`}
              className={`bg-gradient-to-br ${LEVEL_COLORS[idx]} border ${LEVEL_BORDERS[idx]} rounded-2xl p-5 space-y-4`}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded-full">
                      Уровень {plan.level}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white">{plan.nameRu}</h2>
                  <p className="text-sm text-white/60">{plan.nameRs}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">
                    {plan.priceRsd.toLocaleString("ru-RU")}
                  </p>
                  <p className="text-xs text-white/60">RSD</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/10 rounded-xl px-3 py-2">
                  <p className="text-xs text-white/60">Кальянов</p>
                  <p className="text-lg font-bold text-white">{plan.hookahCount}</p>
                </div>
                <div className="bg-white/10 rounded-xl px-3 py-2">
                  <p className="text-xs text-white/60">Цена за кальян</p>
                  <p className="text-lg font-bold text-white">{plan.pricePerHookah} RSD</p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-1.5">
                {plan.bonusHookahFruit > 0 && (
                  <div className="bg-white/10 rounded-xl px-3 py-2">
                    <p className="text-xs text-white/60">Из них на фруктовой чаше</p>
                    <p className="text-base font-semibold text-white">до {plan.bonusHookahFruit} шт <span className="text-xs font-normal text-white/50">(входят в общее количество)</span></p>
                  </div>
                )}
                <div className="pt-0.5">
                  <p className="text-xs text-white/50 mb-1.5">После окончания подписки</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs bg-white/10 text-white/80 px-2.5 py-1 rounded-full">
                      Кальян за 350 RSD
                    </span>
                    {plan.bonusElectric > 0 && (
                      <span className="text-xs bg-yellow-400/20 text-yellow-300 px-2.5 py-1 rounded-full">
                        Электронная чаша
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Comparison note */}
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            Чем выше уровень — тем выгоднее цена за кальян.
            Обратитесь к персоналу для активации подписки.
          </p>
        </div>
      </div>
    </div>
  );
}
