import { useLocation, Link } from "wouter";
import { Home, List, User, ShieldCheck } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

export default function BottomNav() {
  const [location] = useLocation();
  const { data: user } = useGetMe();

  const isAdmin = user?.role === "admin" || user?.role === "staff";

  const links = [
    { href: "/dashboard", label: "Главная", icon: Home },
    { href: "/plans", label: "Планы", icon: List },
    { href: "/profile", label: "Профиль", icon: User },
    ...(isAdmin ? [{ href: "/admin", label: "Админ", icon: ShieldCheck }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-card border-t border-border z-50">
      <div className="flex items-stretch">
        {links.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
