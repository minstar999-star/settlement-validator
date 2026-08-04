// env.txt(사람이 직접 관리하는 값)를 Next.js가 실제로 읽는 .env.local로 복사한다.
// npm run dev/build/start 실행 전 자동으로 실행된다 (package.json의 pre* 스크립트).
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const source = path.join(root, "env.txt");
const target = path.join(root, ".env.local");

if (!fs.existsSync(source)) {
  console.warn(
    "[sync-env] env.txt가 없습니다. OPENAI_API_KEY 등 값을 env.txt에 넣어주세요."
  );
  process.exit(0);
}

fs.copyFileSync(source, target);
console.log("[sync-env] env.txt -> .env.local 동기화 완료");
