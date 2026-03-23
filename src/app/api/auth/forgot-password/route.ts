import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    message: "Для MVP письмо не отправляется. В production подключается SMTP/почтовый сервис.",
  });
}
