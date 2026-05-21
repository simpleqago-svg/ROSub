# Hookah Club

Telegram Mini App для управления подпиской кальянного клуба. Гости видят свой баланс и QR-код, персонал управляет подписками через мини-админку.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/hookah-app run dev` — run the frontend (port 24071)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (dark amber theme), wouter routing
- API: Express 5, JWT auth
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- QR: `qrcode.react` (display), `html5-qrcode` (scan)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/db/src/schema/` — DB schema (users, subscription_plans, user_subscriptions)
- `artifacts/api-server/src/routes/` — auth.ts, subscriptions.ts, admin.ts
- `artifacts/api-server/src/lib/auth.ts` — JWT sign/verify, requireAuth/requireAdmin middleware
- `artifacts/hookah-app/src/pages/` — auth, dashboard, plans, profile, admin/*
- `artifacts/hookah-app/src/lib/api.ts` — sets auth token getter for API client

## Architecture decisions

- JWT tokens stored in localStorage, passed via Authorization: Bearer header
- Auth via Telegram WebApp initDataUnsafe (falls back to mock user in dev/browser)
- No payment integration — staff activates subscriptions manually in admin panel
- Admin role check: role === "staff" || role === "admin"
- Subscription activation deactivates previous active subscription first
- Plans seeded at startup: 4 levels (8/14/20/26 hookahs)

## Product

- **Гость**: войти через Telegram → видеть QR-код → смотреть баланс (кальяны, фруктовые, 350 RSD, электронная чаша)
- **Персонал**: сканировать QR → списать кальян → управлять подписками гостей → смотреть статистику
- **Подписки**: 4 уровня — Добро пожаловать / Тебе как всегда? / Ну рассказывай / Да ты легенда!

## User preferences

- Русский язык для общения
- Оплата только наличными на месте, не упоминать про оплату в UI
- Дизайн: простой но привлекательный, тёмная тема с янтарным акцентом

## Gotchas

- После изменения openapi.yaml обязательно запускать codegen перед изменением backend routes
- Первый администратор создаётся вручную через SQL: `UPDATE users SET role = 'admin' WHERE telegram_id = <id>;`
- Для Telegram WebApp нужно добавить скрипт `<script src="https://telegram.org/js/telegram-web-app.js">` в index.html если деплоишь как TG Mini App

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
