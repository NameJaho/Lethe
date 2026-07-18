# Lethe

Lethe 是一个轻量的密码取件网站。发送者保存纯文本内容后，默认获得一组 4 位数字明文随机密码；接收者输入密码即可读取，也可选择开启取件码。

## 功能

- 纯文本分享，不渲染 HTML。
- 内容使用密码派生密钥加密后存储，数据库不保存明文内容。
- 密码只保存哈希，不保存明文。
- 创建页默认生成 4 位数字随机密码并明文展示，方便复制给接收者。
- 默认不需要取件码；开启取件码可避免相同密码冲突。
- 可选过期时间：10 分钟、1 小时、1 天、7 天。
- 默认阅后即焚：首次成功读取后再次读取会失败。
- Docker Compose 一条命令部署，SQLite 数据通过 volume 持久化。

## Docker 部署

```bash
docker compose up -d --build
```

打开 `http://localhost:3000`。

默认数据保存在 Docker volume `lethe_data` 中。升级镜像前，建议先备份该 volume 或数据库文件。

## 本地开发

```bash
npm install
cp .env.example .env
npm run db:init
npm run dev
```

开发服务启动后访问 `http://localhost:3000`。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `file:./data/lethe.db` | SQLite 数据库位置。Docker 中使用 `file:/app/data/lethe.db`。 |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | 部署后的站点地址，供文档和外部集成使用。 |
| `PASSWORD_HASH_ROUNDS` | `12` | bcrypt 哈希强度，允许 10-14。 |
| `RATE_LIMIT_MAX_ATTEMPTS` | `8` | 同一 IP + 取件目标在窗口期内的最大读取尝试次数。 |
| `RATE_LIMIT_WINDOW_SECONDS` | `600` | 限流窗口秒数。 |
| `PICKUP_CODE_LENGTH` | `7` | 取件码长度，允许 6-12。 |

## 运维

清理过期内容：

```bash
npm run cleanup
```

Docker 中可执行：

```bash
docker compose exec lethe npm run cleanup
```

生产启动时会自动初始化 SQLite 表结构：

```bash
npm run db:init
```

## 安全边界

这是轻量私密工具：内容会使用 AES-256-GCM 加密后存储，密钥由用户密码通过 scrypt 派生；服务器仍会保存密码哈希用于校验。不要用它保存高敏感资料、账号密钥或长期秘密。

免取件码模式下，同一个密码在未过期前只能存在一条有效内容，避免接收者只凭密码读取到歧义内容。开启取件码后，同一密码可以创建多条内容。
