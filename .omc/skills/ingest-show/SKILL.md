---
name: ingest-show
description: >-
  IG 게시물(또는 웹 페이지)을 보고 공연(Show)·페스티벌(Festival)·관람정보(FestivalInfo)·
  셋리스트(Setlist)를 구조화된 payload JSON으로 추출한 뒤 `scripts/ingest.ts`로 DB에
  적재하는 워크플로우. 한국 인디 공연·페스티벌 디스커버리 파이프라인의 수집 진입점.
  "ingest"/"import"/"등록"/"워치리스트" 요청 시 사용.
triggers:
  - ingest
  - import-show
  - 공연 등록
  - 페스티벌 등록
  - ig 등록
  - 인스타 가져오기
  - 워치리스트 돌려줘
  - 워치리스트 추가
  - run watchlist
argument-hint: "<ig-handle | post-url | paste text | 'watchlist'>"
---

# ingest-show

> **병합 노트**: 원본 SKILL.md는 `.gitignore`의 `.omc/skills/` 규칙 때문에 git에 커밋되지
> 않아 한 번 분실되었고, 코드(`scripts/ingest.ts` zod 계약) 기반으로 재구성되었다.
> 이 버전은 그 재구성본(최신 데이터 모델: festival_info / setlist / v6 sessions)에 옛
> 세션에서 복원한 **Extract 레이어(Claude in Chrome)·Watchlist mode·Always-skip 규칙**을
> 다시 통합한 것이다. 원본 전문은 같은 폴더 `_original-reference.md`에 보관.
> 코드와 본 문서가 어긋나면 **`scripts/ingest.ts`가 정답**이다.

## 목적

에이전트가 인스타그램 공식 계정(페스티벌/공연장/아티스트) 또는 공식 웹페이지를 "보고",
거기서 공연·페스티벌·관람정보·셋리스트를 뽑아 **payload JSON 한 건**으로 만든 다음, 그
JSON을 `scripts/ingest.ts`에 흘려보내 DB(Festival / Show / ShowSession / Artist / Venue /
FestivalInfo)에 멱등(idempotent) upsert 한다. 이미지가 있으면 Supabase Storage 업로드,
검색 인덱스 갱신, 감사 로그 기록까지 ingest 스크립트가 수행한다.

파이프라인은 세 단계로 나뉜다:

1. **Extract** (이 스킬 + Claude in Chrome) — 소스를 직접 읽어 캡션·이미지·날짜를 모은다.
2. **Shape** (이 스킬) — 정규화된 payload JSON 한 건을 만든다.
3. **Apply** (`scripts/ingest.ts`) — 검증·정규화·upsert·이미지 업로드·검색 인덱스 갱신.

**역할 분리**: 이 스킬(에이전트)은 *추출 + payload 작성*만 책임진다. *적재*는
`scripts/ingest.ts`가, *교정 학습*은 `/admin/review` + `scripts/review-learn.ts`가 맡는다.

## 언제 쓰나

사용자가 다음 중 하나를 말할 때:

- "이 IG 계정/게시물에서 공연(또는 라인업) 긁어와 넣어줘"
- "https://www.instagram.com/p/... 등록" / "@hyukoh 최신 공연 가져와"
- "○○ 페스티벌 관람정보(타임테이블·교통·규정 등) 수집"
- "아티스트 계정에서 페스티벌 출연 정보로 기존 라인업 보강"
- "워치리스트 돌려줘" / "run watchlist" / "X 계정 워치리스트에 추가"
- 공연 페이지 URL이나 텍스트 블록을 붙여넣을 때

URL만 주면 Claude in Chrome으로 직접 열어본다. 텍스트/스크린샷을 붙여주면 그걸로 작업한다.

크롤러 자동화(`packages/crawler`)와 달리, 이 스킬은 **에이전트가 직접 소스를 읽어**
정확도 높은 한 건을 만드는 수동/반자동 경로다.

---

# 1. Extract — Claude in Chrome으로 소스 읽기

소스가 `https://www.instagram.com/{handle}/` 같은 IG 프로필 URL일 때의 절차.

## Step 0 — ground-truth 게시물 수 확보 (항상 제일 먼저)

IG 프로필 그리드는 가상화된 리스트라, 스크롤로 화면 밖에 나간 게시물은 DOM에서 unmount
된다. 따라서 `querySelectorAll('a[href*="/p/"]').length`는 백필 총량으로 **절대 신뢰 불가**
— 조용히 게시물을 놓친다. 공개 프로필 엔드포인트로 진짜 `media_count`를 먼저 잡는다:

```js
(async () => {
  const r = await fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username={HANDLE}', {
    headers: {'x-ig-app-id': '936619743392459'}, credentials: 'include'
  });
  const u = (await r.json())?.data?.user;
  return {
    user_id: u.id,
    media_count: u.edge_owner_to_timeline_media?.count,
    is_private: u.is_private,
    followed_by_viewer: u.followed_by_viewer,
    full_name: u.full_name,
    profile_pic_url_hd: u.profile_pic_url_hd,  // <- Step 3(아티스트 enrichment)로 전달
  };
})()
```

`media_count`를 기록한다. 이후 모든 추출 단계는 이 값을 기준으로 검증한다. 최종 게시물
배열 길이 < `media_count`이면 불완전 크롤 — 진행하지 말 것. `profile_pic_url_hd`와
`full_name`은 Step 3에서 계정 주인(= 암묵적 아티스트)의 Artist 행(아바타+표시명) 보강에 쓴다.

## Step 1 — 우선 경로: 페이지네이션 feed API

private-but-public 모바일 웹 엔드포인트. 전체 캡션 + 미디어 메타데이터를 JSON으로 반환,
스크롤·가상화 없음:

