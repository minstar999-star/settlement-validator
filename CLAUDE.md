@AGENTS.md

# 프로젝트 규칙 (my-app — 결산질의 validator)

## 개요
- 재정경제부 회계결산과 실무자가 국회 질의서(PDF)와 D-Brain OLAP 결산자료(엑셀)를 올리면, 질의서에 인용된 수치를 OLAP 자료와 자동 대조하고, 불일치 시 회계기준 차이 원인을 분석해주는 검증 도구.
- 정식 요구사항은 `PRD.md`, 한 줄 요약은 `prd_lite.md` 참고. 새 기능을 만들기 전 반드시 PRD의 해당 항목(must/nice, 범위·비범위, 판정 규칙)을 먼저 확인한다.

## 기술 스택 (고정)
- **Next.js(App Router) — PRD 8번에서 고정한 스택. 다른 프레임워크로 바꾸거나 마이그레이션을 제안하지 않는다.**
- React 19 / TypeScript(strict) / Tailwind CSS v4
- 엑셀 파싱: `read-excel-file`, PDF 텍스트 추출: `pdfjs-dist` (모두 브라우저에서 처리)
- AI 모델: `gpt-4o-mini` — 불일치 원인 분석 전용, 서버(API 라우트)에서만 호출
- **배포는 Vercel을 사용한다.**
- Next.js 16.2.12는 학습 데이터 기준보다 최신 버전 — 새 API를 쓰기 전 `node_modules/next/dist/docs/`에서 해당 문서를 먼저 확인할 것 (`AGENTS.md` 지시사항).

## 작업 범위
- **새 파일은 반드시 이 `my-app` 폴더 안에만 만든다.** 바탕화면의 다른 폴더(예: `hello-page`)나 프로젝트 바깥에는 파일을 생성하지 않는다.
- PRD의 "비범위" 항목은 구현하지 않는다: HWP 직접 파싱, 회신 문서 자동 작성, D-Brain 직접 연동, 로그인·계정·권한 관리, 검증 이력 DB 저장, 다중 사용자 동시 사용.

## 폴더 구조
- `app/page.tsx` — 메인 화면 (업로드 / 검증 실행 / 결과 표)
- `app/layout.tsx`, `app/globals.css` — 레이아웃, 브랜드 컬러(남색 `#003668`, `불일치` 강조 빨강 `#e6002d`)
- `app/lib/pdf.ts` — 질의서 PDF 텍스트 추출
- `app/lib/excel.ts` — OLAP 엑셀 파싱 (회계·관·항·목·금액 열 확인)
- `app/lib/amount.ts` — 금액 표기 인식·단위 환산(조·억·백만·원)
- `app/lib/select.ts` — 질의 항목 분리, 검증 대상 수치 선별
- `app/lib/verify.ts` — 대조 판정(`일치`/`불일치`/`확인불가`) 로직
- `app/lib/vocabulary.ts` — 회계·관·항·목 등 용어/매칭 사전
- `app/lib/limits.ts` — 업로드 상한(PDF 50페이지·수치 100건·엑셀 5,000행 등) 상수
- `app/lib/types.ts` — 공용 타입 정의
- `sample-data/` — 개발·시연용 가상 더미데이터. 실제 내부망 자료(D-Brain, 질의사항 원본)는 절대 반입하지 않는다.

## 코딩 컨벤션
- **모든 설명, 주석, 커밋 메시지, 화면 문구는 한국어로 작성한다.**
- 판정 표기는 PRD에 정한 3가지(`일치`/`불일치`/`확인불가`)만 사용하고 임의로 다른 표현을 쓰지 않는다.
- 질의서 PDF·OLAP 엑셀 원본은 브라우저 안에서만 읽고 처리하며 서버로 올리지 않는다. 서버로 보내는 것은 불일치 원인 분석에 필요한 최소 텍스트·수치로 한정한다.
- 개인 식별 표현(위원명·직위 등)은 서버로 보내기 전에 반드시 제거한다.
- ESLint(`eslint-config-next` core-web-vitals + typescript) 통과 필수 — 작업 후 `npm run lint` 실행.

## 코드 변경 시 규칙
- **코드를 바꿀 때마다 무엇을 왜 바꿨는지 한 줄로 알려준다.**

## 비밀 정보 관리
- 비밀 정보 파일(이 프로젝트에서는 `env.txt`, 그 외 `.env*`)과 `node_modules`는 `.gitignore`에 등록된 상태를 유지하고 절대 커밋하지 않는다.
- **토큰 값을 사용자에게 묻거나 채팅·로그에 그대로 출력하지 않는다.** 외부 서비스 인증이 필요하면 `env.txt`에 있는 값을 코드나 CLI에서 읽어 사용한다.
  - 예: Supabase 작업이 필요하면 Supabase CLI를 설치해 `env.txt`의 `SUPABASE_ACCESS_TOKEN`으로 인증한다.
  - 예: Vercel 배포 작업이 필요하면 Vercel CLI를 설치해 `env.txt`의 `VERCEL_TOKEN`으로 인증한다.
- `OPENAI_API_KEY`는 서버(API 라우트) 코드에서만 사용하고, 클라이언트 코드나 API 응답에 절대 노출하지 않는다.
- Next.js는 `env.txt`를 자동으로 읽지 않는다. 값은 **`env.txt`에서만 직접 수정**하고, `npm run dev`/`build`/`start`를 실행하면 `scripts/sync-env.js`가 그 값을 `.env.local`로 자동 복사한다. `.env.local`은 자동 생성 파일이라 직접 고치지 않는다(다음 실행 때 덮어써진다).

## 파일 삭제 규칙
- **파일을 삭제해야 할 때는 즉시 지우지 않고 `trash-can/` 폴더로 옮겨만 둔다.** 최종 삭제는 사용자가 직접 확인한 뒤 처리한다.

## 서브에이전트 활용
- 이미 설치된 서브에이전트(코드 분석·갭 분석·QA 등)를 작업 성격에 맞게 필요할 때마다 적극 활용한다.

## 명령어
- `npm run dev` — 개발 서버
- `npm run build` — 프로덕션 빌드
- `npm run start` — 빌드 결과 실행
- `npm run lint` — ESLint 검사

## 작업 전 체크리스트
- 새 기능을 만들기 전 `PRD.md`의 해당 항목(업로드 규칙 / 질의 항목 선별 / 대조 판정 / 원인 분석)을 먼저 확인한다.
- Next.js/React 신규 API를 쓰기 전 `node_modules/next/dist/docs/`에서 버전에 맞는 문서를 확인한다.
- 배포·외부 서비스 연동 작업은 해당 CLI 설치 + `env.txt`의 토큰으로 진행한다.
