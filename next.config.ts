import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse(pdfjs-dist)는 worker 파일을 런타임에 로드하므로 번들링에서 제외
  serverExternalPackages: ["pdf-parse"],
  // 타입 가드 활성화: 타입 에러가 있으면 빌드를 막는다(기본값).
  // 과거 ignoreBuildErrors:true 로 인해 RANK_REQ 인덱싱 버그가 빌드에서
  // 걸러지지 않았다. (ESLint 는 Next 16 에서 빌드 통합이 제거됨 → CLI 로 별도 실행)
};

export default nextConfig;