```js
// 중요: background async(window.__full/__done)로 띄울 것 — CDP Runtime.evaluate는 45s에
// 타임아웃되고 60+ 게시물 백필은 ~10–20s 걸려서, top-level await를 넣으면 성공해도
// 자주 타임아웃에 걸린다.
(() => {
  window.__full = []; window.__done = false; window.__err = null;
  (async () => {
    try {
      const APP_ID = '936619743392459';
      const prof = await (await fetch(
        'https://www.instagram.com/api/v1/users/web_profile_info/?username={HANDLE}',
        { headers: {'x-ig-app-id': APP_ID}, credentials: 'include' }
      )).json();
      const userId = prof.data.user.id;
      let max_id = null;
      for (let page = 0; page < 20; page++) {
        const u = new URL(`https://www.instagram.com/api/v1/feed/user/${userId}/`);
        u.searchParams.set('count', '33');
        if (max_id) u.searchParams.set('max_id', max_id);
        const r = await fetch(u, { headers: {'x-ig-app-id': APP_ID}, credentials: 'include' });
        if (!r.ok) { window.__err = 'http ' + r.status; break; }
        const j = await r.json();
        for (const it of (j.items || [])) {
          window.__full.push({
            shortcode: it.code,
            url: `https://www.instagram.com/p/${it.code}/`,
            media_type: it.media_type,       // 1=photo, 2=video, 8=carousel
            product_type: it.product_type || null,  // 'clips' = reel
            taken_at: it.taken_at,           // unix seconds
            caption: it.caption?.text || null,
            display_url: it.image_versions2?.candidates?.[0]?.url || null,
          });
        }
        if (!j.more_available) break;
        max_id = j.next_max_id;
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) { window.__err = String(e); }
    window.__done = true;
  })();
  return 'started';
})()
```

그다음 두 번째 `javascript_exec` 호출로 `({done: window.__done, err: window.__err, count: window.__full.length})`를
완료될 때까지 폴링하고 `count === media_count`를 검증한다. 다운로드는 뒤의 `<a download>`
blob 패턴 사용.

이 경로는: 모든 게시물의 **전체 캡션** 반환(게시물별 HTML 재요청 불필요), 그리드의
clips/reels 포함, 가상화·팔로우 게이팅 영향 없음(공개 프로필). 실패 모드: private 프로필·
rate-limit 시 HTTP 401/403 → `__err`에 표시.

> **실전 주의(2026-05 펜타포트 263건 크롤 경험)**: `web_profile_info`는 `media_count`와
> `user_id`는 주지만 **비로그인 세션에선 `edge_owner_to_timeline_media.edges`가 빈 배열**로
> 오고, `/api/v1/feed/user/{id}/`도 **items 0**을 반환하는 경우가 잦다(쿠키/세션 상태에 민감).
> 이때는 아래 **Step 1b(embed)** 로 폴백한다 — 그리드 스크롤(Step 2)보다 빠르고 잘림 없다.

## Step 1b — fallback: 게시물별 embed/captioned (feed API가 0건일 때)

`/p/{shortcode}/embed/captioned/`는 **로그인 없이도** 게시물 1건의 전체 캡션·대표 이미지·
게시일을 HTML로 준다. shortcode 목록(그리드 스크롤로 수집)만 있으면 한 탭에서 background
async 루프로 **수백 건을 연속 fetch**할 수 있다(게시물당 navigate 불필요 → navigate 방식
대비 수십 배 빠름. 263건 ≈ 4–5분).

```js
window.__crawl = { done:false, i:0, total: SHORTCODES.length, items:[], errors:[] };
(async () => {
  const S = window.__crawl;
  const decode = (s) => s
    .replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'')
    .replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>String.fromCodePoint(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10)))
    .replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'");
  for (let k=0;k<SHORTCODES.length;k++){
    const sc = SHORTCODES[k]; S.i=k+1;
    try {
      const html = await (await fetch(`https://www.instagram.com/p/${sc}/embed/captioned/`,{credentials:'omit'})).text();
      let cap=''; let m = html.match(/class="Caption"[\s\S]*?>([\s\S]*?)<\/div>\s*(?:<\/div>|<p)/);
      if (m) cap = decode(m[1]).trim();
      let img=null; const im = html.match(/class="EmbeddedMediaImage"[^>]*\ssrc="([^"]+)"/);
      if (im) img = im[1].replace(/&amp;/g,'&');
      S.items.push({ sc, cap, img });
    } catch(e){ S.errors.push({sc,error:String(e)}); }
    await new Promise(r=>setTimeout(r,350));   // rate-limit 회피
  }
  S.done = true;
})();
"started"
```

폴링으로 `S.done`까지 기다린 뒤 회수한다.

> **embed 파서 누락 보강**: embed/captioned는 일부 레이아웃(영상/릴, 특정 캐러셀)에서 캡션을
> **빈값**으로 줄 때가 있다. `cap.length < 5`인 건만 모아 **일반 게시물 fetch**(`/p/{sc}/`의
> `og:title` 또는 `"edge_media_to_caption"..."text":"..."`)로 재시도하면 대부분 복구된다.
> 263건 중 10건이 이 케이스였고 전부 일반 fetch로 정상 추출됨.

> **데이터 회수는 base64 금지 — Blob 다운로드로.** Claude-in-Chrome 브리지는 툴 출력의
> base64 덩어리를 `[BLOCKED]`로 마스킹한다(IG CDN URL과 동일). 수집한 `S.items`를
> `JSON.stringify` → Blob → `<a download>`로 **파일로 받아** `~/Downloads/` → `/tmp/`로 옮긴 뒤
> Bash/Node로 처리한다. (텍스트 캡션도 base64로 회수하려다 막혔던 실패를 그대로 겪지 말 것.)

> ## ⚠️⚠️ embed/일반-fetch는 **이미지를 1장만** 준다 — 캡션 전용으로만 써라
>
> 2026-05 펜타포트에서 검증한 치명적 한계(이걸 모르면 타임테이블·사이트맵 같은 **여러 장
> 캐러셀이 대표 1장으로 잘려 적재**된다 — 실제로 그렇게 됐다):
> - **embed/captioned**: `EmbeddedMediaImage` **대표 1장만**. 캐러셀 나머지 슬라이드 없음.
> - **일반 게시물 fetch `/p/{sc}/` (비로그인)**: HTML에 `display_url`·`image_versions2`·
>   `carousel_media`·`edge_sidecar_to_children`가 **전부 제거돼 있다**(검증: 0건). 즉 fetch
>   경로로는 캐러셀 전체를 **얻을 수 없다**.
> - 로그인된 feed API(`carousel_media[].image_versions2.candidates`)가 되면 한 방에 전부지만,
>   비로그인 세션에선 feed API 자체가 0건일 수 있다(Step 1b로 폴백한 이유).
>
> **따라서 2-패스로 간다:**
> 1. **Pass 1 (빠름, 전체)** — embed fetch로 263건 **캡션만** 모아 분류(KEEP/skip) 확정.
>    이미지 URL은 여기서 신뢰하지 말 것(대표 1장).
> 2. **Pass 2 (느림, KEEP만)** — KEEP으로 추린 소수 게시물(이번엔 ~30건)만 navigate해서
>    아래 **캐러셀 전체 다운로드**로 모든 슬라이드를 받는다. festival_info·여러 장 포스터는
>    `imageSources[]`에 **전 슬라이드** 넣는다.
>
> 263건을 전부 navigate할 필요 없다 — Pass 1으로 KEEP을 좁힌 뒤 그 소수만 Pass 2.

## Step 2 — fallback: 그리드 스크롤 (API·embed 모두 막혔을 때)

API 경로가 에러(비공개 + 미팔로우, 또는 rate-limit)면 스크롤로 fallback. 순진하게
"끝까지 스크롤 후 마지막에 한 번 카운트"하면 IG가 지나간 게시물을 unmount해서 **과소
카운트**된다. 스크롤하면서 shortcode 키 `Map`에 누적해야 한다:

```js
(async () => {
  const seen = new Map();
  const collect = () => {
    for (const a of document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
      const m = a.href.match(/\/(p|reel)\/([^/?]+)/);
      if (!m || seen.has(m[2])) continue;
      const img = a.querySelector('img');
      let bestSrc = img?.src;
      if (img?.srcset) {
        let bestW = 0;
        for (const part of img.srcset.split(',')) {
          const mm = part.trim().match(/^(\S+)\s+(\d+)w$/);
          if (mm && +mm[2] > bestW) { bestW = +mm[2]; bestSrc = mm[1]; }
        }
      }
      seen.set(m[2], {
        shortcode: m[2], url: a.href.split('?')[0],
        type: m[1] === 'reel' ? 'reel' : 'post',
        alt: img?.alt || null, imgSrc: bestSrc,
      });
    }
  };
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 800));
  collect();
  let lastH = 0, stable = 0;
  for (let i = 0; i < 300; i++) {
    window.scrollBy(0, 800);
    await new Promise(r => setTimeout(r, 600));
    collect();
    const h = document.body.scrollHeight;
    const atBottom = window.scrollY + window.innerHeight >= h - 50;
    if (atBottom && h === lastH) { if (++stable >= 8) break; }
    else { stable = 0; lastH = h; }
  }
  window.__dump = Array.from(seen.values());
  return window.__dump.length;
})()
```

누적 패턴을 써도 65+ 미디어 프로필에서 그리드가 ~55–60개에서 멈추는 경우가 있다(IG가
더 안 불러옴). **그리드 스크롤 총량 < Step 0의 `media_count`이면 불완전 크롤로 간주**하고
API 경로 재시도·로그인/팔로우, 아니면 `source.notes`에 갭을 명시한다. `alt` 필드는 대부분
라인업 포스트의 OCR된 포스터 텍스트를 담아 — 그리드 fallback에선 날짜/아티스트의 최고
신호원이다. 단, Step 1의 `caption`이 항상 더 낫다(전체 텍스트, 잘림 없음).

## Step 3 — 아티스트 프로필 사진 캡처 (계정 주인은 항상)

크롤하는 모든 IG 계정은 최소 1개의 Artist 행(워치리스트 계정 자신)에 대응한다.
`scripts/ingest.ts`는 각 `ArtistInput`에 선택적 `imageSource`를 받아 `pipeImage`로
파이프(Storage 업로드, webp ≤1200px)하고 공개 URL을 `Artist.imageUrl`에 쓴다. **단,
`imageUrl`이 현재 null일 때만** 채우므로 재실행 안전 — Spotify enrichment 아트워크는 안
덮어쓴다.

**왜 브라우저에서 다운로드하나**: IG 프로필 사진 CDN URL은 서명되어 수 분 내 만료되고,
Node `fetch`(IG 쿠키 없음, 일반 UA)는 자주 403. 브라우저 컨텍스트엔 세션이 있으니
`<a download>`를 트리거하고 `~/Downloads/`에서 `/tmp/`로 옮긴다. 포스터 다운로드와 동일 패턴.

```js
// 크롤당 1회, Step 0 직후 실행
(async () => {
  const url = /* Step 0의 profile_pic_url_hd */;
  const handle = /* IG 핸들 */;
  const resp = await fetch(url, { credentials: 'include' });
  if (!resp.ok) return { error: 'http ' + resp.status };
  const blob = await resp.blob();
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = `ingest-artist-${handle}.jpg`;
  document.body.appendChild(a); a.click();
  await new Promise(r => setTimeout(r, 600));
  URL.revokeObjectURL(u);
  return { size: blob.size, type: blob.type };
})()
```

그다음 Bash: `mv ~/Downloads/ingest-artist-{handle}.jpg /tmp/`. 그 로컬 경로를 매칭되는
`ArtistInput`의 `imageSource`로 넘긴다.

**스코프 규칙**: 계정 주인(피드를 긁은 핸들)은 항상 한다. 캡션·포스터의 `@handle` 협연
아티스트는 *선택* — 매 fetch가 IG 프로필 엔드포인트를 치므로 30아티스트 페스티벌 포스터에서
전원 fetch하면 차단 위험↑. 기본 정책: 계정 주인만 지금 보강, 협연 아티스트는 그 계정이
워치리스트에 들어오는 다음 패스(또는 Spotify enrichment)에서 받는다.

> **중요 — 이미지 해상도.** 프로필 그리드 `img`(및 게시물 페이지 `meta[og:image]`)는
> IG가 피드 그리드에 쓰는 **320–640px 정사각 크롭 썸네일**이다. 이걸 ingest하면 포스터가
> **잘리고(비율 파괴) 판독 불가**. `og:image`나 그리드 img URL을 `imageSource`로 **절대
> 쓰지 말 것** — 아래 풀해상도 경로를 쓴다.

## 풀해상도 일괄 추출 (기본 — Step 1과 같은 feed API)

Step 1의 `/api/v1/feed/user/{id}/` 응답엔 이미 모든 게시물의 **크롭 안 된 원본 비율**
이미지 URL이 `image_versions2.candidates[]`(단일) 또는
`carousel_media[i].image_versions2.candidates[]`(캐러셀)에 있다. 긴 변 ~1440px까지, 네이티브
비율 보존. 게시물별 네비게이션·DOM 마운트 없이 가장 빠른 경로.

```js
// Step 1이 window.__full을 채운 뒤, 게시물별 포스터 URL 캡처:
(() => {
  window.__rich = {}; window.__rDone = false;
  (async () => {
    const APP_ID = '936619743392459';
    const profile = await (await fetch(
      'https://www.instagram.com/api/v1/users/web_profile_info/?username={HANDLE}',
      {headers:{'x-ig-app-id': APP_ID}, credentials:'include'}
    )).json();
    const userId = profile.data.user.id;
    const items = [];
    let max_id = null;
    for (let p=0; p<20; p++) {
      const u = new URL(`https://www.instagram.com/api/v1/feed/user/${userId}/`);
      u.searchParams.set('count','33');
      if (max_id) u.searchParams.set('max_id', max_id);
      const j = await (await fetch(u, {headers:{'x-ig-app-id':APP_ID}, credentials:'include'})).json();
      items.push(...(j.items||[]));
      if (!j.more_available) break;
      max_id = j.next_max_id;
    }
    const wanted = /* 포스터 받을 shortcode 배열 */;
    for (const sc of wanted) {
      const it = items.find(x => x.code === sc);
      if (!it) { window.__rich[sc] = {err:'not_found'}; continue; }
      const slides = it.carousel_media ?? [it];
      window.__rich[sc] = slides.map(node => {
        const cands = node.image_versions2?.candidates || [];
        let best = null;
        for (const c of cands) if (!best || c.width > best.width) best = c;
        return best ? { width: best.width, height: best.height, url: best.url } : null;
      }).filter(Boolean);
    }
    window.__rDone = true;
  })();
  return 'started';
})()
```

그다음 슬라이드당 1파일로 다운로드 트리거. show의 경우 슬라이드 index `1`이 보통 마스터
포스터(공연 발표 스타일) — 캡션과 먼저 대조. 멀티데이/도시별 투어는 뒤 슬라이드가 날짜별
세부를 담는 경우가 많아 여러 장 캡처.

```js
(() => {
  window.__dlDone = false; window.__dl = {};
  (async () => {
    for (const [sc, slides] of Object.entries(window.__rich)) {
      if (!Array.isArray(slides)) continue;
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        if (!s?.url) continue;
        try {
          const blob = await (await fetch(s.url)).blob();
          const u = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = u; a.download = `ingest-${sc}-${i+1}.jpg`;
          document.body.appendChild(a); a.click();
          await new Promise(r => setTimeout(r, 700));
          URL.revokeObjectURL(u);
          window.__dl[`${sc}-${i+1}`] = { size: blob.size, w: s.width, h: s.height };
        } catch (e) { window.__dl[`${sc}-${i+1}`] = { err: String(e) }; }
      }
    }
    window.__dlDone = true;
  })();
  return 'started';
})()
```

`__dlDone === true` 후 Bash로 `~/Downloads/` → `/tmp/` 이동. 경로를
`imageSource`/`posterImageSource`/`imageSources`에 참조. Step 1이 성공했으면 항상 이 경로 사용.

## 게시물별 DOM 추출 (API 막혔을 때 fallback)

Step 1이 막혔을 때(비공개+미팔로우, rate-limit)만. 게시물 URL로 이동 후 캐러셀 슬라이드별:

```js
// 현재 보이는 캐러셀 이미지의 최고해상 srcset 변형을 고름. 슬라이드당 1회 실행,
// 멀티이미지면 호출 사이에 "다음" 버튼 클릭.
(() => {
  const article = document.querySelector('article');
  if (!article) return null;
  const imgs = Array.from(article.querySelectorAll('img'))
    .filter(i => i.naturalWidth >= 480 && i.srcset);
  if (!imgs.length) return null;
  const active = imgs.find(i => {
    const li = i.closest('li');
    return !li || li.getAttribute('aria-hidden') !== 'true';
  }) || imgs[0];
  let bestSrc = active.src, bestW = active.naturalWidth;
  for (const part of active.srcset.split(',')) {
    const m = part.trim().match(/^(\S+)\s+(\d+)w$/);
    if (m && +m[2] > bestW) { bestW = +m[2]; bestSrc = m[1]; }
  }
  return { src: bestSrc, w: bestW, alt: active.alt || null };
})()
```

### 이미지 저장 (URL 누출 없이)

Claude-in-Chrome 브리지는 IG CDN URL과 base64를 툴 출력에서 마스킹하므로, 해석된 URL을
Node에서 `curl`하거나 바이트를 툴 결과로 왕복시킬 수 없다. 신뢰 가능한 패턴은 **페이지에서
`<a download>` 트리거** 후 `~/Downloads/`에서 `/tmp/ingest-{shortcode}-{n}.jpg`로 이동:

```js
(async () => {
  const url = /* 위 스니펫의 bestSrc */;
  const resp = await fetch(url);
  const blob = await resp.blob();
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = 'ingest-SHORTCODE-N.jpg';
  document.body.appendChild(a); a.click();
  await new Promise(r => setTimeout(r, 600));
  URL.revokeObjectURL(u);
  return { size: blob.size, type: blob.type };
})()
```

그다음 Bash로 `mv ~/Downloads/ingest-SHORTCODE-N.jpg /tmp/`. 포스터는 `size > 80KB` &
`identify` width ≥ 1000px 검증 — 둘 중 하나라도 작으면 캐러셀 이미지가 아니라 썸네일을
잡은 것.

### 캐러셀 페이지네이션

```js
document.querySelector('button[aria-label="다음"], button[aria-label="Next"]')?.click();
```

다음 이미지 마운트까지 ~600ms 대기 후 추출기 재실행. 슬라이드를 `ingest-{shortcode}-1.jpg`,
`-2.jpg` … 로 저장. 텍스트가 가장 많은(OCR/alt) 슬라이드가 포스터 패널. 캡션+멘션+해시태그는
게시물 페이지에서 `get_page_text`로도 캡처: 캡션 텍스트, `@handle` 멘션, `#tag`, 티켓 URL.

