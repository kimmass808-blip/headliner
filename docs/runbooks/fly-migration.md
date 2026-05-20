# Runbook: Vercel Cron → Fly.io 크롤러 마이그레이션

## 트리거 조건 (AC-22)

Vercel Cron 크롤러의 `CrawlRun.durationMs > 240초(4분)` 상태가 **연속 2회 이상** 발생하면 이 runbook을 시작한다.

**확인 방법:**
```sql
-- Supabase에서 최근 CrawlRun 조회
SELECT id, startedAt, durationMs, status
FROM "CrawlRun"
ORDER BY startedAt DESC
LIMIT 5;
```

durationMs > 240000 인 행이 2개 이상 연속 보이면 마이그레이션 진행.

---

## 사전 준비

### 1. Fly.io 계정 및 CLI 설치

```bash
# macOS에서 flyctl 설치
brew install flyctl

# 또는 curl로 설치
curl -L https://fly.io/install.sh | sh

# Fly 계정 로그인 (웹 브라우저에서 인증)
flyctl auth login
```

### 2. 필요한 환경 변수 목록

다음 값들을 사전에 준비한다:

- `DATABASE_URL` — Supabase Postgres 연결 문자열 (from `.env`)
- `DIRECT_URL` — Supabase direct connection (from `.env`, pooler 우회용)
- `OPENAI_API_KEY` — (LLM 분류기용)
- `ANTHROPIC_API_KEY` — (LLM 분류기용, 필요시)
- `ADMIN_PASSWORD` — (from `.env`, bcrypt hash)
- `ADMIN_JWT_SECRET` — (from `.env`)
- `DISCORD_WEBHOOK_URL` — (알림용, 선택)

---

## 단계 1: Fly 앱 초기화

터미널에서 프로젝트 루트 디렉토리에서 실행:

```bash
cd /path/to/mft

# Fly 앱 생성 (배포 하지 않음)
flyctl launch --no-deploy --name mft-crawler
```

**프롬프트 응답:**
- **Organization**: 기본값 또는 선택 (개인 계정이면 기본값)
- **Region**: `nrt` (도쿄, 한국 근처) 권장
- **Builder**: Docker 선택

---

## 단계 2: fly.toml 설정

`flyctl launch` 후 프로젝트 루트에 `fly.toml`이 생성된다. 다음과 같이 수정한다.

```toml
# fly.toml
app = "mft-crawler"
primary_region = "nrt"
console_command = "/bin/sh"

[build]
builder = "dockerfile"
dockerfile = "./packages/crawler/Dockerfile"

[processes]
cron = "node packages/crawler/dist/run.js"

[[services]]
processes = ["cron"]
protocol = "tcp"
internal_port = 8080

[vm]
size = "shared-cpu-1x"
memory = "256mb"
processes = ["cron"]
```

**주의:**
- `processes.cron` — crawler entry point 경로. `packages/crawler/dist/run.js` 또는 실제 경로로 변경.
- `memory = "256mb"` — LLM 토큰 처리·DB 쿼리용 충분.
- `shared-cpu-1x` — 월 $5~10 비용 예상.

---

## 단계 3: Dockerfile 준비

`packages/crawler/Dockerfile` 생성 (없으면):

```dockerfile
FROM node:20-alpine

WORKDIR /app

# pnpm 설치
RUN npm install -g pnpm

# 모노레포 루트 복사
COPY pnpm-workspace.yaml .
COPY pnpm-lock.yaml .
COPY package.json .

# 모든 packages 복사
COPY packages ./packages
COPY apps ./apps

# 의존성 설치
RUN pnpm install --frozen-lockfile

# crawler 빌드
RUN pnpm run build --filter crawler

ENTRYPOINT ["node", "packages/crawler/dist/run.js"]
```

---

## 단계 4: 환경 변수 설정

Fly에 시크릿 전송:

```bash
flyctl secrets set \
  DATABASE_URL="postgresql://user:password@..." \
  DIRECT_URL="postgresql://user:password@..." \
  OPENAI_API_KEY="sk-..." \
  ANTHROPIC_API_KEY="sk-ant-..." \
  ADMIN_PASSWORD="$2b$10$..." \
  ADMIN_JWT_SECRET="jwt-secret-here" \
  DISCORD_WEBHOOK_URL="https://discordapp.com/api/webhooks/..."
```

**확인:**
```bash
flyctl secrets list
```

---

## 단계 5: 배포

```bash
flyctl deploy
```

배포 중 진행 상황 관찰:

```bash
flyctl logs
```

배포 완료 시 "App deployed successfully" 확인.

---

## 단계 6: 크론 스케줄 등록

