import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import DashboardPage from "@/pages/dashboard";
import PlansPage from "@/pages/plans";
import ProfilePage from "@/pages/profile";
import AdminPage from "@/pages/admin/index";
import AdminUsersPage from "@/pages/admin/users";
import AdminUserDetailPage from "@/pages/admin/user-detail";
import AdminScanPage from "@/pages/admin/scan";
import AdminActivityPage from "@/pages/admin/activity";
import AdminStaffPage from "@/pages/admin/staff";
import AdminSubscriptionsPage from "@/pages/admin/subscriptions";
import FaqPage from "@/pages/faq";
import BottomNav from "@/components/bottom-nav";
import { useLocation } from "wouter";
import { useEffect } from "react";

import "@/lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AppRoutes() {
  const [location] = useLocation();
  const token = localStorage.getItem("auth_token");
  const showNav = token && location !== "/";

  return (
    <>
      <Switch>
        <Route path="/" component={AuthPage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/plans" component={PlansPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/admin/users" component={AdminUsersPage} />
        <Route path="/admin/users/:userId" component={AdminUserDetailPage} />
        <Route path="/admin/scan" component={AdminScanPage} />
        <Route path="/admin/activity" component={AdminActivityPage} />
        <Route path="/admin/staff" component={AdminStaffPage} />
        <Route path="/admin/subscriptions" component={AdminSubscriptionsPage} />
        <Route path="/faq" component={FaqPage} />
        <Route component={NotFound} />
      </Switch>
      {showNav && <BottomNav />}
    </>
  );
}

function App() {
  useEffect(() => {
    const tg = (window as Window & { Telegram?: { WebApp?: { setBottomBarColor?: (c: string) => void; setHeaderColor?: (c: string) => void } } }).Telegram?.WebApp;
    if (tg) {
      tg.setBottomBarColor?.("#0d0d0d");
      tg.setHeaderColor?.("#0d0d0d");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
