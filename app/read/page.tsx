import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";

import { ReadPanel } from "../read-panel";

export default function ReadPage() {
  return (
    <main className="screen">
      <div className="shell narrow-shell">
        <header className="app-header">
          <Link className="brand" href="/" aria-label="Lethe 首页">
            <span className="brand-mark">
              <LockKeyhole size={18} aria-hidden="true" />
            </span>
            <span>Lethe</span>
          </Link>
          <nav className="top-nav" aria-label="主要导航">
            <Link href="/">
              <ArrowLeft size={16} aria-hidden="true" />
              去创建
            </Link>
          </nav>
        </header>

        <section className="read-layout">
          <div className="intro compact">
            <p className="eyebrow">取件</p>
            <h1>输入密码读取内容</h1>
            <p>如果发送者开启了取件码，请同时填写取件码；密码需要由发送者单独告知。</p>
          </div>
          <Suspense>
            <ReadPanel />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