### 옵션 A: Fly Machines API로 6시간 주기 설정

```bash
flyctl machines create \
  --app mft-crawler \
  --name crawler-cron-6h \
  --image registry.fly.io/mft-crawler:latest \
  --schedule cron \
  --schedule-cron "0 */6 * * *" \
  --region nrt
```

### 옵션 B: node-cron 라이브러리 사용

`packages/crawler/src/run.ts`에 내장된 scheduler 사용 (코드 수정 필요):

```typescript
// packages/crawler/src/run.ts
import cron from 'node-cron';

// 6시간 주기 (매 0시, 6시, 12시, 18시)
cron.schedule('0 */6 * * *', async () => {
  console.log('Starting crawler run...');
  // runCrawler() 호출
});

// 서버 유지 (Fly Machines에서 forever 실행)
```

---

## 단계 7: Vercel Cron 비활성화

### 방법 1: vercel.json 수정

`apps/web/vercel.json`에서 cron section 제거:

```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "env": {
    "DATABASE_URL": "@database_url",
    "ADMIN_PASSWORD": "@admin_password"
  }
  // cron section 삭제 ← 제거됨
}
```

### 방법 2: vercel.json에 명시적으로 비활성화

```json
{
  "crons": []
}
```

재배포:
```bash
cd apps/web
vercel deploy --prod
```

---

## 단계 8: 모니터링

배포 후 24시간 동안 로그 확인:

```bash
# 최근 로그 스트리밍
flyctl logs --app mft-crawler

# 과거 로그 조회 (최근 1시간)
flyctl logs --app mft-crawler --since 1h
```

**확인 항목:**
- [ ] 첫 cron run 시작됨 (log에 "Starting crawler run" 표시)
- [ ] DB 연결 성공
- [ ] 계정 fetch 진행 중
- [ ] LLM 분류 진행 중
- [ ] CrawlRun row 생성·완료 기록

---

## 단계 9: 롤백 계획

배포 후 문제 발생 시 즉시 롤백:

### Fly.io 크롤러 중지

```bash
# 모든 Machines 중지
flyctl machines list --app mft-crawler
flyctl machines stop <machine-id> --app mft-crawler

# 또는 앱 전체 중지
flyctl scale count 0 --region nrt
```

### Vercel Cron 재활성화

```bash
# vercel.json에 cron section 복구
vi apps/web/vercel.json

# 재배포
cd apps/web
vercel deploy --prod
```

### 모니터링 (재활성화 후)

```bash
# Vercel 함수 로그 확인
vercel logs --follow --filter cron

# Supabase에서 CrawlRun 재개 확인
# SELECT * FROM "CrawlRun" ORDER BY startedAt DESC LIMIT 1;
```

---

## 단계 10: 장기 운영 (선택)

### 비용 추정

- **Fly Machines 비용**: shared-cpu-1x 256MB × 1 = ~$5/월
- **Supabase Pro (필요시)**: $25/월
- **LLM 호출 비용**: ~$0.5/월 (예상)
- **총 월 비용**: ~$30/월

### 업그레이드 경로

durationMs가 계속 증가하면 다음 단계:
1. CPU 사이즈 업그레이드 → `performance-1x` ($15/월)
2. 동시성 증가 → 2개 instances로 sharding
3. 데이터베이스 read replica → Supabase 상한 도달 시

---

## 문제 해결

| 증상 | 원인 | 해결책 |
|---|---|---|
| Fly에서 "connection refused" | DB 연결 문제 | DIRECT_URL 검증, Supabase IP whitelist 확인 |
| LLM API 타임아웃 | rate limit | backoff 재시도 구현, API key 확인 |
| 메모리 초과 | 버퍼 누적 | page size 감소 (500→100 posts/account) |
| Cron 스케줄 미실행 | Fly Machines 미활성 | `flyctl machines list` → 상태 확인 및 재시작 |
| Discord webhook 실패 | URL 만료 | 새 webhook URL 재설정 |

---

## 체크리스트

마이그레이션 완료 후 확인:

- [ ] fly.toml 검토 완료
- [ ] 환경 변수 모두 Fly에 설정됨
- [ ] Dockerfile 빌드 성공
- [ ] `flyctl deploy` 완료
- [ ] 첫 cron run 로그에서 성공 확인
- [ ] Vercel Cron 비활성화 완료
- [ ] 24시간 모니터링 후 안정성 확인
- [ ] 롤백 계획 문서화 완료

---

**Document version:** Fly.io migration runbook v1
**Last updated:** 2026-05-19
**Trigger gate:** CrawlRun.durationMs > 240000 ms (2회 연속)
