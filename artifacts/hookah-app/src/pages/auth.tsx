import { useState } from "react";
import { useLocation } from "wouter";
import { useAuthTelegram } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

function getTelegramUser(): TelegramUser | null {
  const tg = (window as Window & { Telegram?: { WebApp?: { initDataUnsafe?: { user?: TelegramUser } } } }).Telegram;
  return tg?.WebApp?.initDataUnsafe?.user ?? null;
}

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const authMutation = useAuthTelegram();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const tgUser = getTelegramUser();

      if (!tgUser && !import.meta.env.DEV) {
        toast({ title: "Ошибка", description: "Откройте приложение через Telegram", variant: "destructive" });
        setLoading(false);
        return;
      }

      const userData = tgUser
        ? {
            telegramId: tgUser.id,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name ?? null,
            username: tgUser.username ?? null,
            photoUrl: tgUser.photo_url ?? null,
          }
        : {
            telegramId: 100001,
            firstName: "Гость (dev)",
            lastName: null,
            username: "dev_guest",
            photoUrl: null,
          };

      authMutation.mutate(
        { data: userData },
        {
          onSuccess: (response) => {
            localStorage.setItem("auth_token", response.token);
            setLocation("/dashboard");
          },
          onError: () => {
            toast({ title: "Ошибка входа", description: "Попробуйте ещё раз", variant: "destructive" });
            setLoading(false);
          },
        }
      );
    } catch {
      toast({ title: "Ошибка", description: "Что-то пошло не так", variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm space-y-8 relative z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 mb-2">
            <span className="text-4xl">🪔</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Hookah Club</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Ваш личный клубный кабинет.<br />
            Следите за подпиской и балансом.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <button
            data-testid="button-login-telegram"
            onClick={handleLogin}
            disabled={loading || authMutation.isPending}
            className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground font-semibold py-3.5 px-6 rounded-xl transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90"
          >
            {loading || authMutation.isPending ? (
              <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.03 9.57c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 14.803l-2.96-.924c-.643-.203-.657-.643.136-.953l11.563-4.456c.537-.194 1.006.131.833.778z"/>
              </svg>
            )}
            {loading || authMutation.isPending ? "Входим..." : "Войти через Telegram"}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Вход через ваш Telegram аккаунт. Безопасно и быстро.
          </p>
        </div>
      </div>
    </div>
  );
}
