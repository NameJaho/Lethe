import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";

import { CreateForm } from "./create-form";

export default function Home() {
  return (
    <main className="screen">
      <div className="shell">
        <header className="app-header">
          <Link className="brand" href="/" aria-label="Lethe 首页">
            <span className="brand-mark">
              <LockKeyhole size={18} aria-hidden="true" />
            </span>
            <span>Lethe</span>
          </Link>
          <nav className="top-nav" aria-label="主要导航">
            <Link href="/read">
              去取件
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </nav>
        </header>

        <section className="workbench">
          <div className="intro">
            <p className="eyebrow">临时文本交换</p>
            <h1>创建一条用密码领取的内容</h1>
            <p>
              保存加密文本，可选择是否生成取件码。接收者按你设置的方式读取。
            </p>
          </div>
          <CreateForm />
        </section>
      </div>
    </main>
  );
}