### Pass 2 ★최우선★ — GraphQL doc_id로 캐러셀 전 슬라이드 (로그인 세션, 검증됨)

**가장 깨끗하고 빠른 캐러셀 경로.** navigate·DOM·스크롤 전부 불필요 — shortcode만으로
한 번 fetch하면 `edge_sidecar_to_children`에 **전 슬라이드 풀해상 `display_url`**이 다 온다.
로그인 세션(`ds_user_id` 쿠키)에서 동작. 2026-05 펜타포트 festival_info 33건을 이 방법으로
한 번에 처리(총 83슬라이드, 0 에러) — DOM 방식의 unmount/오염/순서 문제를 전부 회피한다.

```js
// 여러 게시물 캐러셀 URL을 한 background 루프로 수집 (instagram.com 탭 안에서)
window.__all = { done:false, i:0, map:{}, err:[] };
(async () => {
  const SCS = [/* shortcode 배열 */];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  for (let k=0;k<SCS.length;k++){
    const sc=SCS[k]; window.__all.i=k+1;
    try {
      const r = await fetch(
        `https://www.instagram.com/graphql/query/?doc_id=8845758582119845&variables=${encodeURIComponent(JSON.stringify({shortcode:sc}))}`,
        { headers:{'x-ig-app-id':'936619743392459'}, credentials:'include' });
      const m = (await r.json())?.data?.xdt_shortcode_media;
      const car = m?.edge_sidecar_to_children?.edges?.map(e=>e.node) || (m?[m]:[]);
      window.__all.map[sc] = car.map(n=>n.display_url).filter(Boolean);   // 풀해상 URL[]
    } catch(e){ window.__all.err.push(sc+':'+e); window.__all.map[sc]=[]; }
    await sleep(400);   // rate-limit 회피
  }
  window.__all.done=true;
})();
"started"
```

그다음 **다운로드도 브라우저 메모리(`window.__all.map`)에서 바로** — URL을 툴 출력으로 빼낼
필요 없다(마스킹·크기 문제 회피). 슬라이드마다 `<a download>` Blob:

```js
window.__save = { done:false, n:0, fails:[] };
(async () => {
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  for (const [sc, urls] of Object.entries(window.__all.map)){
    for (let i=0;i<urls.length;i++){
      try {
        const blob = await (await fetch(urls[i])).blob();
        const u=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=u; a.download=`pf-${sc}-${i+1}.jpg`;
        document.body.appendChild(a); a.click(); await sleep(350); URL.revokeObjectURL(u); a.remove();
        window.__save.n++;
      } catch(e){ window.__save.fails.push(`${sc}-${i+1}`); }
    }
  }
  window.__save.done=true;
})();
"started"
```

`~/Downloads/pf-{sc}-{i}.jpg` → `mv`로 `/tmp/`. 그 경로들을 festival_info `imageSources[]`에
**파일명 번호 순서대로** 넣는다(`pf-{sc}-1.jpg, -2.jpg, …`).

> `doc_id`는 IG가 가끔 바꾼다. GraphQL이 `xdt_shortcode_media` 없이 빈 data를 주면 만료된
> 것 — 그땐 게시물 1건 navigate 후 DevTools Network에서 `graphql/query` 요청의 최신 doc_id를
> 확인하거나, 아래 **DOM 폴백**을 쓴다.

### Pass 2 폴백 — DOM 캐러셀 ("다음" 클릭 루프, doc_id 만료 시)

게시물 1건을 navigate한 뒤 **이 background 루프 하나로** "다음"을 끝까지 누르며 모든 슬라이드의
URL을 모은다. ⚠️ **이미지 unmount 주의**: IG는 뷰포트 밖 슬라이드 `img`를 DOM에서 떼어내
naturalWidth가 0이 된다 — 매 슬라이드마다 `article.scrollIntoView({block:'center'})`로 화면에
유지하고, "새 큰 이미지가 뜰 때까지 폴링"해야 한다(안 그러면 1장만 받고 멈춘다, 실제 겪음).
슬라이드 총수는 하단 **dot 인디케이터 개수**로 파악.

```js
window.__cap = { done:false, slides:[], err:null };
(async () => {
  try {
    const seen = new Set();
    const grab = () => {
      const art = document.querySelector('article') || document.body;
      for (const i of [...art.querySelectorAll('img')].filter(i=>i.naturalWidth>=600 && i.srcset)) {
        let best=i.src, bw=i.naturalWidth;
        for (const p of i.srcset.split(',')) { const m=p.trim().match(/^(\S+)\s+(\d+)w$/); if(m&&+m[2]>bw){bw=+m[2];best=m[1];} }
        const key=best.split('?')[0];
        if (!seen.has(key)) { seen.add(key); window.__cap.slides.push({ w:bw, url:best }); }
      }
    };
    for (let i=0;i<15;i++){
      grab();
      const nx = document.querySelector('button[aria-label="다음"], button[aria-label="Next"]');
      if (!nx) break;
      nx.click();
      await new Promise(r=>setTimeout(r,700));
    }
    grab();
  } catch(e){ window.__cap.err=String(e); }
  window.__cap.done=true;
})();
"started"
```

`__cap.done`까지 폴링한 뒤, 각 `slides[].url`을 위 **`<a download>` Blob 패턴**으로 받아
`/tmp/ingest-{sc}-{i}.jpg`로 옮긴다. 그 경로들을 순서대로:
- **festival_info(타임테이블·사이트맵 등)** → `imageSources: ["/tmp/...-1.jpg","...-2.jpg",...]`
  **전 슬라이드** 넣기. (단일 1장만 넣으면 DAY2/3 타임테이블이 누락된다 — 이번 실패의 핵심.)
- **show 라인업 포스터** → 보통 슬라이드 1이 마스터 포스터. `imageSource`(단일)에 1장.
- **festival** → `posterImageSource`(단일)에 대표 1장(보통 슬라이드 1).

> ⚠️ `naturalWidth>=600` 게이트는 그리드 썸네일(320–640 정사각)·프로필/아이콘을 거른다.
> 슬라이드가 0장 나오면 게시물이 아직 안 떴거나 영상 전용 — 잠시 대기 후 재시도.

---

# 2. Shape — 엔티티 분류 + payload 작성

## 소스 유형별 라우팅

1. **페스티벌 계정** → `festival` + 내부 `show`(festivalKey로 부모에 연결) + `festival_info`(관람정보)
2. **공연장 계정** → 단독 `show`
3. **아티스트 계정** → `setlist`(기존 페스티벌 Show에 셋리스트 비파괴 보강).
   ⚠️ 아티스트 계정의 "페스티벌 출연" 글로 `show`를 만들지 말 것(중복 발생). 단독 공연/투어는 정상 `show`.

캡처한 게시물을 순회하며 각각 분류:

| 신호 | Emit |
|---|---|
| 포스터에 2일+ + 라인업 그리드 | `festival` (+ 알려진 출연/일자별 `show`) |
| 단일 날짜 + 공연장 + 1–3 아티스트 | `show` |
| 관람객 안내(맵·타임테이블·교통·규정 등) | `festival_info` |
| 아티스트 계정의 셋리스트 | `setlist` |
| 날짜/공연장 없는 홍보 티저 | skip; `notes`에 기록 |
| 리캡/라이브 사진/비이벤트 | skip |

항상 `source.accountHandle`(피드를 긁은 IG 계정)을 넣고, "X 단독 콘서트/발매 쇼케이스"
스타일이면 그 계정을 암묵적 아티스트로 취급.

## Always-skip 카테고리 (날짜+공연장이 명확해도 제외)

`notes`에 기록하되 엔티티는 emit하지 않는다:

- **해외 공연** — 대한민국 외. 아시아 투어 해외 일정(도쿄·타이베이·홍콩·KL·방콕·싱가포르 등) skip.
- **대학축제 / 학교 행사** — 캠퍼스 대동제·축제·캠퍼스 투어·개교기념제·아카라카 등. 신호:
  포스터 "○○대학교", 주최 핸들 `_festival`/`_council`/`_harang`, 캡션 "학우분들"/"대동제".
  아티스트 부킹 확정 여부와 무관하게 skip.
- **과거 공연 리캡(미래 공연 데이터 없음)** — 끝난 공연 자축 릴스/사진·아프터무비·백스테이지
  스냅 등. (단, 그 리캡이 **미적재 공연의 날짜/공연장**을 처음 알려주면 그 정보로 `show` 적재.)
- **순수 티저** — 날짜·라인업 없는 "coming soon" 분위기 컷. (다만 "N월 N일 라인업/헤드라이너
  공개 예정" 같은 **공개 예고**는 skip하지 말고 `festival_info`의 `PROMO`로 흡수.)
- **부스/스태프/서포터즈 모집** — 업체·F&B 부스/경연·서포터즈·스태프·자원봉사 **모집** 공고.

> ⚠️ **티켓 공지·파트너/스폰서·경품/증정 이벤트·공개 예고는 더 이상 skip하지 않는다** —
> 각각 `festival_info`의 `TICKET`/`PROMO` 카테고리로 흡수한다(위 "수집 경계" 표 참조).
> `festivalKey`로 해당 연도 페스티벌에 묶고, `sourcePostUrl`은 각 게시물 URL로 개별 멱등.
> 라인업 **발표**만 `show`로 추출(요일 매핑).

스코프가 섞인 글(예: 서울 1일 포함 아시아투어 발표)은 국내 일정만 남기고 `notes`에 드롭 내역 기록.

## Past vs upcoming 스코프

- **새 계정 초기 크롤**(워치리스트 최초 추가, 또는 "전체 공연"/"히스토리부터") — 과거+예정
  **둘 다** 수집. 과거 공연도 실제 날짜로 `show` 적재(아티스트 히스토리·검색에 들어감).
  스크립트는 `date < today`로 게이트하지 않음. 최소 ~12개월 또는 "더 보기" 소진까지 스크롤.
- **이후 워치리스트 틱** — 예정 발표 + 공연장/날짜 세부가 있는 과거 공연(리캡 only는 skip).
  이미 적재된 공연의 리캡은 skip하되, 미적재 공연을 리캡이 언급하면 그 날짜/공연장으로 적재.
- payload `notes`에 적용 스코프 기록: `"initial backfill — N posts scanned, M months back"`
  또는 `"watchlist tick — checked since {lastShortcode}"`.

## Payload 계약 (zod 스키마 = `scripts/ingest.ts`)

```jsonc
{
  "source": {
    "type": "ig_post",          // 'ig_post'(기본) | 'web_page' | 'manual'
    "accountHandle": "string?",  // 예: "pentaport_official" (@ 없이)
    "postUrl": "https://...?",   // 게시물 URL (있으면 최우선 키)
    "shortcode": "string?",      // IG /p/{shortcode}
    "capturedAt": "ISO?"
  },
  "entities": [ /* 아래 4종 중 하나 이상 */ ],
  "notes": "string?",
  "reviewerConfidence": "high | medium | low?",
  "seeds": [                       // 선택: 워치리스트(seedAccount)에 등록할 추가 핸들
    { "handle": "@handle", "kind": "artist | festival | venue?" }  // kind 기본 'artist'
  ]
}
```

> **워치리스트 자동 확장 (ingest = snowball)**: ingest는 적재가 끝나면 **발견한 모든
> 아티스트 IG 핸들을 워치리스트(`seedAccount`)에 자동 등록**한다(`addedBy:'ingest'`,
> `status:'pending'`). 소스는 두 곳: ① 모든 `show.artists[].igHandle`(라인업·단독공연
> 아티스트) ② payload 최상위 `seeds[]`(캡션 멘션 등 show에 안 묶인 핸들, festival/venue
> 핸들). 규칙: 이미 `seedAccount`에 있으면(어떤 status든) skip(운영자의 rejected/dead
> 결정 존중), 크롤 대상 본인 계정은 skip, 잘못된 형식 핸들은 skip. 즉 **아티스트 핸들만
> 정확히 `igHandle`에 담아두면, 그 아티스트가 다음 워치리스트 틱의 크롤 대상으로 자동
> 편입**된다. (이전엔 crawler `expandSeed`만 이 일을 했고 manual ingest는 안 했음 — 이제
> 양쪽 다 한다.) 결과는 실행 후 요약의 `seeds: reg=N skip=M`으로 보고된다.

`entities[]`는 `kind`로 구분되는 discriminated union 4종:

### 1) `kind: "show"` — 단독공연 / 페스티벌 내부 공연

```jsonc
{
  "kind": "show",
  "title": "string?",                 // 부제가 광고될 때만 ('마지막 고요', 〈Harvest Days〉). 없으면 생략
  "sessions": [                       // v6: "1 캘린더 공연 = 1 session"
    {
      "date": "YYYY-MM-DD",           // 필수, ISO
      "startTime": "HH:MM?",          // 24h. "오후 7시" → "19:00"
      "endTime": "HH:MM?",
      "ticketUrl": "https://...?",
      "ticketOpenAt": "ISO datetime?",     // 일반 예매 오픈
      "presaleOpenAt": "ISO datetime?",    // 선예매(카드사 등) 오픈 — 일반보다 앞섬. 없으면 생략
      "capacity": 0,
      "notes": "string?"
    }
  ],
  "venueText": "string?",             // 공연장 원문 그대로 (canonicalize됨, 공백 정규화 X)
  "venueRegion": "string?",
  "artists": [{ "name": "필수", "igHandle": "?(소문자,@없이)", "aliases": ["?"], "imageSource": "/tmp/...?" }],
  "festivalKey": "string?",           // 페스티벌 내부 공연이면 부모 festival key
  "ticketUrl": "https://...?",
  "imageSource": "string?",           // URL/로컬경로 → Supabase Storage 업로드
  "stage": "string?",
  "setOrder": 0
}
```

- artist `imageSource`는 IG `profile_pic_url_hd`(Step 3)의 로컬 경로/URL. 행의 `imageUrl`이
  null일 때만 기록되어 기존 아트워크(Spotify) 보존.
- **deprecated** 최상위 `date`/`startTime`/`ticketUrl`은 그대로 받되 `sessions[0]`로 자동
  승격(경고 출력). 신규 작성은 **반드시 `sessions[]`** 사용.
- **다일(multi-day) 동명 공연은 절대 N개 show로 쪼개지 말 것** → 1개 show에 N개 session.
- `festivalKey`가 있으면 부모 페스티벌 값(이름·장소·티켓·이미지)을 상속.

### 2) `kind: "festival"`

```jsonc
{
  "kind": "festival",
  "name": "필수",                     // 이름에서 연도 빼기 ("2026 펜타포트"→name "펜타포트", year 2026)
  "year": 2026,                       // 2000~2030
  "startDate": "YYYY-MM-DD?",
  "endDate": "YYYY-MM-DD?",
  "locationText": "string?",
  "officialUrl": "https://...?",
  "ticketUrl": "https://...?",
  "posterImageSource": "string?",     // → Storage 업로드
  "description": "string?",
  "igHandle": "string?"
}
```

- 식별 키: `festivalStrongKey(name, year)` = 이름에서 연도 제거·공백 제거·소문자화·특수문자
  제거(한글 보존) + `__{year}`. 같은 페스티벌의 같은 해는 한 행으로 수렴.
- 추측 전 기존 행 확인: `SELECT canonicalKey FROM "Festival" WHERE name ILIKE '%펜타%';`

### 3) `kind: "festival_info"` — 관람정보

```jsonc
{
  "kind": "festival_info",
  "festivalKey": "필수",
  "category": "MAP | TIMETABLE | ACCESS | RULES | FAQ | GOODS | AMENITY | TICKET | PROMO | NOTICE",
  "title": "string?",
  "sourcePostUrl": "https://...?",    // @unique 멱등 키
  "imageSources": ["url", "..."],     // 여러 장 업로드 (예: 타임테이블 이미지)
  "bodyText": "string?",
  "postedAt": "ISO?",
  "order": 0
}
```

- `sourcePostUrl` 미지정 시 `originalPostUrl(source, "info-<category>")`로 안정화되어
  category당 1행 멱등 유지.
- ⚠️ **`imageSources`엔 캐러셀 전 슬라이드를 넣어라.** 타임테이블·사이트맵·규정 등은 거의
  항상 여러 장(DAY1/2/3, 구역별)이다. embed 대표 1장만 넣으면 핵심 정보가 잘린다 — Pass 2의
  캐러셀 전체 수집으로 모든 슬라이드를 받아 순서대로 배열에 넣는다. (재적재 시 `imageUrls`는
  새 배열로 교체되므로, 1장→전체로 고치려면 전 슬라이드를 담아 재적재하면 된다.)

**카테고리 분류 가이드** — 포스트의 *주된 정보*로 판정:

| 신호 | category |
| --- | --- |
| 사이트맵 · 배치도 · 부스맵 · 시설 위치도 | `MAP` |
| 타임테이블 · 러닝오더 · 요일/스테이지별 출연표 | `TIMETABLE` |
| 교통 · 주차 · 셔틀버스 · 오시는 길 | `ACCESS` |
| 입장 규정 · 반입 금지 · 재입장 · 연령 제한 | `RULES` |
| 자주 묻는 질문 · Q&A | `FAQ` |
| MD/굿즈 · 푸드트럭 · F&B 라인업 | `GOODS` |
| 편의시설 · 물품보관 · 우천 대비 · 구급/의무실 | `AMENITY` |
| 티켓 오픈·예매처·가격·얼리버드·블라인드·프리세일·매진·현장판매·VIP/프리미엄 패스·예매 D-day | `TICKET` |
| 파트너/스폰서 브랜드 소개 · 브랜드 콜라보 · 경품/추첨(로또 등)·증정 이벤트 · 자동차/전시 라인업 · 라인업·헤드라이너 **공개 예고**(announcement-of-announcement) | `PROMO` |
| 그 외 관람객 안내 공지 | `NOTICE` |

**수집 경계** — 페스티벌·공연과 직접 묶이는 게시물은 **버리지 말고 카테고리로 흡수**한다.
티켓 판매/가격/매진 공지 → `TICKET`, 파트너·스폰서·경품·예고 등 홍보성 → `PROMO`, 나머지
관람 안내 → 위 표대로. **날짜·장소가 박혀 있어도** 게시물의 주된 목적이 새 라인업/공연이
아니면 `show`/`festival`로 만들지 말고 해당 `festival_info` 카테고리로 넣는다(예: 티켓 공지에
페스티벌 일자·장소가 적혀 있어도 `TICKET`). 라인업·헤드라이너 **발표**는 `show`(요일 매핑),
공개 **예고**(“N월 N일 공개 예정”)는 `PROMO`. 진짜로 버리는 것은 아래 **Always-skip**뿐
(해외 공연·대학축제·끝난 공연 자축 리캡/아프터무비·날짜 없는 순수 티저·부스/스태프/서포터즈
모집). 애매하면 confidence 낮추고 `NOTICE`.

### 4) `kind: "setlist"` — 아티스트 계정발 셋리스트 비파괴 보강

```jsonc
{
  "kind": "setlist",
  "festivalKey": "필수",
  "artistName": "필수",
  "date": "YYYY-MM-DD",               // 필수
  "songs": [                          // 최소 1곡 (.min(1))
    { "title": "필수", "isEncore": false, "coverOf": "원곡자?" }
  ],
  "sourceNotes": "string?"
}
```

- **아티스트 계정 크롤 시 사용.** 셋리스트는 페스티벌 포스터엔 없고 아티스트 글에만 있음.
  **새 Show를 만들지 않고**, `festivalKey + artistName(canonical) + date(session)`로 기존
  (페스티벌 계정이 만든) Show를 찾아 셋리스트만 붙인다.
- 매칭 실패 시 **skip**(새로 안 만듦). 해당 Show에 **이미 셋리스트가 있으면 skip**(운영자
  편집 보호). 운영자 편집은 `/admin/setlists`.
- 라인업·공연의 1차 원천은 항상 **페스티벌 계정**이라는 원칙. 아티스트 계정에선 출연
  공연에 대해 **`setlist`만** emit(셋리스트 없으면 아무것도 emit 안 함).

> 적재는 다른 엔티티(festival → show → festival_info)를 모두 처리한 **마지막 pass**에서
> 실행된다(기존 Show가 있어야 매칭되므로).

## 멱등성 / dedupe 규칙

- **Show 자연 키 = `originalPostUrl`**: `source.postUrl` → `https://www.instagram.com/p/{shortcode}/`
  → `https://www.instagram.com/{accountHandle}/#{anchor}`. 같은 게시물 재적재 = 같은 키.
