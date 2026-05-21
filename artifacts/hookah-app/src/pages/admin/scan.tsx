import {
  useAdminUseHookah,
  useAdminUseFruit,
  useAdminUseCheap,
  useAdminUseElectric,
  useAdminGetUser,
  getAdminGetUserQueryKey,
  getAdminGetUsersQueryKey,
  getAdminGetStatsQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useRef, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Html5Qrcode } from "html5-qrcode";

type ScannedState = { userId: number } | null;

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

  const { data: guestData } = useAdminGetUser(scanned?.userId ?? 0, {
    query: { enabled: !!scanned?.userId, queryKey: getAdminGetUserQueryKey(scanned?.userId ?? 0) },
  });

  const invalidate = (userId: number) => {
    queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
    queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
  };

  const doAction = (
    mutation: typeof useHookahMutation,
    userId: number,
    label: string
  ) => {
    mutation.mutate(
      { userId },
      {
        onSuccess: () => {
          toast({ title: label, description: "Успешно списано" });
          invalidate(userId);
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
          const userId = parseInt(decodedText, 10);
          if (!isNaN(userId) && userId > 0) {
            html5QrCode.stop().catch(() => {});
            setScanning(false);
            setScanned({ userId });
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
    return () => { scannerRef.current?.stop().catch(() => {}); };
  }, []);

  const resetScan = () => {
    setScanned(null);
    setManualId("");
    startScanner();
  };

  const handleManual = () => {
    const userId = parseInt(manualId, 10);
    if (!isNaN(userId) && userId > 0) {
      setScanned({ userId });
      setManualId("");
    }
  };

  const sub = guestData?.subscription;
  const isPending = useHookahMutation.isPending || useFruitMutation.isPending || useCheapMutation.isPending || useElectricMutation.isPending;

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <button
          data-testid="button-back-admin-scan"
          onClick={() => setLocation("/admin")}
          className="text-xs text-muted-foreground mb-2 flex items-center gap-1"
        >
          ← Назад
        </button>
        <h1 className="text-xl font-bold text-foreground">Сканировать QR</h1>
        <p className="text-sm text-muted-foreground">
          {scanned ? `Гость ID: ${scanned.userId}` : "Наведите на QR-код гостя"}
        </p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* QR scanner — hidden once scanned */}
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

        {/* After scan: show action panel */}
        {scanned && (
          <>
            {/* Guest info */}
            {guestData && (
              <div className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground">Гость</p>
                <p className="font-bold text-foreground text-base">
                  {guestData.firstName} {guestData.lastName ?? ""}
                </p>
                {guestData.username && <p className="text-xs text-muted-foreground">@{guestData.username}</p>}
                {guestData.note && (
                  <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-400 mb-0.5">Заметка гостя</p>
                    <p className="text-sm text-foreground">{guestData.note}</p>
                  </div>
                )}
              </div>
            )}

            {/* Subscription summary */}
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
                  <div className={`bg-background rounded-lg px-3 py-2 ${sub.cheapHookahAvailable ? "border border-primary/20" : ""}`}>
                    <p className="text-xs text-muted-foreground">350 RSD кальян</p>
                    <p className={`font-bold text-sm ${sub.cheapHookahAvailable ? "text-primary" : "text-muted-foreground"}`}>
                      {sub.cheapHookahAvailable ? "Доступен" : "Использован"}
                    </p>
                  </div>
                  <div className={`bg-background rounded-lg px-3 py-2 ${sub.electricAvailable ? "border border-primary/20" : ""}`}>
                    <p className="text-xs text-muted-foreground">Эл. чаша</p>
                    <p className={`font-bold text-sm ${sub.electricAvailable ? "text-primary" : "text-muted-foreground"}`}>
                      {sub.electricAvailable ? "Доступна" : "Использована"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
                Нет активной подписки
              </div>
            )}

            {/* Action buttons */}
            {sub && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Списать</p>
                <button
                  data-testid="button-use-hookah"
                  onClick={() => doAction(useHookahMutation, scanned.userId, "Кальян списан")}
                  disabled={isPending || sub.hookahsRemaining <= 0}
                  className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold disabled:opacity-40"
                >
                  🌿 Списать 1 кальян {sub.hookahsRemaining <= 0 ? "(нет)" : `(осталось ${sub.hookahsRemaining})`}
                </button>
                {sub.plan.bonusHookahFruit > 0 && (
                  <button
                    data-testid="button-use-fruit"
                    onClick={() => doAction(useFruitMutation, scanned.userId, "Фрукт списан")}
                    disabled={isPending || sub.fruitHookahsRemaining <= 0}
                    className="w-full bg-amber-600 text-white rounded-xl py-3 font-semibold disabled:opacity-40"
                  >
                    🍉 Списать фрукт {sub.fruitHookahsRemaining <= 0 ? "(нет)" : `(осталось ${sub.fruitHookahsRemaining})`}
                  </button>
                )}
                <button
                  data-testid="button-use-cheap"
                  onClick={() => doAction(useCheapMutation, scanned.userId, "350 RSD кальян списан")}
                  disabled={isPending || !sub.cheapHookahAvailable}
                  className="w-full bg-zinc-700 text-white rounded-xl py-3 font-semibold disabled:opacity-40"
                >
                  💰 Списать 350 RSD кальян {!sub.cheapHookahAvailable ? "(использован)" : ""}
                </button>
                <button
                  data-testid="button-use-electric"
                  onClick={() => doAction(useElectricMutation, scanned.userId, "Электронная чаша списана")}
                  disabled={isPending || !sub.electricAvailable}
                  className="w-full bg-zinc-700 text-white rounded-xl py-3 font-semibold disabled:opacity-40"
                >
                  ⚡ Списать электронную чашу {!sub.electricAvailable ? "(использована)" : ""}
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setLocation(`/admin/users/${scanned.userId}`)}
                className="flex-1 bg-card border border-border text-foreground rounded-xl py-2.5 text-sm font-medium"
              >
                Открыть профиль
              </button>
              <button
                onClick={resetScan}
                className="flex-1 bg-primary/10 text-primary border border-primary/20 rounded-xl py-2.5 text-sm font-medium"
              >
                Сканировать ещё
              </button>
            </div>
          </>
        )}

        {/* Manual input */}
        {!scanned && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ввести ID вручную</p>
            <div className="flex gap-2">
              <input
                data-testid="input-manual-user-id"
                type="number"
                placeholder="ID гостя..."
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                data-testid="button-manual-redeem"
                onClick={handleManual}
                disabled={!manualId}
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
