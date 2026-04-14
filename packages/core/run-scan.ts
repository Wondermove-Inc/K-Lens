import { execSync } from "child_process";
import { calculateSecurityScore } from "./src/common/security/security-score";
import { KubescapeScanner } from "./src/features/security/main/kubescape-scanner";
import { TrivyScanner } from "./src/features/security/main/trivy-scanner";

const TRIVY_PATH = execSync("which trivy").toString().trim();
const KUBESCAPE_PATH = execSync("which kubescape").toString().trim();
const KUBECONFIG = `${process.env.HOME}/.kube/config`;

async function main() {
  console.log("\n=== Security Scanner 통합 테스트 ===");
  console.log(`trivy: ${TRIVY_PATH}`);
  console.log(`kubescape: ${KUBESCAPE_PATH}`);
  console.log(`kubeconfig: ${KUBECONFIG}`);

  const trivyScanner = new TrivyScanner(TRIVY_PATH);
  const kubescapeScanner = new KubescapeScanner(KUBESCAPE_PATH);

  const trivyStatus = await trivyScanner.getStatus();
  const kubescapeStatus = await kubescapeScanner.getStatus();
  console.log(`\n[1] 스캐너 상태`);
  console.log(`  Trivy: available=${trivyStatus.available}, version=${trivyStatus.version}`);
  console.log(`  Kubescape: available=${kubescapeStatus.available}, version=${kubescapeStatus.version}`);

  console.log("\n[2] Trivy 스캔 시작...");
  const trivyResult = await trivyScanner.run({
    clusterId: "kind-kind",
    kubeconfigPath: KUBECONFIG,
    timeoutMs: 120_000,
    onProgress: ({ percent, message }) => process.stdout.write(`  [${percent}%] ${message}\r`),
  });

  let trivyFindings: any[] = [];
  if (trivyResult.success) {
    trivyFindings = trivyResult.result.findings;
    console.log(`\n  ✅ Trivy 완료: ${trivyFindings.length}개 finding`);
  } else {
    console.log(`\n  ❌ Trivy 오류: ${trivyResult.error.type} — ${trivyResult.error.message}`);
  }

  console.log("\n[3] Kubescape 스캔 시작...");
  const kubescapeResult = await kubescapeScanner.run({
    clusterId: "kind-kind",
    kubeconfigPath: KUBECONFIG,
    timeoutMs: 120_000,
    onProgress: ({ percent, message }) => process.stdout.write(`  [${percent}%] ${message}\r`),
  });

  let kubescapeFindings: any[] = [];
  if (kubescapeResult.success) {
    kubescapeFindings = kubescapeResult.result.findings;
    console.log(`\n  ✅ Kubescape 완료: ${kubescapeFindings.length}개 finding`);
  } else {
    console.log(`\n  ❌ Kubescape 오류: ${kubescapeResult.error.type} — ${kubescapeResult.error.message}`);
  }

  const merged = [...trivyFindings, ...kubescapeFindings];
  // ID 기반 dedup: 동일 리소스+컨트롤 조합이 두 스캐너에서 중복 감지되는 경우 방지
  const allFindings = [...new Map(merged.map((f) => [f.id, f])).values()];
  console.log(`\n[4] 전체 Finding: ${allFindings.length}개`);

  if (allFindings.length > 0) {
    const scoreResult = calculateSecurityScore(allFindings);
    const { score, grade, breakdown } = scoreResult;

    const bySeverity = allFindings.reduce((acc: any, f: any) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {});
    const byType = allFindings.reduce((acc: any, f: any) => {
      acc[f.type] = (acc[f.type] ?? 0) + 1;
      return acc;
    }, {});

    console.log(`\n=== 보안 점수 결과 ===`);
    console.log(`  점수: ${score.toFixed(1)} / 100`);
    console.log(`  등급: ${grade}`);
    console.log(`  Severity 분포:`, breakdown);
    console.log(`  Finding 유형:`, byType);
    console.log(`\n  샘플 Finding (5개):`);
    for (const f of allFindings.slice(0, 5)) {
      console.log(`    [${f.severity}] ${f.type} — ${f.title?.slice(0, 60)} (${f.resource?.kind}/${f.resource?.name})`);
    }
  }
  console.log("\n=== 완료 ===\n");
}

main().catch(console.error);
