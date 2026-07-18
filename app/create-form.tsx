"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  Clock3,
  Copy,
  Flame,
  KeyRound,
  RefreshCw,
  Send
} from "lucide-react";

type CreateResult = {
  pickupCode: string | null;
  pickupPath: string;
  requirePickupCode: boolean;
  expiresAt: string;
  burnAfterRead: boolean;
  password: string;
};

const expiryOptions = [
  { value: "10m", label: "10 分钟" },
  { value: "1h", label: "1 小时" },
  { value: "1d", label: "1 天" },
  { value: "7d", label: "7 天" }
];

const passwordAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function createRandomPassword(length = 14) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);

  return Array.from(values, (value) => passwordAlphabet[value % passwordAlphabet.length]).join("");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function CreateForm() {
  const [content, setContent] = useState("");
  const [password, setPassword] = useState("");
  const [expiresIn, setExpiresIn] = useState("1d");
  const [requirePickupCode, setRequirePickupCode] = useState(false);
  const [burnAfterRead, setBurnAfterRead] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | "password" | null>(null);

  useEffect(() => {
    setPassword(createRandomPassword());
  }, []);

  const pickupLink = useMemo(() => {
    if (!result || typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}${result.pickupPath}`;
  }, [result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setCopied(null);
    const submittedPassword = password;

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content,
        password,
        expiresIn,
        requirePickupCode,
        burnAfterRead
      })
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "创建失败，请稍后再试。");
      return;
    }

    setResult({
      ...data,
      password: submittedPassword
    });
    setContent("");
    setPassword(createRandomPassword());
  }

  async function copyText(kind: "code" | "link" | "password", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <div className="field-stack">
        <label className="field-label" htmlFor="content">
          内容
          <span>{content.length}/10000</span>
        </label>
        <textarea
          id="content"
          name="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="粘贴文本、链接、临时代码片段..."
          maxLength={10000}
          required
        />
      </div>

      <div className="two-column">
        <div className="field-stack">
          <label className="field-label" htmlFor="password">
            密码
          </label>
          <div className="input-with-icon">
            <KeyRound size={18} aria-hidden="true" />
            <input
              id="password"
              name="password"
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={4}
              maxLength={128}
              autoComplete="off"
              placeholder="自动生成，可手动修改"
              required
            />
          </div>
          <button
            type="button"
            className="secondary-button inline-button"
            onClick={() => setPassword(createRandomPassword())}
          >
            <RefreshCw size={17} aria-hidden="true" />
            重新生成
          </button>
        </div>

        <div className="field-stack">
          <span className="field-label">过期时间</span>
          <div className="segmented" role="radiogroup" aria-label="过期时间">
            {expiryOptions.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="expiresIn"
                  value={option.value}
                  checked={expiresIn === option.value}
                  onChange={() => setExpiresIn(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={requirePickupCode}
          onChange={(event) => setRequirePickupCode(event.target.checked)}
        />
        <span className="toggle-control" aria-hidden="true" />
        <span>
          <strong>
            <KeyRound size={16} aria-hidden="true" />
            需要取件码
          </strong>
          <small>关闭后接收者只输入密码即可读取；同密码免取件码内容同时只能存在一条。</small>
        </span>
      </label>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={burnAfterRead}
          onChange={(event) => setBurnAfterRead(event.target.checked)}
        />
        <span className="toggle-control" aria-hidden="true" />
        <span>
          <strong>
            <Flame size={16} aria-hidden="true" />
            阅后即焚
          </strong>
          <small>首次成功读取后，内容不能再次打开。</small>
        </span>
      </label>

      {error ? (
        <p className="status error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="primary-button" type="submit" disabled={loading}>
        <Send size={18} aria-hidden="true" />
        {loading ? "正在创建..." : "创建取件内容"}
      </button>

      {result ? (
        <section className="result-box" aria-live="polite">
          <div className="result-grid">
            <div>
              <p className="result-label">密码</p>
              <strong>{result.password}</strong>
            </div>
            <div>
              <p className="result-label">{result.requirePickupCode ? "取件码" : "读取方式"}</p>
              <strong>{result.requirePickupCode ? result.pickupCode : "仅密码"}</strong>
            </div>
          </div>
          <div className="result-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => copyText("password", result.password)}
            >
              {copied === "password" ? <Check size={17} /> : <Copy size={17} />}
              {copied === "password" ? "已复制" : "复制密码"}
            </button>
            {result.pickupCode ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => copyText("code", result.pickupCode ?? "")}
              >
                {copied === "code" ? <Check size={17} /> : <Copy size={17} />}
                {copied === "code" ? "已复制" : "复制取件码"}
              </button>
            ) : null}
            <button
              type="button"
              className="secondary-button"
              onClick={() => copyText("link", pickupLink)}
            >
              {copied === "link" ? <Check size={17} /> : <Clipboard size={17} />}
              {copied === "link" ? "已复制" : "复制取件链接"}
            </button>
          </div>
          <p className="meta-line">
            <Clock3 size={16} aria-hidden="true" />
            {formatDate(result.expiresAt)} 过期
            {result.requirePickupCode ? "，读取需要取件码" : "，读取不需要取件码"}
            {result.burnAfterRead ? "，已开启阅后即焚" : ""}
          </p>
        </section>
      ) : null}
    </form>
  );
}
