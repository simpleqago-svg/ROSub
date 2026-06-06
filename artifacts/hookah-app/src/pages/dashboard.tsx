import { useGetMe, useGetMySubscription, getGetMySubscriptionQueryKey, useUpdateMyNote } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, useRef } from "react";
import { Lock } from "lucide-react";

const LOYALTY_TOTAL = 10;

function LoyaltyCard({ stamps, totalRedeemed }: { stamps: number; totalRedeemed: number }) {
  const ready = stamps >= LOYALTY_TOTAL;
  return (
    <div className={`bg-card border rounded-2xl px-5 py-4 space-y-3 ${ready ? "border-primary/40" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Карта лояльности</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {ready ? "🎉 Готово к погашению!" : `${stamps} из ${LOYALTY_TOTAL} марок`}
          </p>
        </div>
        {totalRedeemed > 0 && (
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-1">
            погашено: {totalRedeemed}×
          </span>
        )}
      </div>
      <div className="grid grid-cols-10 gap-1.5">
        {Array.from({ length: LOYALTY_TOTAL }).map((_, i) => (
          <div
            key={i}
            className={`aspect-square rounded-full flex items-center justify-center text-sm ${
              i < stamps
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground/30"
            }`}
          >
            {i < stamps ? "🌿" : "·"}
          </div>
        ))}
      </div>
      {ready ? (
        <p className="text-xs text-primary font-medium text-center">Покажи персоналу — получи кальян за 350 RSD</p>
      ) : (
        <p className="text-xs text-muted-foreground text-center">1 кальян = 1 марка · 10 марок = кальян за 350 RSD</p>
      )}
    </div>
  );
}

function ProgressBar({ remaining, total, label }: { remaining: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
  const color = pct > 50 ? "bg-primary" : pct > 20 ? "bg-primary/60" : "bg-red-500";
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-bold text-lg text-foreground">{remaining}<span className="text-muted-foreground text-xs font-normal"> / {total}</span></span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BoolCard({ label, available, locked, lockedHint, unavailableHint }: { label: string; available: boolean; locked?: boolean; lockedHint?: string; unavailableHint?: string }) {
  if (locked) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <span className="font-semibold text-sm text-muted-foreground">Недоступно</span>
        {lockedHint && <span className="text-xs text-muted-foreground/70 leading-tight">{lockedHint}</span>}
      </div>
    );
  }
  return (
    <div className={`bg-card border rounded-xl p-4 flex flex-col gap-1 ${available ? "border-primary/30" : "border-border"}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-semibold text-base ${available ? "text-primary" : "text-muted-foreground"}`}>
        {available ? "Доступно" : "Недоступно"}
      </span>
      {!available && unavailableHint && (
        <span className="text-xs text-muted-foreground/70 leading-tight">{unavailableHint}</span>
      )}
    </div>
  );
}

const DEBOUNCE_MS = 800;

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading, error: userError } = useGetMe();
  const { data: sub, isLoading: subLoading } = useGetMySubscription({
    query: { queryKey: getGetMySubscriptionQueryKey(), refetchInterval: 30_000 },
  });
  const updateNoteMutation = useUpdateMyNote();

  const [note, setNote] = useState<string>("");
  const [noteSaved, setNoteSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (user && !initializedRef.current) {
      setNote(user.note ?? "");
      initializedRef.current = true;
    }
  }, [user]);

  const handleNoteChange = (val: string) => {
    if (val.length > 300) return;
    setNote(val);
    setNoteSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNoteMutation.mutate(
        { data: { note: val || null } },
        { onSuccess: () => setNoteSaved(true) }
      );
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    if (userError) {
      localStorage.removeItem("auth_token");
      setLocation("/");
    }
  }, [userError, setLocation]);

  if (userLoading) {
    return (
      <div className="min-h-screen p-4 space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-52 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Добро пожаловать</p>
          <h1 data-testid="text-username" className="font-bold text-lg text-foreground leading-tight">
            {user.firstName} {user.lastName ?? ""}
          </h1>
          {user.username && (
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          )}
        </div>
        {user.photoUrl && (
          <img src={user.photoUrl} alt="avatar" className="w-10 h-10 rounded-full border border-border" />
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* QR Code */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Ваш QR-код для персонала</p>
          <div className="bg-white rounded-xl p-3">
            <QRCodeSVG
              value={user.displayCode ?? String(user.id)}
              size={140}
              bgColor="#ffffff"
              fgColor="#1a1208"
              data-testid="img-qr-code"
            />
          </div>
          {user.displayCode && (
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-[0.25em] text-foreground font-mono">
                {user.displayCode}
              </span>
            </div>
          )}
        </div>

        {/* Subscription */}
        {subLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </div>
        ) : sub ? (
          <>
            {/* Plan badge + dates */}
            {(() => {
              const daysLeft = sub.expiresAt
                ? Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / 86_400_000)
                : null;
              const isExpired = daysLeft !== null && daysLeft <= 0;
              const isWarning = daysLeft !== null && daysLeft > 0 && daysLeft <= 3;
              return (
                <>
                  {sub.frozenUntil && new Date(sub.frozenUntil) > new Date() && (
                    <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl px-4 py-2.5 flex items-center gap-2">
                      <span className="text-sm font-semibold text-sky-400">
                        ⏸ Заморожена до {new Date(sub.frozenUntil).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                      </span>
                    </div>
                  )}
                  {isExpired && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 flex items-center gap-2">
                      <span className="text-sm font-semibold text-red-400">Подписка истекла</span>
                      <span className="text-xs text-red-400/70">
                        {Math.abs(daysLeft!)} {Math.abs(daysLeft!) === 1 ? "день" : "дней"} назад
                      </span>
                    </div>
                  )}
                  {isWarning && (
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-2.5">
                      <span className="text-sm font-semibold text-orange-400">
                        ⚠️ Осталось {daysLeft} {daysLeft === 1 ? "день" : daysLeft! <= 4 ? "дня" : "дней"}!
                      </span>
                    </div>
                  )}
                  <div className={`border rounded-2xl px-5 py-4 ${isExpired ? "bg-red-500/5 border-red-500/20" : "bg-primary/10 border-primary/20"}`}>
                    <p className={`text-xs uppercase tracking-wide mb-1 ${isExpired ? "text-red-400/70" : "text-primary/70"}`}>
                      {isExpired ? "Истёкшая подписка" : "Активная подписка"}
                    </p>
                    <h2 className={`text-xl font-bold ${isExpired ? "text-red-400" : "text-primary"}`}>{sub.plan.nameRu}</h2>
                    <p className="text-sm text-muted-foreground">{sub.plan.nameRs}</p>
                    <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide mb-0.5 opacity-60">Активирована</p>
                        <p className="font-medium text-foreground">
                          {sub.activatedAt
                            ? new Date(sub.activatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide mb-0.5 opacity-60">
                          {isExpired ? "Истекла" : daysLeft !== null ? `Осталось ${daysLeft} ${daysLeft === 1 ? "день" : daysLeft <= 4 ? "дня" : "дней"}` : "Срок действия"}
                        </p>
                        <p className={`font-medium ${isExpired ? "text-red-400" : isWarning ? "text-orange-400" : "text-foreground"}`}>
                          {sub.expiresAt
                            ? new Date(sub.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
                            : "Бессрочно"}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Progress bars */}
            <div className="space-y-2">
              <ProgressBar
                remaining={sub.hookahsRemaining}
                total={sub.plan.hookahCount}
                label="Кальяны"
              />
              {sub.plan.bonusHookahFruit > 0 && (
                <ProgressBar
                  remaining={sub.fruitHookahsRemaining}
                  total={sub.plan.bonusHookahFruit}
                  label="На фруктовой чаше (из общего количества)"
                />
              )}
            </div>

            {/* Boolean bonuses */}
            <div className="grid grid-cols-2 gap-3">
              <BoolCard
                label="Кальян за 350 RSD"
                available={sub.cheapHookahAvailable && sub.hookahsRemaining === 0}
                locked={sub.hookahsRemaining > 0}
                lockedHint="Откроется в конце"
              />
              <BoolCard
                label="Электронная чаша"
                available={sub.electricAvailable}
                unavailableHint="Доступна в последнем уровне подписки"
              />
            </div>

            {/* Staff note */}
            {sub.note && (
              <div className="bg-accent/10 border border-accent/20 rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Заметка персонала</p>
                <p className="text-sm text-foreground">{sub.note}</p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3">
            <p className="text-muted-foreground text-sm">У вас пока нет активной подписки</p>
            <button
              data-testid="button-view-plans"
              onClick={() => setLocation("/plans")}
              className="text-primary text-sm font-medium underline underline-offset-2"
            >
              Посмотреть планы
            </button>
          </div>
        )}

        {/* Loyalty card */}
        <LoyaltyCard stamps={user.loyaltyStamps} totalRedeemed={user.loyaltyTotalRedeemed} />

        {/* Menu */}
        <a
          href="https://rodina.bar/menueng"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between bg-card border border-border rounded-2xl px-5 py-4 active:opacity-80 transition-opacity"
        >
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Rodina Bar</p>
            <p className="font-semibold text-foreground mt-0.5">Меню 🍽</p>
          </div>
          <span className="text-muted-foreground text-lg">→</span>
        </a>

        {/* Reviews */}
        <div className="bg-card border border-border rounded-2xl px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Нравится у нас? Оставьте отзыв</p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://www.google.com/maps/place/Rodina+bar/@44.8280279,20.4541935,17z/data=!4m8!3m7!1s0x475a652444a672d5:0x6061ba1274c387f7!8m2!3d44.8280279!4d20.4541935!9m1!1b1!16s%2Fg%2F11w8zbghnl?entry=ttu&g_ep=EgoyMDI2MDUzMS4wIKXMDSoASAFQAw%3D%3D"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-muted rounded-xl py-3 text-sm font-medium text-foreground active:opacity-70 transition-opacity"
            >
              <span>🗺</span> Google Maps
            </a>
            <button
              onClick={() => {
                const url = "https://yandex.ru/maps/org/236461535280/";
                const tg = (window as Window & { Telegram?: { WebApp?: { openLink?: (url: string) => void } } }).Telegram?.WebApp;
                if (tg?.openLink) {
                  tg.openLink(url);
                } else {
                  window.open(url, "_blank");
                }
              }}
              className="flex items-center justify-center gap-2 bg-muted rounded-xl py-3 text-sm font-medium text-foreground active:opacity-70 transition-opacity"
            >
              <span>🗺</span> Яндекс
            </button>
          </div>
        </div>

        {/* Guest note */}
        <div className="bg-card border border-border rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Моя заметка</p>
            <span className="text-xs text-muted-foreground">
              {note.length}/300
              {noteSaved && <span className="text-primary ml-1">· сохранено</span>}
            </span>
          </div>
          <textarea
            value={note}
            onChange={(e) => handleNoteChange(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Стоп-вкусы, любимый микс, пожелания..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
      </div>
    </div>
  );
}
