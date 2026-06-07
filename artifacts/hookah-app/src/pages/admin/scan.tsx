import {
  useAdminUseHookah,
  useAdminUseFruit,
  useAdminUseCheap,
  useAdminUseElectric,
  useAdminGetUserByCode,
  getAdminGetUserByCodeQueryKey,
  getAdminGetUsersQueryKey,
  getAdminGetStatsQueryKey,
  useAdminAddLoyaltyStamp,
  useAdminRedeemLoyalty,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import BackButton from "@/components/back-button";
import { useRef, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Html5Qrcode } from "html5-qrcode";
import { Lock } from "lucide-react";

type ScannedState = { code: string } | null;

export default function AdminScanPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<ScannedState>(null);
  const [manualId, setManualId] = useState("");

  const useHookahMutation = useAdminUseHookah();
  const useFruitMutation = useAdminUseFruit();
  const useCheapMutation = useAdminUseCheap();
  const useElectricMutation = useAdminUseElectric();
  const addStampMutation = useAdminAddLoyaltyStamp();
  const redeemLoyaltyMutation = useAdminRedeemLoyalty();

  const { data: guestData } = useAdminGetUserByCode(scanned?.code ?? "", {
    query: {
      enabled: !!scanned?.code,
      queryKey: getAdminGetUserByCodeQueryKey(scanned?.code ?? ""),
    },
  });

  const invalidate = () => {
    if (!scanned?.code) return;
    queryClient.invalidateQueries({ queryKey: getAdminGetUserByCodeQueryKey(scanned.code) });
    queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
  };

  const doAction = (
    mutation: typeof useHookahMutation,
    label: string
  ) => {
    if (!guestData) return;
    mutation.mutate(
      { userId: guestData.id },
      {
        onSuccess: () => {
          toast({ title: label, description: "Успешно списано" });
          invalidate();
        },
        onError: (err) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Ошибка";
          toast({ title: "Ошибка", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;
      setScanning(true);
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          const code = decodedText.trim().toUpperCase();
          if (code.length >= 4) {
            html5QrCode.stop().catch(() => {});
            scannerRef.current = null;
            setScanning(false);
            setScanned({ code });
          }
        },
        () => {}
      );
    } catch {
      setScanning(false);
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  const resetScan = () => {
    setScanned(null);
    setManualId("");
    setTimeout(() => startScanner(), 100);
  };

  const handleManual = () => {
    const code = manualId.trim().toUpperCase();
    if (code.length >= 4) {
      setScanned({ code });
      setManualId("");
    }
  };

  const sub = guestData?.subscription;
  const isPending = useHookahMutation.isPending || useFruitMutation.isPending || useCheapMutation.isPending || useElectricMutation.isPending;
  const loyaltyPending = addStampMutation.isPending || redeemLoyaltyMutation.isPending;
  const cheapLocked = sub ? sub.hookahsRemaining > 0 : false;
  const cheapAvailableDisplay = sub ? (sub.cheapHookahAvailable && sub.hookahsRemaining === 0) : false;

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <BackButton data-testid="button-back-admin-scan" onClick={() => setLocation("/admin")} />
        <h1 className="text-xl font-bold text-foreground">Сканировать QR</h1>
        <p className="text-sm text-muted-foreground">
          {scanned ? `Код: ${scanned.code}` : "Наведите на QR-код гостя"}
        </p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* QR scanner */}
        {!scanned && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div id="qr-reader" className="w-full" />
            {!scanning && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Камера не запущена или нет доступа
              </div>
            )}
          </div>
        )}

        {/* Scan result */}
        {scanned && (
          <>
            {/* Guest info + note */}
            {guestData ? (
              <div className="bg-card border border-border rounded-xl px-4 py-3 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Гость</p>
                  <p className="font-bold text-foreground text-base">
                    {guestData.firstName} {guestData.lastName ?? ""}
                  </p>
                  {guestData.username && <p className="text-xs text-muted-foreground">@{guestData.username}</p>}
                </div>
                {guestData.note && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                    <p className="text-xs text-primary mb-0.5">Заметка гостя</p>
                    <p className="text-sm text-foreground">{guestData.note}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
                {scanned.code ? "Гость не найден..." : "Загрузка..."}
              </div>
            )}

            {/* Subscription balance */}
            {sub ? (
              <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Подписка</p>
                  <p className="font-bold text-primary">{sub.plan.nameRu}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-background rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">Кальяны</p>
                    <p className="font-bold">{sub.hookahsRemaining} / {sub.plan.hookahCount}</p>
                  </div>
                  {sub.plan.bonusHookahFruit > 0 && (
                    <div className="bg-background rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">Фруктовых</p>
                      <p className="font-bold">{sub.fruitHookahsRemaining} / {sub.plan.bonusHookahFruit}</p>
                    </div>
                  )}
                  <div className={`bg-background rounded-lg px-3 py-2 ${cheapAvailableDisplay ? "border border-primary/20" : ""}`}>
                    <p className="text-xs text-muted-foreground">350 RSD кальян</p>
                    {cheapLocked ? (
                      <div className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">В конце</p>
                      </div>
                    ) : (
                      <p className={`font-bold text-sm ${cheapAvailableDisplay ? "text-primary" : "text-muted-foreground"}`}>
                        {cheapAvailableDisplay ? "Доступен" : "Использован"}
                      </p>
                    )}
                  </div>
                  <div className={`bg-background rounded-lg px-3 py-2 ${sub.electricAvailable ? "border border-primary/20" : ""}`}>
                    <p className="text-xs text-muted-foreground">Эл. чаша</p>
                    <p className={`font-bold text-sm ${sub.electricAvailable ? "text-primary" : "text-muted-foreground"}`}>
                      {sub.electricAvailable ? "Доступна" : "Использована"}
                    </p>
                  </div>
                </div>
              </div>
            ) : guestData && (
              <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
                Нет активной подписки
              </div>
            )}

            {/* Action buttons */}
            {sub && guestData && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Списать</p>
                <button
                  data-testid="button-use-hookah"
                  onClick={() => doAction(useHookahMutation, "Кальян списан")}
                  disabled={isPending || sub.hookahsRemaining <= 0}
                  className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold disabled:opacity-40"
                >
                  🌿 Кальян {sub.hookahsRemaining <= 0 ? "(нет)" : `(осталось ${sub.hookahsRemaining})`}
                </button>
                {sub.plan.bonusHookahFruit > 0 && (
                  <button
                    data-testid="button-use-fruit"
                    onClick={() => doAction(useFruitMutation, "Фрукт списан")}
                    disabled={isPending || sub.fruitHookahsRemaining <= 0 || sub.hookahsRemaining <= 0}
                    className="w-full bg-primary/20 text-primary border border-primary/30 rounded-xl py-3 font-semibold disabled:opacity-40"
                  >
                    🍉 Фрукт (−1 кальян и −1 фруктовый)
                    {sub.fruitHookahsRemaining <= 0 ? " (нет)" : ` (ост. ${sub.fruitHookahsRemaining})`}
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    data-testid="button-use-cheap"
                    onClick={() => doAction(useCheapMutation, "350 RSD кальян списан")}
                    disabled={isPending || !cheapAvailableDisplay}
                    className="bg-secondary text-secondary-foreground rounded-xl py-3 font-semibold disabled:opacity-40"
                  >
                    💰 350 RSD
                  </button>
                  <button
                    data-testid="button-use-electric"
                    onClick={() => doAction(useElectricMutation, "Эл. чаша списана")}
                    disabled={isPending || !sub.electricAvailable}
                    className="bg-secondary text-secondary-foreground rounded-xl py-3 font-semibold disabled:opacity-40"
                  >
                    ⚡ Эл. чаша
                  </button>
                </div>
              </div>
            )}

            {/* Loyalty stamp — only for guests WITHOUT an active subscription */}
            {guestData && !sub && (() => {
              const stamps = guestData.loyaltyStamps ?? 0;
              const ready = stamps >= 10;
              return (
                <div className={`bg-card border rounded-xl p-4 space-y-2 ${ready ? "border-primary/40" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Карта лояльности</p>
                    <span className={`text-sm font-semibold ${ready ? "text-primary" : "text-foreground"}`}>
                      {ready ? "🎉 Готова к погашению!" : `${stamps} / 10 🌿`}
                    </span>
                  </div>
                  {/* stamp grid */}
                  <div className="grid grid-cols-10 gap-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={`aspect-square rounded-full flex items-center justify-center text-[10px] ${
                          i < stamps ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground/30"
                        }`}
                      >
                        {i < stamps ? "🌿" : "·"}
                      </div>
                    ))}
                  </div>
                  {ready ? (
                    <button
                      onClick={() =>
                        redeemLoyaltyMutation.mutate(
                          { userId: guestData.id },
                          {
                            onSuccess: () => {
                              toast({ title: "🎉 Карта погашена!", description: "Кальян за 350 RSD — марки сброшены" });
                              invalidate();
                            },
                            onError: (e) => {
                              const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Ошибка";
                              toast({ title: "Ошибка", description: msg, variant: "destructive" });
                            },
                          }
                        )
                      }
                      disabled={loyaltyPending}
                      className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
                    >
                      {redeemLoyaltyMutation.isPending ? "Погашаем..." : "🎉 Погасить — кальян за 350 RSD"}
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        addStampMutation.mutate(
                          { userId: guestData.id },
                          {
                            onSuccess: () => {
                              toast({ title: "Марка добавлена", description: `${Math.min(stamps + 1, 10)}/10` });
                              invalidate();
                            },
                            onError: () => toast({ title: "Ошибка", variant: "destructive" }),
                          }
                        )
                      }
                      disabled={loyaltyPending}
                      className="w-full bg-primary/10 text-primary border border-primary/20 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
                    >
                      {addStampMutation.isPending ? "Добавляем..." : "🌿 +1 марка за посещение"}
                    </button>
                  )}
                </div>
              );
            })()}

            <button
              onClick={resetScan}
              className="w-full bg-primary/10 text-primary border border-primary/20 rounded-xl py-2.5 text-sm font-medium"
            >
              Сканировать ещё
            </button>
          </>
        )}

        {/* Manual input */}
        {!scanned && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ввести код вручную</p>
            <div className="flex gap-2">
              <input
                data-testid="input-manual-user-id"
                type="text"
                placeholder="Код гостя (6 символов)..."
                value={manualId}
                onChange={(e) => setManualId(e.target.value.toUpperCase())}
                maxLength={8}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary uppercase tracking-widest"
              />
              <button
                data-testid="button-manual-redeem"
                onClick={handleManual}
                disabled={manualId.trim().length < 4}
                className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                Найти
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
