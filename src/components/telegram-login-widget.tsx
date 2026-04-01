"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TelegramWidgetUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

const telegramErrorMap: Record<string, string> = {
  account_exists: "Этот Telegram уже привязан к другому аккаунту.",
  telegram_failed: "Не удалось завершить вход через Telegram.",
};

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

export function TelegramLoginWidget() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();

  useEffect(() => {
    window.onTelegramAuth = async (user: TelegramWidgetUser) => {
      setError(null);

      try {
        const response = await fetch("/api/auth/telegram/callback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(user),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
          const message = data.code ? telegramErrorMap[data.code] : null;
          setError(message ?? data.error ?? "Не удалось войти через Telegram");
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } catch {
        setError("Сетевая ошибка при входе через Telegram");
      }
    };

    return () => {
      delete window.onTelegramAuth;
    };
  }, [router]);

  if (!botUsername) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-center">
        <Script
          src="https://telegram.org/js/telegram-widget.js?22"
          strategy="afterInteractive"
          data-telegram-login={botUsername}
          data-size="large"
          data-radius="8"
          data-userpic="false"
          data-request-access="write"
          data-onauth="onTelegramAuth(user)"
        />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
