import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH
} from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp, normalizePickupCode, readJson } from "@/lib/request";
import {
  deleteMessage,
  findMessageByPickupCode,
  findPasswordOnlyMessages,
  markMessageRead,
  type SecretMessage
} from "@/lib/db";
import { decryptContent } from "@/lib/encryption";

export const runtime = "nodejs";

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      error,
      ...extra
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(request: NextRequest) {
  const body = await readJson(request);

  if (!body || typeof body !== "object") {
    return jsonError("请求内容不是有效 JSON。", 400);
  }

  const pickupCode = normalizePickupCode(body.pickupCode);
  const password = typeof body.password === "string" ? body.password : "";

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return jsonError(`密码长度需在 ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} 个字符之间。`, 400);
  }

  const rateKey = pickupCode ? pickupCode : "password-only";
  const rate = checkRateLimit(`read:${clientIp(request)}:${rateKey}`);
  if (!rate.allowed) {
    return jsonError("尝试次数过多，请稍后再试。", 429, {
      retryAfterSeconds: rate.retryAfterSeconds
    });
  }

  let message: SecretMessage | null = null;
  if (pickupCode) {
    message = findMessageByPickupCode(pickupCode);
  } else {
    const passwordOnlyMessages = findPasswordOnlyMessages();
    for (const candidate of passwordOnlyMessages) {
      if (candidate.burnAfterRead && candidate.readAt) {
        continue;
      }

      if (await bcrypt.compare(password, candidate.passwordHash)) {
        message = candidate;
        break;
      }
    }
  }

  if (!message) {
    return jsonError(
      pickupCode ? "取件码不存在。" : "密码不正确，或免取件码内容不存在。",
      pickupCode ? 404 : 401,
      { remainingAttempts: rate.remaining }
    );
  }

  if (message.expiresAt.getTime() <= Date.now()) {
    deleteMessage(message.id);
    return jsonError("内容已过期。", 410);
  }

  if (message.burnAfterRead && message.readAt) {
    return jsonError("内容已被读取并销毁。", 410);
  }

  const passwordOk = pickupCode ? await bcrypt.compare(password, message.passwordHash) : true;
  if (!passwordOk) {
    return jsonError("密码不正确。", 401, { remainingAttempts: rate.remaining });
  }

  const content = await decryptContent(
    {
      encryptedContent: message.encryptedContent,
      encryptionSalt: message.encryptionSalt,
      encryptionIv: message.encryptionIv,
      encryptionTag: message.encryptionTag
    },
    password
  );

  if (content === null) {
    return jsonError("内容解密失败，请检查密码或联系发送者重新创建。", 422);
  }

  if (message.burnAfterRead) {
    const changedRows = markMessageRead(message.id, true);

    if (changedRows === 0) {
      return jsonError("内容已被读取并销毁。", 410);
    }
  } else {
    markMessageRead(message.id, false);
  }

  return NextResponse.json(
    {
      content,
      pickupCode: message.pickupCode,
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