- **Festival 키 = `festivalStrongKey(name, year)`**.
- **FestivalInfo 키 = `sourcePostUrl`** (@unique).
- **Artist 키 = `canonicalizeArtistName(name).key`**, **Venue 키 = `canonicalizeVenueText(text).key`**.
- 다일 공연 = 단일 show + 다중 session.
- 아티스트/공연장 이름은 ingest가 `correction-map.json`(있으면)으로 결정적 치환 → 표기가
  흔들려도 OK; 사람 교정 누적 시 자동 보정.

### igHandle 충돌 — 표기가 달라도 같은 계정은 1행 (Artist·Festival)

`Artist.igHandle`과 `Festival.igHandle`은 둘 다 **@unique**다. 이 때문에 실전에서 충돌이
난다 — ingest.ts가 회피하도록 보강돼 있으니 동작을 알아두면 payload 작성이 쉬워진다:

- **Artist**: canonicalName이 달라도(예 payload "PIXIES" vs DB "픽시즈") **igHandle이 같으면
  같은 아티스트**다. ingest는 canonicalKey 미스 시 **igHandle로 재조회**해 기존 행에 링크하고
  현재 표기를 alias로 병합한다. → payload엔 **영문/한글 어느 표기든 + 정확한 igHandle**만
  넣으면 안전. (펜타포트 2026 영문 헤드라이너 9팀이 기존 한글 행과 이렇게 합쳐졌다.)
