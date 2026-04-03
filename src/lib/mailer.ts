import nodemailer from "nodemailer";

type ResetEmailInput = {
  to: string;
  resetUrl: string;
  expiresAtIso: string;
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "Репетитор Бутакова <no-reply@ege.local>";

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "1" || port === 465,
    auth: { user, pass },
    from,
  };
}

export function isSmtpConfigured() {
  return getSmtpConfig() !== null;
}

export async function sendPasswordResetEmail(input: ResetEmailInput) {
  const config = getSmtpConfig();
  if (!config) {
    return { sent: false as const, reason: "smtp_not_configured" as const };
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  await transport.sendMail({
    from: config.from,
    to: input.to,
    subject: "Восстановление пароля — Репетитор Бутакова",
    text: [
      "Вы запросили смену пароля.",
      `Ссылка: ${input.resetUrl}`,
      `Ссылка действует до: ${input.expiresAtIso}`,
      "Если это были не вы, просто проигнорируйте письмо.",
    ].join("\n"),
    html: `
      <p>Вы запросили смену пароля.</p>
      <p><a href="${input.resetUrl}">Сбросить пароль</a></p>
      <p>Ссылка действует до: ${input.expiresAtIso}</p>
      <p>Если это были не вы, просто проигнорируйте письмо.</p>
    `,
  });

  return { sent: true as const };
}
