import { logger } from "./lib/logger";

const TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const APP_URL = "https://russian-understand--simpleqago.replit.app/";

const BASE = `https://api.telegram.org/bot${TOKEN}`;

async function tgCall(method: string, body: object): Promise<void> {
  try {
    const res = await fetch(`${BASE}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn({ method, status: res.status, text }, "Telegram API error");
    }
  } catch (err) {
    logger.error({ err, method }, "Telegram API request failed");
  }
}

async function handleUpdate(update: {
  message?: {
    chat: { id: number };
    text?: string;
  };
}): Promise<void> {
  const msg = update.message;
  if (!msg) return;

  const text = msg.text ?? "";
  if (text.startsWith("/start")) {
    await tgCall("sendMessage", {
      chat_id: msg.chat.id,
      text: "Добро пожаловать в private membership.\n\nОткрой приложение, чтобы увидеть тариф, остатки и QR-код.",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Открыть приложение", web_app: { url: APP_URL } }],
        ],
      },
    });
  }
}

export async function startBot(): Promise<void> {
  if (!TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }

  logger.info("Telegram bot polling started");

  let offset = 0;

  const poll = async (): Promise<void> => {
    try {
      const res = await fetch(`${BASE}/getUpdates?timeout=25&offset=${offset}`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          ok: boolean;
          result: Array<{ update_id: number; message?: { chat: { id: number }; text?: string } }>;
        };
        if (data.ok) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            handleUpdate(update).catch((err) =>
              logger.error({ err }, "handleUpdate error")
            );
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name !== "TimeoutError") {
        logger.error({ err }, "Polling error");
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    setImmediate(poll);
  };

  poll().catch((err) => logger.error({ err }, "Bot poll crashed"));
}
