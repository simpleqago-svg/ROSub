import { useAdminUseHookah, getAdminGetUserQueryKey, getAdminGetUsersQueryKey, getAdminGetStatsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useRef, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Html5Qrcode } from "html5-qrcode";

export default function AdminScanPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{ userId: number; success: boolean; message: string } | null>(null);
  const [manualId, setManualId] = useState("");
  const useHookahMutation = useAdminUseHookah();

  const redeemHookah = (userId: number) => {
    useHookahMutation.mutate(
      { userId },
      {
        onSuccess: (sub) => {
          setLastResult({ userId, success: true, message: `Кальян списан! Осталось: ${sub.hookahsRemaining}` });
          toast({ title: "Кальян списан", description: `Осталось ${sub.hookahsRemaining} шт.` });
          queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
          queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
        },
        onError: (err) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Ошибка списания";
          setLastResult({ userId, success: false, message: msg });
          toast({ title: "Ошибка", description: msg, variant: "destructive" });
        },
      }
    );
  };

  useEffect(() => {
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
              redeemHookah(userId);
            }
          },
          () => {}
        );
      } catch {
        setScanning(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleManualSubmit = () => {
    const userId = parseInt(manualId, 10);
    if (!isNaN(userId) && userId > 0) {
      redeemHookah(userId);
      setManualId("");
    }
  };

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
        <p className="text-sm text-muted-foreground">Списание кальяна по QR-коду гостя</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* QR Scanner */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div id="qr-reader" className="w-full" />
          {!scanning && !useHookahMutation.isPending && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Камера не запущена или нет доступа
            </div>
          )}
        </div>

        {/* Result */}
        {lastResult && (
          <div className={`rounded-xl px-4 py-3 border ${lastResult.success ? "bg-primary/10 border-primary/20 text-primary" : "bg-destructive/10 border-destructive/20 text-destructive"}`}>
            <p className="font-semibold text-sm">
              {lastResult.success ? "Успешно" : "Ошибка"}
            </p>
            <p className="text-sm opacity-80">{lastResult.message}</p>
            {lastResult.success && (
              <button
                data-testid="button-view-user-after-scan"
                onClick={() => setLocation(`/admin/users/${lastResult.userId}`)}
                className="text-xs underline mt-1"
              >
                Открыть профиль гостя
              </button>
            )}
          </div>
        )}

        {/* Manual input */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Ввести вручную</p>
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
              onClick={handleManualSubmit}
              disabled={!manualId || useHookahMutation.isPending}
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {useHookahMutation.isPending ? "..." : "Списать"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
