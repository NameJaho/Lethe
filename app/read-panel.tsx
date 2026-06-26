"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ClipboardCopy, KeyRound, Search } from "lucide-react";

type ReadResult = {
  content: string;
  pickupCode: string | null;
  requirePickupCode: boolean;
  expiresAt: string;
  burnAfterRead: boolean;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function ReadPanel() {
  const searchParams = useSearchParams();
  const [pickupCode, setPickupCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReadResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setPickupCode(code.toUpperCase());
    }
  }, [searchParams]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setCopied(false);

    const response = await fetch("/api/messages/read", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pickupCode,
        password
      })
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "读取失败，请检查密码，或确认是否需要取件码。");
      return;
    }

    setResult(data);
    setPassword("");
  }

  async function copyContent() {
    if (!result) {
      return;
    }

    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="panel form-panel">
      <form className="field-stack" onSubmit={submit}>
        <div className="field-stack">
          <label className="field-label" htmlFor="pickupCode">
            取件码
            <span>可选</span>
          </label>
          <input
            id="pickupCode"
            name="pickupCode"
            className="code-input"
            value={pickupCode}
            onChange={(event) => setPickupCode(event.target.value.toUpperCase())}
            placeholder="有取件码时填写，例如 8K2M7QX"
            autoComplete="one-time-code"
          />
        </div>

        <div className="field-stack">
          <label className="field-label" htmlFor="readPassword">
            密码
          </label>
          <div className="input-with-icon">
            <KeyRound size={18} aria-hidden="true" />
            <input
              id="readPassword"
              name="readPassword"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={4}
              maxLength={128}
              autoComplete="current-password"
              placeholder="发送者提供的密码"
              required
            />
          </div>
        </div>

        {error ? (
          <p className="status error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="primary-button" type="submit" disabled={loading}>
          <Search size={18} aria-hidden="true" />
          {loading ? "正在读取..." : "读取内容"}
        </button>
      </form>

      {result ? (
        <section className="content-result" aria-live="polite">
          <div className="content-toolbar">
            <div>
              <p className="result-label">内容</p>
              <span>{formatDate(result.expiresAt)} 前可读取</span>
            </div>
            <button type="button" className="secondary-button" onClick={copyContent}>
              {copied ? <Check size={17} /> : <ClipboardCopy size={17} />}
              {copied ? "已复制" : "复制内容"}
            </button>
          </div>
          <pre>{result.content}</pre>
          {result.burnAfterRead ? (
            <p className="status warn">
              这条内容已完成首次读取，再次提交相同{result.requirePickupCode ? "取件码" : "密码"}
              将不可打开。
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