- **Festival**: 한 계정(@pentaportrf)이 **여러 해** 페스티벌을 운영하므로 igHandle이 연도마다
  겹친다. ingest는 이미 다른 연도 festival이 그 igHandle을 점유 중이면 **이번 행엔 igHandle을
  비운다**(첫 연도만 보유). → 세 연도 payload 모두 `igHandle:"pentaportrf"`를 넣어도 OK.
- 그래도 payload 작성 전 기존 행 확인 권장:
  `SELECT "canonicalName","igHandle" FROM "Artist" WHERE "igHandle"='massiveattackofficial';`

### 1개 show vs 여러 show

**1 show + N sessions** — 같은 아티스트 + 같은 title + 같은 venue + 같은 연도(일수 무관):
- Ding! 2025 토 7PM + 일 5PM @ 노들섬 → 1 show, 2 sessions
- 'Cloud Cuckoo Land' 12/23 + 12/24 @ 상상마당 → 1 show, 2 sessions

**여러 show (병합 금지)** — title이 같아 보여도:
- 다른 venue(투어): Hyukoh 서울 vs 부산 → 2 shows
- 다른 연도: Ding! 2024 vs 2025 → 2 shows
- 페스티벌 멀티데이 출연: Day1 + Day2 같은 아티스트 → 2 shows (같은 festivalKey, 셋리스트 다를 수 있음)
- 같은 venue 7일+ 간격 앵콜/재공연 → 2 shows

