import fs from "node:fs/promises";

const read = async path => JSON.parse(await fs.readFile(new URL(path, import.meta.url), "utf8"));
const dashboard = await read("../data/dashboard.json");
const config = await read("../config/risk-weights.json");
const errors = [];
const validLevels = new Set(["평상시", "관심", "주의", "경계", "심각"]);
const validConfidence = new Set(["높음", "중간", "낮음"]);
const isUrl = value => { try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; } };

if (Number(dashboard.schemaVersion) < 3) errors.push("dashboard.schemaVersion은 3 이상이어야 합니다.");
if (!validLevels.has(dashboard.risk?.level)) errors.push("알 수 없는 위험도 단계입니다.");
if (!Number.isFinite(dashboard.risk?.score) || dashboard.risk.score < 0 || dashboard.risk.score > 100) errors.push("위험도 점수 범위가 잘못됐습니다.");
if (!validConfidence.has(dashboard.judgment?.confidence)) errors.push("판단 신뢰도가 누락됐습니다.");
if (!Number.isFinite(dashboard.dataQuality?.completeness) || dashboard.dataQuality.completeness < 0 || dashboard.dataQuality.completeness > 100) errors.push("정보 완전성 범위가 잘못됐습니다.");
if (!Array.isArray(dashboard.signalAssessments) || dashboard.signalAssessments.length !== Object.keys(config.events).length) errors.push("지표 수가 설정과 일치하지 않습니다.");
for (const signal of dashboard.signalAssessments || []) {
  if (!config.events[signal.id]) errors.push(`설정에 없는 지표: ${signal.id}`);
  for (const source of signal.sources || []) if (!isUrl(source.url)) errors.push(`열 수 없는 근거 URL: ${signal.id}`);
}
for (const item of dashboard.news || []) if (!isUrl(item.url)) errors.push(`열 수 없는 뉴스 URL: ${item.title || "제목 없음"}`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`검증 통과: 위험도 ${dashboard.risk.level} ${dashboard.risk.score}/100, 신뢰도 ${dashboard.judgment.confidence}, 완전성 ${dashboard.dataQuality.completeness}%`);
