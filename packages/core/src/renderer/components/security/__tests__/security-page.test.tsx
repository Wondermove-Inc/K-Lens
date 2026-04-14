/**
 * SecurityPage observer 변경 verify (4a2bdf2a, 04f92bce)
 */
describe("SecurityPage — mobx-react-lite + findings stabilization (4a2bdf2a/04f92bce)", () => {
  // mobx-react-lite observer 사용 여부 확인
  it("security-page imports observer from mobx-react-lite (not mobx-react)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve(__dirname, "../security-page.tsx"), "utf-8");
    expect(src).toContain('from "mobx-react-lite"');
    expect(src).not.toContain('from "mobx-react"');
  });

  // rawFindings 패턴 확인
  it("security-page uses rawFindings pattern for findings retrieval", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve(__dirname, "../security-page.tsx"), "utf-8");
    expect(src).toContain("rawFindings");
    expect(src).toContain("findings.length");
  });
});