1 show N sessions일 때: `imageSource` 1회(포스터는 show당), `festivalKey` 1회, artist
`imageSource`는 Artist 행에(세션 아님).

### 게시물 1개 → 엔티티 여러 개

- 페스티벌 2차 라인업 → 1 `festival` + N `show`(+ 타임테이블 `festival_info`)
- 단일 아티스트 멀티나잇 → 1 `show` 다중 session
- 투어 발표 → N `show`(도시별), festival 없음
- 확신 없으면 적게 emit하고 `notes`에 갭 기록

### ⚠️ 페스티벌 라인업은 "연도당 1 payload"로 합쳐라 (1·2·3차 dedup)

페스티벌은 라인업을 **1차·2차·3차·최종**으로 나눠 여러 게시물로 발표한다. 그런데 Show
자연키는 **게시물 URL** 기반이라, 같은 아티스트가 1차와 최종에 둘 다 나오면 게시물별로
payload를 만들면 **같은 공연이 show 2개로 중복**된다(ingest는 자동 병합 안 함).

→ **그 해의 모든 라인업 발표 캡션을 모아 아티스트 단위로 dedup**한 뒤, **연도당 payload 1개**
(festival 1 + 중복 제거된 show N + festival_info M)로 적재한다. 모든 show의 source.postUrl은
**그 해 대표 라인업 게시물 1개**(보통 @핸들 최다=최종/직전 라인업)를 공유 → 재실행해도 멱등.
단 `festival_info`는 각자 자기 게시물 URL을 `sourcePostUrl`로 **명시**해 개별 멱등 유지.

요일별 날짜 매핑: 라인업 캡션이 요일 섹션(예 `FRI.JULY.31 / SAT.AUG.1 / SUN.AUG.2`,
`2025.8.1 FRI`)으로 아티스트를 나누면 각 show의 session date로 **정확히** 매핑. 요일 미발표
아티스트(예 2차 NEW 헤드라이너)는 **sessions 생략**(날짜 추측 금지) — 아티스트만 festival에
연결되고, 나중에 요일 발표 시 보강. (펜타포트 2026 8팀, 2025 일부가 이 케이스였음.)

### 개별 아티스트 소개 게시물은 보통 skip

