import { NextRequest, NextResponse } from "next/server";
import { CAUSES, CAUSE_UNKNOWN, type AnalyzeItem, type CauseResult } from "../../lib/types";

/** reason을 3문장·200자 이내로 강제한다. (PRD 5번 (나) — 3문장 이내이면서 200자 이내) */
function limitReason(text: string): string {
  const trimmed = text.trim();
  const sentences = trimmed.split(/(?<=[.!?다요])\s+/).filter(Boolean).slice(0, 3);
  const joined = sentences.join(" ").trim() || trimmed;
  return joined.length > 200 ? joined.slice(0, 200) : joined;
}

function sanitizeResult(id: string, raw: unknown): CauseResult & { id: string } {
  const r = raw as { cause?: unknown; reason?: unknown } | undefined;
  const causeRaw = typeof r?.cause === "string" ? r.cause : "";
  const cause = (CAUSES as readonly string[]).includes(causeRaw)
    ? (causeRaw as CauseResult["cause"])
    : CAUSE_UNKNOWN;
  const reasonRaw = typeof r?.reason === "string" ? r.reason : "";
  const reason =
    cause === CAUSE_UNKNOWN && !reasonRaw
      ? "문서상 근거만으로는 원인을 특정할 수 없습니다."
      : limitReason(reasonRaw || "근거를 확인하지 못했습니다.");
  return { id, cause, reason };
}

const SYSTEM_PROMPT = `당신은 국가결산 질의 검증 도구에서 '불일치'로 판정된 항목의 회계기준 원인만 분석하는 서버 로직입니다.
다음 규칙을 반드시 지키세요.

1. 입력으로 주어지는 각 항목은 이미 계산으로 '불일치' 판정이 끝난 상태입니다. 질의 문장, 질의서가 인용한 값·기준, 원자료의 실제 값과 대상 계정만 근거로 왜 값이 다른지 판단하세요.
2. 아래 세 힌트 필드를 이 순서대로 확인하세요. 힌트가 있으면 그 힌트가 가리키는 사실만 근거로 원인을 고르고, "원인 미상"이라고 답하지 마세요. 힌트에 없는 내용을 추가로 추측하지 마세요.
   a. "인용값과_정확히_일치하는_다른_금액열" — 인용한 금액이 **같은 계정**의 다른 금액 열과 원 단위까지 정확히 일치합니다. 그 열이 추경안·예산안·본예산처럼 예산 성격이면, 또는 징수결정액·결산액처럼 결산 성격이면 → "결산기준"을 고르고, reason에 그 열 이름을 적으세요. 예산현액 관련 열이면 "예산현액기준"을 고르세요.
   b. "인용값과_정확히_일치하는_다른_계정" — 인용한 금액이 대조 대상과는 **다른 계정(행)**의 값과 원 단위까지 정확히 일치합니다. 즉 질의자가 계정 자체를 잘못 짚은 것입니다 → "기타"를 고르고, reason에 실제로 일치하는 계정 이름을 적으세요.
   c. "상위계층합계가아니라_하위항목부분합과일치" — 인용한 금액이 관·항 전체 합계가 아니라 그 아래 특정 하위 항목 하나의 부분합과 정확히 일치합니다. 즉 집계 계층(관/항)을 혼동한 것입니다 → "기타"를 고르고, reason에 어느 하위 항목의 부분합인지 적으세요.
3. 위 세 힌트가 모두 비어 있을 때만 아래 6개 중에서 판별 조건에 맞는 것을 고르세요. 그 외 표현을 만들어내지 마세요. 판별 조건에 들어맞지 않으면 반드시 "원인 미상"이라고 답하세요.
   - 세입기준: 세입 계정 수치를 물었는데 세출 계정 수치를 인용했거나, 그 반대인 경우
   - 결산기준: 예산 계정(추경안·예산현액) 수치를 결산 수치(징수결정액 등)로 인용했거나, 그 반대인 경우
   - 예산현액기준: 본예산·추경안과, 이월·전용을 반영한 예산현액을 혼동한 경우
   - 총계·순계 차이: 회계 간 전입·전출을 포함한 총계와 제외한 순계를 혼동한 경우
   - 회계연도 차이: 다른 회계연도의 수치를 인용한 경우
   - 기타: 위 다섯에 해당하지 않으나 문서상 기준 차이가 확인되는 경우
4. 추측하거나 지어낸 근거를 쓰지 마세요. 힌트도 없고 판별 조건에도 들어맞지 않으면 "원인 미상"으로 답하세요.
5. reason은 3문장 이내, 전체 200자 이내의 한국어 존댓말 단답형으로만 쓰세요.
6. 아래 JSON 형식으로만 답하세요. 다른 설명을 덧붙이지 마세요.
{"results":[{"id":"항목 id","cause":"...","reason":"..."}]}`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "서버에 OPENAI_API_KEY가 설정되어 있지 않습니다. 환경변수 파일에 값을 넣고 서버를 다시 시작해주세요.",
      },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const items: AnalyzeItem[] = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ results: [] });
  }
  // 상한 없이 한꺼번에 보내지 않는다 (PRD 5번 (가) 상한과 같은 취지)
  const batch = items.slice(0, 100);

  const userPrompt = JSON.stringify(
    batch.map((item) => ({
      id: item.id,
      질의문장: item.questionText,
      인용값: item.citedRaw,
      인용값_원화: item.citedWon,
      인용기준: item.basis,
      대조에쓴금액열: item.basisColumn,
      원자료값: item.actual,
      차이: item.difference,
      대상계정: item.targetLabel,
      인용값과_정확히_일치하는_다른_금액열: item.matchesOtherColumn ?? null,
      인용값과_정확히_일치하는_다른_계정: item.matchesOtherAccount ?? null,
      상위계층합계가아니라_하위항목부분합과일치: item.matchesSubAggregate ?? null,
    }))
  );

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI API error:", response.status, errText);
      return NextResponse.json(
        { error: "원인 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";

    let parsed: { results?: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }
    const rawResults = Array.isArray(parsed.results) ? parsed.results : [];
    const byId = new Map(
      rawResults.map((r) => [(r as { id?: unknown })?.id, r])
    );

    const results = batch.map((item) => sanitizeResult(item.id, byId.get(item.id)));
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Analyze route error:", error);
    return NextResponse.json(
      { error: "원인 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
