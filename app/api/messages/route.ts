import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import {
  EXPIRY_OPTIONS,
  MAX_CONTENT_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  parseExpiry,
  passwordHashRounds,
  pickupCodeLength
} from "@/lib/config";
import { createUniquePickupCode } from "@/lib/codes";
import { createMessage, findPasswordOnlyMessages, pickupCodeExists } from "@/lib/db";
import { encryptContent } from "@/lib/encryption";
import { readJson } from "@/lib/request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await readJson(request);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "请求内容不是有效 JSON。" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content : "";
  const password = typeof body.password === "string" ? body.password : "";
  const expiry = parseExpiry(body.expiresIn);
  const burnAfterRead = body.burnAfterRead === true;
  const requirePickupCode = body.requirePickupCode !== false;

  if (content.trim().length === 0) {
    return NextResponse.json({ error: "请输入需要保存的内容。" }, { status: 400 });
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `内容不能超过 ${MAX_CONTENT_LENGTH} 个字符。` },
      { status: 400 }
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `密码长度需在 ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} 个字符之间。` },
      { status: 400 }
    );
  }

  if (!requirePickupCode) {
    const activePasswordOnlyMessages = findPasswordOnlyMessages();
    for (const message of activePasswordOnlyMessages) {
      if (message.burnAfterRead && message.readAt) {
        continue;
      }

      if (await bcrypt.compare(password, message.passwordHash)) {
        return NextResponse.json(
          { error: "同密码的免取件码内容仍有效，请开启取件码或更换密码。" },
          { status: 409 }
        );
      }
    }
  }

  const pickupCode = requirePickupCode
    ? await createUniquePickupCode(pickupCodeLength(), async (code) => pickupCodeExists(code))
    : null;

  const passwordHash = await bcrypt.hash(password, passwordHashRounds());
  const encrypted = await encryptContent(content, password);
  const expiresAt = new Date(Date.now() + EXPIRY_OPTIONS[expiry].ms);

  const message = createMessage({
    pickupCode,
    requirePickupCode,
    ...encrypted,
    passwordHash,
    expiresAt,
    burnAfterRead
  });

  if (!message) {
    return NextResponse.json({ error: "创建失败，请稍后再试。" }, { status: 500 });
  }

  return NextResponse.json(
    {
      pickupCode: message.pickupCode,
      pickupPath: message.pickupCode ? `/read?code=${message.pickupCode}` : "/read",
      requirePickupCode: message.requirePickupCode,
      expiresAt: message.expiresAt.toISOString(),
      burnAfterRead: message.burnAfterRead
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