페스티벌 계정은 라인업 발표와 별개로 **아티스트 1팀당 소개 게시물**("8.3 SUN / 밴드명
@handle / bio")을 다수 올린다. 출연 정보(아티스트·요일·핸들)는 **이미 종합 라인업 캡션에
다 들어있으므로** 개별 소개글은 중복이다 → **skip**(bio·사진은 우리 스키마에서 안 씀).
종합 라인업이 텍스트로 존재하는 한 개별 소개는 추출 불필요. (펜타포트 263건 중 200여 건이
이 부류라 skip 처리.)

---

# 3. Apply — 스크립트 실행

```bash
# 권장: run-ingest.sh 래퍼 (Node 22 보장 + .env 자동 로드)
pnpm ingest payload.json
pnpm ingest --dry-run payload.json        # DB 변경 없이 검증만

# 동등한 직접 실행
pnpm tsx scripts/ingest.ts payload.json
pnpm tsx scripts/ingest.ts < payload.json
```

- 인자는 **`.json`으로 끝나는 파일 경로** 또는 **stdin**. 둘 다 없으면 종료(exit 2).
- `DIRECT_URL` 환경변수 필요(없으면 종료). 래퍼가 `.env` 로드.
- `--dry-run`으로 **항상 먼저 검증** 후 실 적재.

> 이 머신은 기본 `node`가 Homebrew 25라 tsx/Prisma가 hang 한다. 반드시 `pnpm ingest`
> 래퍼(nvm Node 22)를 쓸 것. 직접 tsx 호출 시 Node 22 활성화 확인.

스크립트가 하는 일:
1. payload 검증(zod). 에러 시 경로 출력하고 중단.
2. 각 `festival`: strong canonical key 계산, 행 upsert, alias 첨부.
3. 각 `show`: venue+artist 이름 정규화, Venue upsert, Artist find-or-create, Show를
   `originalPostUrl`로 upsert, `sessions[]`를 `(showId, date)`로 upsert, 아티스트 링크,
   festivalKey 매칭 시 festival 연결, `firstSessionDate`/`lastSessionDate` 갱신.
   **DB엔 있으나 payload에 없는 session은 그대로 둠**(비파괴 — 취소 세션은 수동 삭제).
   - Artist find-or-create는 `igHandle`(소문자) 링크와 `imageSource`(프로필 사진) 갱신까지
     수행한다. **`igHandle`은 비어 있을 때만**(다른 아티스트가 점유 중이면 skip), **`imageUrl`도
     비어 있을 때만** 채운다(Spotify enrichment 아트워크 보존).
4. 각 이미지: 다운로드 → webp ≤1200px 리사이즈 → `posters` 버킷 업로드 → 공개 URL 기록.
5. show별 `completeness`/`needsReview` 재계산.
6. **워치리스트 seed 등록**: 발견한 아티스트 `igHandle`(+ `seeds[]`)을 `seedAccount`에
   `pending`으로 자동 등록(이미 있으면 skip, 본인/잘못된 핸들 skip). 위 "워치리스트 자동
   확장" 박스 참조.
7. `search_index` materialized view 갱신.
8. 감사 로그 `.omc/ingest-log/{ts}.json` 기록(insert vs update, 이미지 바이트, seed, 경고).

## 실행 후 보고

- 엔티티 종류별 insert vs update 카운트 (festivals/shows/artists/venues/info/setlists)
- **워치리스트 seed 등록 수** (`seeds: reg=N skip=M`)
- 검증 경고
- 감사 로그 경로
- 검색 가능해진 것 한 줄 요약

빈 방문(관련 없는 게시물)은 `entities: []` payload를 그대로 받아 방문만 감사 로그에 기록 —
"이 계정 확인함, 관련 없음" 추적에 유용.

## 적재 후 마무리 — 검증 + 표시 정리 (직접 DB 수정 시 주의)

ingest는 끝에 `search_index`를 자동 refresh하지만, **적재 후 prisma로 행을 직접 수정하면
검색 인덱스가 안 따라간다.** 표시명/상태를 손봤다면 반드시 다음을 확인·갱신한다:

1. **연도 접두어**: festival `name`은 `"2026 인천펜타포트 락 페스티벌"`처럼 연도 prefix가
   컨벤션(다른 festival 전부 그러함). worker가 `name`에 연도를 안 붙였거나 `"2024 ... 2024"`
   중복이면 [scripts/festival-add-year-prefix.ts](scripts/festival-add-year-prefix.ts) 실행
   (idempotent, 원래 이름 alias 보존, 끝에 search_index refresh 포함).
2. **status**: ingest는 festival/show를 `status:'APPROVED'`로 **즉시 공개** 적재한다(이 프로젝트
   결정사항 — PENDING 아님). 단 재적재가 update 경로를 타면 일부 행이 옛 PENDING으로 남을 수
   있으니 `SELECT status FROM "Show" WHERE ...`로 확인, PENDING 잔여는 APPROVED로.
3. **search_index 수동 refresh**(직접 수정했을 때만):
   `REFRESH MATERIALIZED VIEW CONCURRENTLY search_index;` — 안 하면 **검색·조회에서 누락**된다.
   검증: `SELECT count(*) FROM search_index WHERE kind='festival' AND body ILIKE '%펜타포트%';`
4. **이미지 검증**: 포스터 URL HTTP 200 확인. 사이트에서 "잘려" 보이는 건 import 실패가 아니라
   카드 비율(object-fit) 표시 동작 — 원본은 webp ≤1440px로 온전. import 성공 여부는 DB의
   `posterImageUrl` HEAD 200 + `imagesUploaded` 카운트로 판단한다.
5. **무아티스트 show 점검**: `Show` 중 `artists` 0개인 행이 있으면 igHandle 충돌로 링크 실패한
   잔재일 수 있다(위 igHandle 규칙). 재적재하면 fallback이 연결한다.
6. ⚠️ **배포본(Vercel) ISR 캐시 무효화 — ingest 직접 적재로는 안 비워진다.** `festivals/[id]`·
   `shows/[id]`는 `export const revalidate = 86400`(1일) 풀라우트 캐시다. `/admin/review`의
   **승인 버튼**만 `revalidatePath('/festivals/[id]','page')`를 호출한다(`apps/web/app/admin/actions.ts`).
   ingest 스크립트는 이 경로를 안 타므로, **DB엔 새 데이터가 있어도 배포 사이트는 캐싱된 옛
   HTML(예: 이미지 1장 시절)을 계속 서빙**한다. 브라우저 캐시 삭제로도 안 바뀜(서버 측 캐시).
   증상: festival_info 카드의 **장수 배지(`imageUrls.length>1`일 때만 표시)가 안 보이거나**
   라이트박스가 1장만. 해결(택1):
   - **가장 간단**: `/admin`에서 해당 festival **재승인**(이미 APPROVED여도 OK) → revalidatePath 실행 → 즉시 반영. (실전 확인됨)
   - on-demand revalidate API 라우트가 있으면 그걸로 `/festivals/[id]` 무효화.
   - 급하지 않으면 `revalidate=86400`이라 최대 1일 뒤 자동 갱신.
   로컬 dev(`pnpm dev`)는 캐시가 약해 보통 새로고침이면 됨 — 이 이슈는 **배포본 한정**.

---

# Watchlist mode

사용자가 "워치리스트 돌려줘" / "run watchlist" / "전체 계정 확인"이라 하면
`.omc/ingest-watchlist.json`을 읽어 `accounts[]`의 모든 항목을 순회.

```json
{
  "accounts": [
    {
      "handle": "silicagel.official",
      "lastShortcode": "DYmExJyCTrK",
      "lastCheckedAt": "2026-05-25T05:16Z",
      "notes": "Korean shows only — skip overseas tour dates."
    }
  ]
}
```

## 계정별 루프

1. Claude in Chrome으로 `https://www.instagram.com/{handle}/` 이동.
2. 위 **Extract** 스니펫으로 게시물 스크랩.
3. `lastShortcode`보다 **새로운** 게시물만 필터 — IG는 최신순 반환이므로 첫 매칭 전까지
   전부 취함. `lastShortcode`가 없거나 현재 페이지에 없으면 최신 6개를 cold-start 기준선으로.
4. 각 새 게시물: 일반 **Shape** 분류. event 신호 없는 reel·리캡·사진덤프 skip. 계정별
   `notes` 준수(예: "해외 일정 skip", "핸들을 암묵적 아티스트로").
5. **계정당 1개**의 ingest payload 작성(게시물당 X) — `entities[]`에 여러 게시물의 show/
   festival 다수 담김. 최신 게시물 URL을 `source.postUrl`로, `source.batch: true` 추가.
6. dry-run 먼저, 그다음 apply.
7. 성공 후 워치리스트 항목 갱신:
   - `lastShortcode` ← 본 가장 새 게시물 shortcode(적재/스킵 무관 — 재평가 방지)
   - `lastCheckedAt` ← 현재 UTC ISO
8. 새 게시물 0개면 `lastCheckedAt`만 갱신, 엔티티 0개. 빈 방문은 스크립트 호출 생략.

## 최종 보고 (전체 루프 후)

| handle | new posts | shows ins/upd | festivals ins/upd | seeds reg | skipped (reason) |
|---|---|---|---|---|---|

+ 감사 로그 경로들, 에러난 계정(로그인 월·rate limit·핸들 변경). 에러는 그 계정의
`lastShortcode`를 갱신하지 않음 — 다음 런에서 재시도.

> **워치리스트가 둘이다 — 헷갈리지 말 것.**
> - **`seedAccount`(DB 테이블)**: 크롤러 자동화(`packages/crawler`)가 소비하는 운영 큐.
>   ingest의 **아티스트 핸들 자동 등록은 여기로** 들어간다(`status:'pending'`). 즉 발견된
>   아티스트는 **자동 크롤러가 다음 런에 알아서 집어간다**.
> - **`.omc/ingest-watchlist.json`(파일)**: 이 스킬의 수동 watchlist 모드 루프가 도는 목록
>   (handle + lastShortcode + notes). 에이전트가 직접 크롤할 계정 목록.
>
> 자동 등록은 DB(`seedAccount`)에만 한다. 발견한 계정을 **에이전트 수동 루프에서도** 돌리고
> 싶으면 JSON 파일에도 "워치리스트에 추가"로 넣는다(아래 섹션). 보통은 seedAccount 등록만으로
> 충분하다(크롤러가 처리).

## 워치리스트에 추가

"X 계정 워치리스트에 추가" / "add @X to watchlist":

1. `{ "handle": "X", "lastShortcode": null, "lastCheckedAt": null }`를 `accounts[]`에 append.
2. 그 계정 **초기 백필** 실행(최신 게시물만 X) — Past vs upcoming 규칙대로 과거+예정 국내
   공연 스크랩, 대학축제/해외/리캡 제외, 날짜+공연장 있는 것 전부 적재.
3. 백필 후 `lastShortcode`를 스크랩 중 본 **가장 새 shortcode**로 설정(재처리 방지).
4. 일반 ingest처럼 요약 보고 + "scanned N posts back to {date}" 한 줄.

사용자가 추가 시 "최근 게시글만"이라 명시하면 백필 생략, 최신 게시물로 `lastShortcode` 시드.

---

# 예시

## 예시 1 — IG 단일 공연

```json
{
  "source": { "type": "ig_post", "accountHandle": "hyukoh",
              "postUrl": "https://www.instagram.com/p/DXabc123/",
              "shortcode": "DXabc123", "capturedAt": "2026-05-25T03:14:00Z" },
  "entities": [{
    "kind": "show",
    "sessions": [{ "date": "2026-09-12", "startTime": "20:00",
                   "ticketUrl": "https://ticket.melon.com/.../HUKM2026" }],
    "venueText": "현대카드 언더스테이지", "venueRegion": "서울",
    "artists": [{ "name": "혁오", "igHandle": "hyukoh", "aliases": ["HYUKOH"],
                  "imageSource": "/tmp/ingest-artist-hyukoh.jpg" }],
    "imageSource": "/tmp/ingest-DXabc123-poster.jpg"
  }],
  "reviewerConfidence": "high"
}
```

## 예시 2 — 다일 동명 단독공연 (1 show, N sessions)

```json
{
  "source": { "type": "ig_post", "accountHandle": "6th_saturday",
              "postUrl": "https://www.instagram.com/p/DQv9wABEoAe/",
              "shortcode": "DQv9wABEoAe", "capturedAt": "2025-11-07T03:00:00Z" },
  "entities": [{
    "kind": "show", "title": "Ding!",
    "sessions": [
      { "date": "2025-12-20", "startTime": "19:00", "ticketOpenAt": "2025-11-13T11:00:00Z" },
      { "date": "2025-12-21", "startTime": "17:00", "ticketOpenAt": "2025-11-13T11:00:00Z" }
    ],
    "venueText": "노들섬 라이브하우스", "venueRegion": "서울",
    "artists": [{ "name": "정우", "igHandle": "6th_saturday",
                  "imageSource": "/tmp/ingest-artist-6th_saturday.jpg" }],
    "imageSource": "/tmp/ingest-DQv9wABEoAe-1.jpg"
  }],
  "reviewerConfidence": "high"
}
```

## 예시 3 — 페스티벌 2차 라인업 + 내부 공연 + 타임테이블

```json
{
  "source": { "type": "ig_post", "accountHandle": "pentaportrf",
              "postUrl": "https://www.instagram.com/p/DYTZ5RFmTD5/",
              "shortcode": "DYTZ5RFmTD5", "capturedAt": "2026-05-13T05:00:00Z" },
  "entities": [
    { "kind": "festival", "name": "인천펜타포트 락 페스티벌", "year": 2026,
      "startDate": "2026-07-31", "endDate": "2026-08-02",
      "locationText": "인천 송도 달빛축제공원", "igHandle": "pentaportrf",
      "posterImageSource": "/tmp/pentaport-2nd-lineup.jpg" },
    { "kind": "show", "festivalKey": "인천펜타포트락페스티벌__2026",
      "sessions": [{ "date": "2026-08-02" }],
      "venueText": "인천 송도 달빛축제공원",
      "artists": [{ "name": "PIXIES", "aliases": ["픽시즈"] }] },
    { "kind": "show", "festivalKey": "인천펜타포트락페스티벌__2026",
      "sessions": [{ "date": "2026-08-01" }],
      "venueText": "인천 송도 달빛축제공원",
      "artists": [{ "name": "MASSIVE ATTACK", "aliases": ["매시브 어택"] }] },
    { "kind": "festival_info", "festivalKey": "인천펜타포트락페스티벌__2026",
      "category": "TIMETABLE", "title": "DAY2 타임테이블",
      "imageSources": ["/tmp/ingest-DYTZ5RFmTD5-3.jpg"] }
  ],
  "reviewerConfidence": "high"
}
```

## 예시 4 — 빈 방문 (관련 콘텐츠 없음)

```json
{
  "source": { "type": "ig_post", "accountHandle": "someband",
              "postUrl": "https://www.instagram.com/someband/",
              "shortcode": "", "capturedAt": "2026-05-25T03:20:00Z" },
  "entities": [],
  "notes": "scrolled latest 20 posts, all photo dumps; no upcoming shows announced",
  "reviewerConfidence": "high"
}
```

---

# 주의 / gotchas

- 추측으로 날짜/라인업을 채우지 말 것. 모르면 비우고 confidence를 낮춘다.
- `--dry-run` 검증을 건너뛰지 말 것.
- `og:image`·그리드 썸네일을 `imageSource`로 쓰지 말 것(잘린 썸네일).
- **payload의 `name`엔 연도 넣지 말 것** — `name`+`year` 분리("2026 펜타포트" → name
  "인천펜타포트 락 페스티벌", year 2026). strongKey가 연도를 빼고 키잉하므로 연도가 섞이면
  멱등성이 깨진다. 단, **DB 표시명은 적재 후 연도 접두어를 붙이는 게 컨벤션**
  (festival-add-year-prefix.ts) — 입력은 연도 없이, 표시는 연도 있게.
- **정식 명칭**: 한글 "인천펜타포트 락 페스티벌"(붙여씀), 영문 "INCHEON PENTAPORT ROCK
  FESTIVAL", 장소 "인천 송도 달빛축제공원"(캡션엔 "Songdo Moonlight Festival Park"로도 나옴).
- **캡션 날짜 vs 포스터 날짜** 불일치 시 포스터(alt OCR)가 이긴다.
- 멀티데이 페스티벌은 `startDate`/`endDate` 둘 다(가운데 날 X).
- `reel` 게시물은 대개 공연 클립 — 명시적 예정 공연 텍스트 없으면 skip.
- `festivalKey`는 festival 엔티티의 `festivalStrongKey`와 정확히 일치해야 내부 공연이
  부모에 붙는다(불일치 시 고아 show).
- IG 공개 데이터 수집은 best-effort이며 차단·구조 변동이 잦다. 적재 전 사람 검토 전제
  (`/admin/review` → `scripts/review-learn.ts`가 `correction-map.json` 갱신).
