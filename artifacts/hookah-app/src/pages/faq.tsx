import { useLocation } from "wouter";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import BackButton from "@/components/back-button";

type FaqItem = { q: string; a: string | ReactNode };

const SECTIONS: { title: string; emoji: string; items: FaqItem[] }[] = [
  {
    title: "Что такое RodinaSub?",
    emoji: "🪄",
    items: [
      {
        q: "Как работает подписка?",
        a: "RodinaSub — это пакет кальянов на 30 дней по выгодной цене. Ты платишь один раз и просто приходишь: мы списываем кальян с твоего баланса. Никаких лишних слов.",
      },
      {
        q: "Как воспользоваться подпиской?",
        a: "Покажи QR-код из раздела «Главная» сотруднику — и всё. Он сам всё спишет.",
      },
      {
        q: "Сколько действует подписка?",
        a: "30 дней с момента активации. Неиспользованные кальяны после окончания срока сгорают.",
      },
    ],
  },
  {
    title: "Тарифы",
    emoji: "📋",
    items: [
      {
        q: "Добро пожаловать / DOBRODOSLI! — 15 900 RSD",
        a: (
          <div className="space-y-2 text-sm text-foreground/80">
            <ul className="space-y-1">
              <li>🌿 8 кальянов</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-1">После окончания подписки</p>
            <ul className="space-y-1">
              <li>💰 Кальян за 350 RSD</li>
            </ul>
          </div>
        ),
      },
      {
        q: "Тебе как всегда? / GDE SI KOMSIJA? — 22 900 RSD",
        a: (
          <div className="space-y-2 text-sm text-foreground/80">
            <ul className="space-y-1">
              <li>🌿 12 кальянов</li>
              <li>🍉 1 кальян на фруктовой чаше (входит в общий счёт)</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-1">После окончания подписки</p>
            <ul className="space-y-1">
              <li>💰 Кальян за 350 RSD</li>
            </ul>
          </div>
        ),
      },
      {
        q: "Ну рассказывай / SAMO RECI — 29 300 RSD",
        a: (
          <div className="space-y-2 text-sm text-foreground/80">
            <ul className="space-y-1">
              <li>🌿 16 кальянов</li>
              <li>🍉 До 4 кальянов на фруктовой чаше (входят в общий счёт)</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-1">После окончания подписки</p>
            <ul className="space-y-1">
              <li>💰 Кальян за 350 RSD</li>
            </ul>
          </div>
        ),
      },
      {
        q: "Да ты легенда! / SVE ZA TEBE — 35 300 RSD",
        a: (
          <div className="space-y-2 text-sm text-foreground/80">
            <ul className="space-y-1">
              <li>🌿 20 кальянов</li>
              <li>🍉 До 4 кальянов на фруктовой чаше (входят в общий счёт)</li>
              <li>⚡ 1 кальян на электронной чаше (не списывается из лимита)</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-1">После окончания подписки</p>
            <ul className="space-y-1">
              <li>💰 Кальян за 350 RSD</li>
            </ul>
          </div>
        ),
      },
    ],
  },
  {
    title: "Бонусы",
    emoji: "🎁",
    items: [
      {
        q: "Что такое кальян на фруктовой чаше?",
        a: "Фруктовая чаша — это особый вид подачи с натуральными фруктами. Он стоит дороже обычного, но в рамках подписки входит в пакет. Учти: фруктовый кальян списывает 1 позицию из основного лимита.",
      },
      {
        q: "Что такое электронная чаша?",
        a: "Электронная чаша доступна только в тарифе «Да ты легенда!». Это 1 визит с электронной чашей за всю подписку — и он не тратит кальян из твоего лимита.",
      },
      {
        q: "Что такое кальян за 350 RSD?",
        a: "После того как подписка закончится (вышли кальяны или прошло 30 дней), ты получаешь право на 1 кальян за 350 RSD. Действует 7 дней. Только 1 раз. Скажи сотруднику — он проверит.",
      },
    ],
  },
  {
    title: "Цены и оплата",
    emoji: "💵",
    items: [
      {
        q: "Сколько стоит кальян без подписки?",
        a: "Стандартная цена — 2 600 RSD. Подписка позволяет сэкономить от 600 до 800 RSD на каждом кальяне.",
      },
      {
        q: "Как оплатить подписку?",
        a: "Только наличными на месте. Оформляет старший кальянщик или администратор.",
      },
      {
        q: "Можно ли вернуть деньги?",
        a: "Подписка не возвращается и не переносится.",
      },
    ],
  },
  {
    title: "Остальное",
    emoji: "❓",
    items: [
      {
        q: "Что если кальяны закончились до конца 30 дней?",
        a: "Подписка считается использованной. Можно оформить новую или заказывать кальяны по стандартной цене.",
      },
      {
        q: "Можно ли шэрить подписку с друзьями?",
        a: "Да! Подписка не привязана к конкретному человеку — кальяны из твоего пакета могут курить и твои друзья. Просто покажи свой QR-код сотруднику, и он спишет кальян с твоего баланса.",
      },
      {
        q: "Что если я хочу оформить подписку?",
        a: "Подойди к старшему кальянщику или администратору. Обычный персонал не оформляет подписку — только расскажет о ней.",
      },
    ],
  },
];

function FaqSection({ title, emoji, items }: typeof SECTIONS[0]) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wide px-1">
        {emoji} {title}
      </p>
      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
        {items.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
            >
              <span className="text-sm font-medium text-foreground">{item.q}</span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`}
              />
            </button>
            {open === i && (
              <div className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FaqPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <BackButton onClick={() => setLocation("/profile")} />
        <h1 className="text-xl font-bold text-foreground">Как это работает</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Всё о подписке RodinaSub</p>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {SECTIONS.map((section) => (
          <FaqSection key={section.title} {...section} />
        ))}

        <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 text-center">
          <p className="text-sm text-foreground font-medium">Остались вопросы?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Спроси у персонала — они всё объяснят.
          </p>
        </div>
      </div>
    </div>
  );
}
