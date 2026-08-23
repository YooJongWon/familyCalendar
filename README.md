# 함께 캘린더

Next.js + Supabase + FullCalendar 기반 권한별 단체 캘린더입니다. 제목과 메모는 Web Crypto API(AES-256-GCM)로 브라우저에서 암호화되어 저장됩니다.

## 시작하기

1. `npm install`
2. Supabase 프로젝트의 SQL Editor에서 `supabase/schema.sql` 실행
3. `.env.example`을 복사해 `.env.local`로 만들고 프로젝트 URL과 anon key 입력
4. `npm run dev`를 실행하고 WebStorm 브라우저에서 `http://localhost:3000` 열기

## 사용 방식

- 계정 가입 후 새 캘린더를 만듭니다. 생성자는 자동으로 owner가 됩니다.
- 구성원은 먼저 가입한 뒤 이메일로 추가할 수 있습니다.
- 암호키는 데이터베이스에 저장되지 않습니다. 구성원에게 별도 안전한 채널로 전달하세요. 분실하면 과거 일정의 제목과 메모를 복구할 수 없습니다.

Vercel에는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 환경 변수를 등록한 뒤 저장소를 연결하여 배포합니다.
