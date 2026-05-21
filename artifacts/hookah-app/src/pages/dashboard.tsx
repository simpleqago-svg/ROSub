import { useGetMe, useGetMySubscription } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

function StatCard({ label, value, available }: { label: string; value: string | number; available?: boolean }) {
  const isBoolean = typeof available !== "undefined";
  return (
    <div className={`bg-card border rounded-xl p-4 flex flex-col gap-1 ${isBoolean ? (available ? "border-primary/30" : "border-border") : "border-border"}`}>
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      {isBoolean ? (
        <span className={`font-semibold text-base ${available ? "text-primary" : "text-muted-foreground"}`}>
          {available ? "Доступно" : "Недоступно"}
        </span>
      ) : (
        <span className="font-bold text-2xl text-foreground">{value}</span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading, error: userError } = useGetMe();
  const { data: sub, isLoading: subLoading } = useGetMySubscription();

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
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
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
              value={String(user.id)}
              size={140}
              bgColor="#ffffff"
              fgColor="#1a1208"
              data-testid="img-qr-code"
            />
          </div>
          <p className="text-xs text-muted-foreground">ID: {user.id}</p>
        </div>

        {/* Subscription */}
        {subLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : sub ? (
          <>
            {/* Plan badge */}
            <div className="bg-primary/10 border border-primary/20 rounded-2xl px-5 py-4">
              <p className="text-xs text-primary/70 uppercase tracking-wide mb-1">Активная подписка</p>
              <h2 className="text-xl font-bold text-primary">{sub.plan.nameRu}</h2>
              <p className="text-sm text-muted-foreground">{sub.plan.nameRs}</p>
              {sub.activatedAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Активирована: {new Date(sub.activatedAt).toLocaleDateString("ru-RU")}
                </p>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Кальяны" value={`${sub.hookahsRemaining} шт`} />
              <StatCard label="На фруктовой чаше" value={`${sub.fruitHookahsRemaining} шт`} />
              <StatCard label="Калик за 350 RSD" available={sub.cheapHookahAvailable} value="" />
              <StatCard label="Электронная чаша" available={sub.electricAvailable} value="" />
            </div>

            {/* Staff note */}
            {sub.note && (
              <div className="bg-accent/10 border border-accent/20 rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Заметка от персонала</p>
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
      </div>
    </div>
  );
}
