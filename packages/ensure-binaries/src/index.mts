#!/usr/bin/env node

/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import arg from "arg";
import { MultiBar } from "cli-progress";
import { constants, createWriteStream, type WriteStream } from "fs";
import { type FileHandle, mkdir, open, readFile, unlink } from "fs/promises";
import gunzip from "gunzip-maybe";
import { createRequire } from "module";
import fetch from "node-fetch";
import path from "path";
import { arch } from "process";
import { pipeline as _pipeline, Transform, Writable } from "stream";
import { extract } from "tar-stream";
import { promisify } from "util";
import z from "zod";

import type * as UnzipperType from "unzipper";

const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const unzipper = _require("unzipper") as typeof UnzipperType;

import { createHash } from "crypto";

import type { SingleBar } from "cli-progress";

const options = arg({
  "--package": String,
  "--base-dir": String,
  "--platform": String, // 🎯 타겟 플랫폼 지정 (darwin, linux, windows)
  "--arch": String, // 🎯 타겟 아키텍처 지정 (x64, arm64)
});

type Options = typeof options;

function assertOption<Key extends keyof Options>(key: Key): NonNullable<Options[Key]> {
  const raw = options[key];

  if (raw === undefined) {
    console.error(`missing ${key} option`);
    process.exit(1);
  }

  return raw;
}

function joinWithInitCwd(relativePath: string): string {
  const { INIT_CWD } = process.env;

  if (!INIT_CWD) {
    return relativePath;
  }

  return path.join(INIT_CWD, relativePath);
}

const pathToPackage = joinWithInitCwd(assertOption("--package"));
const pathToBaseDir = joinWithInitCwd(assertOption("--base-dir"));

function setTimeoutFor(controller: AbortController, timeout: number): void {
  const handle = setTimeout(() => controller.abort(), timeout);

  controller.signal.addEventListener("abort", () => clearTimeout(handle));
}

const pipeline = promisify(_pipeline);

function getBinaryExtension({ forPlatform }: { forPlatform: string }): string {
  if (forPlatform === "windows") {
    return ".exe";
  }

  return "";
}

interface BinaryDownloaderArgs {
  readonly version: string;
  readonly platform: SupportedPlatform;
  readonly downloadArch: string;
  readonly fileArch: string;
  readonly binaryName: string;
  readonly baseDir: string;
  readonly url: string;
}

abstract class BinaryDownloader {
  protected abstract readonly url: string;
  protected readonly bar: SingleBar;
  protected readonly target: string;

  protected getTransformStreams(file: Writable): (NodeJS.ReadWriteStream | NodeJS.WritableStream)[] {
    return [file];
  }

  /**
   * 체크섬 파일 URL. 서브클래스에서 오버라이드합니다.
   * 반환값이 undefined이면 체크섬 검증을 건너뜁니다.
   */
  protected get checksumUrl(): string | undefined {
    return undefined;
  }

  /**
   * 미리 계산된 아카이브 SHA256 해시를 체크섬 파일과 비교합니다.
   * checksumUrl이 undefined이면 검증을 건너뜁니다.
   *
   * @param actualHash  다운로드 스트림에서 계산한 hex SHA256
   * @param archiveFileName  체크섬 파일 내 탐색 키 (예: "trivy_0.69.3_macOS-ARM64.tar.gz")
   */
  protected async verifyChecksumHash(actualHash: string, archiveFileName: string): Promise<void> {
    const checksumUrl = this.checksumUrl;

    if (!checksumUrl) return;

    const res = await fetch(checksumUrl);

    if (!res.ok) {
      throw new Error(`Failed to fetch checksum file: ${checksumUrl} (${res.status})`);
    }

    const text = await res.text();

    // 포맷: "{sha256}  {filename}"
    const line = text.split("\n").find((l: string) => l.trimEnd().endsWith(`  ${archiveFileName}`));

    if (!line) {
      throw new Error(`Checksum not found for ${archiveFileName} in ${checksumUrl}`);
    }

    const expectedHash = line.split(/\s+/)[0].toLowerCase();

    if (actualHash.toLowerCase() !== expectedHash) {
      throw new Error(
        `Checksum mismatch for ${archiveFileName}:\n  expected: ${expectedHash}\n  actual:   ${actualHash}`,
      );
    }
  }

  constructor(
    public readonly args: BinaryDownloaderArgs,
    multiBar: MultiBar,
  ) {
    this.bar = multiBar.create(1, 0, args);
    this.target = path.join(args.baseDir, args.platform, args.fileArch, args.binaryName);
  }

  async ensureBinary(): Promise<void> {
    if (process.env.LENS_SKIP_DOWNLOAD_BINARIES === "true") {
      return;
    }

    const controller = new AbortController();

    setTimeoutFor(controller, 15 * 60 * 1000);

    const stream = await fetch(this.url, {
      signal: controller.signal,
    });

    if (!stream.ok) {
      throw new Error(`${this.url}: ${stream.status} ${stream.statusText}`);
    }

    const total = Number(stream.headers.get("content-length"));
    const bar = this.bar;
    let fileHandle: FileHandle | undefined = undefined;

    if (isNaN(total)) {
      throw new Error("no content-length header was present");
    }

    bar.setTotal(total);

    await mkdir(path.dirname(this.target), {
      mode: 0o755,
      recursive: true,
    });

    // 다운로드 스트림에서 아카이브 SHA256 병렬 계산
    const hasher = createHash("sha256");

    try {
      // O_TRUNC: 기존 파일 있으면 덮어쓰기 (재빌드 시 EEXIST 방지)
      const handle = (fileHandle = await open(this.target, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC));

      if (!stream.body) {
        throw new Error("no body on stream");
      }

      await pipeline(
        stream.body,
        new Transform({
          transform(chunk, encoding, callback) {
            bar.increment(chunk.length);
            hasher.update(chunk); // 아카이브 원본 청크로 해시 계산
            this.push(chunk);
            callback();
          },
        }),
        ...this.getTransformStreams(
          new Writable({
            write(chunk, encoding, cb) {
              handle
                .write(chunk)
                .then(() => cb())
                .catch(cb);
            },
          }),
        ),
      );
      await fileHandle.chmod(0o755);
      await fileHandle.close();
      // 체크섬 검증 — 아카이브 원본 해시 vs 체크섬 파일
      // (추출된 바이너리가 아닌 tar.gz 원본 SHA256으로 검증)
      await this.verifyChecksumHash(hasher.digest("hex"), path.basename(this.url));
    } catch (error) {
      await fileHandle?.close();

      await unlink(this.target).catch(() => {
        /* 이미 없으면 무시 */
      });
      throw error;
    }
  }
}

// ============================================
// 🎯 tar.gz 추출 (macOS, Linux 공용)
// ============================================

class TarGzBinaryDownloader extends BinaryDownloader {
  protected readonly url: string;

  constructor(args: BinaryDownloaderArgs, bar: MultiBar) {
    super(args, bar);
    this.url = args.url;
  }

  protected getTransformStreams(file: Writable) {
    const targetBinaryName = this.args.binaryName;
    const extracting = extract({
      allowUnknownFormat: false,
    });

    extracting.on("entry", (headers, stream, next) => {
      const entryName = path.basename(headers.name ?? "");

      if (entryName === targetBinaryName) {
        stream
          .pipe(file as unknown as NodeJS.WritableStream)
          .once("finish", () => next())
          .once("error", next);
      } else {
        stream.resume();
        next();
      }
    });

    return [gunzip(3), extracting];
  }
}

// ============================================
// 🎯 zip 추출 (Windows 전용 — Trivy)
// ============================================

class ZipBinaryDownloader extends BinaryDownloader {
  protected readonly url: string;

  constructor(args: BinaryDownloaderArgs, bar: MultiBar) {
    super(args, bar);
    this.url = args.url;
  }

  /**
   * zip 파일에서 바이너리를 추출합니다.
   * unzipper를 사용하여 zip 내부의 targetBinaryName 파일만 추출합니다.
   */
  override async ensureBinary(): Promise<void> {
    if (process.env.LENS_SKIP_DOWNLOAD_BINARIES === "true") {
      return;
    }

    const controller = new AbortController();

    setTimeoutFor(controller, 15 * 60 * 1000);

    const stream = await fetch(this.url, {
      signal: controller.signal,
    });

    if (!stream.ok) {
      throw new Error(`${this.url}: ${stream.status} ${stream.statusText}`);
    }

    const total = Number(stream.headers.get("content-length"));

    if (isNaN(total)) {
      throw new Error("no content-length header was present");
    }

    this.bar.setTotal(total);

    await mkdir(path.dirname(this.target), {
      mode: 0o755,
      recursive: true,
    });

    if (!stream.body) {
      throw new Error("no body on stream");
    }

    const bar = this.bar;
    const target = this.target;
    const binaryName = this.args.binaryName;
    // 다운로드 중 zip 원본 SHA256 계산 (체크섬 검증용)
    const hasher = createHash("sha256");

    // 진행률 업데이트 + SHA256 계산을 동시에 수행
    const progress = new Transform({
      transform(chunk, encoding, callback) {
        bar.increment(chunk.length);
        hasher.update(chunk);
        this.push(chunk);
        callback();
      },
    });

    await new Promise<void>((resolve, reject) => {
      const zipStream = stream.body!.pipe(progress).pipe(unzipper.Parse());

      zipStream.on("entry", (entry: UnzipperType.Entry) => {
        const entryName = path.basename(entry.path);

        if (entryName === binaryName) {
          // "w" flag: 기존 파일 덮어쓰기 (재빌드 시 EEXIST 방지)
          const fileStream = createWriteStream(target, { flags: "w", mode: 0o755 });

          entry.pipe(fileStream).once("finish", resolve).once("error", reject);
        } else {
          entry.autodrain();
        }
      });

      zipStream.on("error", reject);
      zipStream.on("close", () => resolve()); // 파일을 못 찾은 경우에도 정상 종료
    });

    // 체크섬 검증 (zip 원본 해시 vs 체크섬 파일)
    await this.verifyChecksumHash(hasher.digest("hex"), path.basename(this.url));
  }
}

// ============================================
// 🎯 기존 다운로더 (kubectl, helm, k8s-proxy)
// ============================================

class SkuberPlusK8sProxyDownloader extends BinaryDownloader {
  protected readonly url: string;

  constructor(args: Omit<BinaryDownloaderArgs, "binaryName" | "url">, bar: MultiBar) {
    const binaryExtension = getBinaryExtension({ forPlatform: args.platform });
    const binaryName = "skuberplus-k8s-proxy" + binaryExtension;
    const url = `https://github.com/Wondermove-Inc/skuberplus-k8s-proxy/releases/download/v${args.version}/skuberplus-k8s-proxy-${args.platform}-${args.downloadArch}${binaryExtension}`;

    super({ ...args, binaryName, url }, bar);
    this.url = url;
  }
}

class KubectlDownloader extends BinaryDownloader {
  protected readonly url: string;

  constructor(args: Omit<BinaryDownloaderArgs, "binaryName" | "url">, bar: MultiBar) {
    const binaryName = "kubectl" + getBinaryExtension({ forPlatform: args.platform });
    const url = `https://dl.k8s.io/release/v${args.version}/bin/${args.platform}/${args.downloadArch}/${binaryName}`;

    super({ ...args, binaryName, url }, bar);
    this.url = url;
  }
}

class HelmDownloader extends BinaryDownloader {
  protected readonly url: string;

  constructor(args: Omit<BinaryDownloaderArgs, "binaryName" | "url">, bar: MultiBar) {
    const binaryName = "helm" + getBinaryExtension({ forPlatform: args.platform });
    const url = `https://get.helm.sh/helm-v${args.version}-${args.platform}-${args.downloadArch}.tar.gz`;

    super({ ...args, binaryName, url }, bar);
    this.url = url;
  }

  protected getTransformStreams(file: WriteStream) {
    const extracting = extract({
      allowUnknownFormat: false,
    });

    extracting.on("entry", (headers, stream, next) => {
      if (headers.name.endsWith(this.args.binaryName)) {
        stream
          .pipe(file)
          .once("finish", () => next())
          .once("error", next);
      } else {
        stream.resume();
        next();
      }
    });

    return [gunzip(3), extracting];
  }
}

// ============================================
// 🎯 Trivy 다운로더
// ============================================
//
// GitHub Releases URL 패턴:
//   macOS/Linux: trivy_{ver}_{OS}-{ARCH}.tar.gz
//   Windows:     trivy_{ver}_{OS}-{ARCH}.zip
//
// OS-ARCH 매핑:
//   darwin  x64   → macOS-64bit
//   darwin  arm64 → macOS-ARM64
//   linux   x64   → Linux-64bit
//   linux   arm64 → Linux-ARM64
//   windows x64   → windows-64bit

function getTrivyOsArch(platform: SupportedPlatform, downloadArch: string): string {
  if (platform === "darwin") {
    return downloadArch === "arm64" ? "macOS-ARM64" : "macOS-64bit";
  }

  if (platform === "linux") {
    return downloadArch === "arm64" ? "Linux-ARM64" : "Linux-64bit";
  }

  // windows — arm64 없음, x64만 지원
  return "windows-64bit";
}

class TrivyDownloader extends TarGzBinaryDownloader {
  constructor(args: Omit<BinaryDownloaderArgs, "binaryName" | "url">, multiBar: MultiBar) {
    if (args.platform === "windows") {
      // Windows Trivy는 zip 배포 — TrivyWindowsDownloader를 사용해야 합니다.
      // createTrivyDownloader() 팩토리를 통해 호출하세요.
      throw new Error(
        "TrivyDownloader does not support Windows. Use TrivyWindowsDownloader via createTrivyDownloader().",
      );
    }

    const binaryName = "trivy";
    const osArch = getTrivyOsArch(args.platform, args.downloadArch);
    const url = `https://github.com/aquasecurity/trivy/releases/download/v${args.version}/trivy_${args.version}_${osArch}.tar.gz`;

    super({ ...args, binaryName, url }, multiBar);
  }

  // SHA256 체크섬 검증
  // Trivy 체크섬 파일: trivy_{ver}_checksums.txt
  // 포맷: "{sha256}  {filename}"
  protected override get checksumUrl(): string {
    return `https://github.com/aquasecurity/trivy/releases/download/v${this.args.version}/trivy_${this.args.version}_checksums.txt`;
  }
}

// Windows Trivy는 zip 포맷이므로 별도 다운로더 사용
class TrivyWindowsDownloader extends ZipBinaryDownloader {
  constructor(args: Omit<BinaryDownloaderArgs, "binaryName" | "url">, multiBar: MultiBar) {
    const binaryName = "trivy.exe";
    const osArch = "windows-64bit";
    const url = `https://github.com/aquasecurity/trivy/releases/download/v${args.version}/trivy_${args.version}_${osArch}.zip`;

    super({ ...args, binaryName, url }, multiBar);
  }

  // SHA256 체크섬 검증 (zip 파일 자체를 검증)
  protected override get checksumUrl(): string {
    return `https://github.com/aquasecurity/trivy/releases/download/v${this.args.version}/trivy_${this.args.version}_checksums.txt`;
  }
}

// ============================================
// 🎯 Kubescape 다운로더
// ============================================
//
// GitHub Releases URL 패턴:
//   kubescape_{ver}_{os}_{arch}.tar.gz (모든 플랫폼)
//
// OS-ARCH 매핑 (소문자):
//   darwin  x64   → darwin_amd64
//   darwin  arm64 → darwin_arm64
//   linux   x64   → linux_amd64
//   linux   arm64 → linux_arm64
//   windows x64   → windows_amd64
//   windows arm64 → windows_arm64

function getKubescapeOsArch(platform: SupportedPlatform, downloadArch: string): string {
  const cpuArch = downloadArch === "arm64" ? "arm64" : "amd64";

  return `${platform}_${cpuArch}`;
}

class KubescapeDownloader extends TarGzBinaryDownloader {
  constructor(args: Omit<BinaryDownloaderArgs, "binaryName" | "url">, multiBar: MultiBar) {
    const binaryExtension = getBinaryExtension({ forPlatform: args.platform });
    const binaryName = "kubescape" + binaryExtension;
    const osArch = getKubescapeOsArch(args.platform, args.downloadArch);
    const url = `https://github.com/kubescape/kubescape/releases/download/v${args.version}/kubescape_${args.version}_${osArch}.tar.gz`;

    super({ ...args, binaryName, url }, multiBar);
  }

  // SHA256 체크섬 검증
  // Kubescape 체크섬 파일: checksums.sha256 (버전별 공통)
  // 포맷: "{sha256}  {filename}"
  protected override get checksumUrl(): string {
    return `https://github.com/kubescape/kubescape/releases/download/v${this.args.version}/checksums.sha256`;
  }
}

// ============================================
// 🎯 PackageInfo 스키마
// ============================================

type SupportedPlatform = "darwin" | "linux" | "windows";

const PackageInfo = z.object({
  config: z.object({
    k8sProxyVersion: z.string().min(1),
    bundledKubectlVersion: z.string().min(1),
    bundledHelmVersion: z.string().min(1),
    bundledTrivyVersion: z.string().min(1),
    bundledKubescapeVersion: z.string().min(1),
  }),
});

const packageInfoRaw = await readFile(pathToPackage, "utf-8");
const packageInfo = PackageInfo.parse(JSON.parse(packageInfoRaw));

// 🎯 현재 실행 환경의 플랫폼 정규화
const currentPlatform = (() => {
  switch (process.platform) {
    case "darwin":
      return "darwin";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      throw new Error(`platform=${process.platform} is unsupported`);
  }
})();

// 🎯 타겟 플랫폼 결정 (CLI 인자 > 환경변수 > 현재 플랫폼)
const targetPlatform = ((): SupportedPlatform => {
  const cliPlatform = options["--platform"];
  const envPlatform = process.env.TARGET_PLATFORM;
  const platform = cliPlatform || envPlatform || currentPlatform;

  if (platform !== "darwin" && platform !== "linux" && platform !== "windows") {
    throw new Error(`Invalid platform: ${platform}. Must be darwin, linux, or windows`);
  }
  return platform;
})();

// 🎯 타겟 아키텍처 결정 (CLI 인자 > 환경변수 > 현재 아키텍처)
const targetArch = ((): "x64" | "arm64" => {
  const cliArch = options["--arch"];
  const envArch = process.env.TARGET_ARCH;
  const archValue = cliArch || envArch || arch;

  if (archValue !== "x64" && archValue !== "arm64") {
    throw new Error(`Invalid arch: ${archValue}. Must be x64 or arm64`);
  }
  return archValue;
})();

// 🎯 타겟 정보 출력
console.log(`📦 Downloading binaries for: ${targetPlatform}/${targetArch}`);
const multiBar = new MultiBar({
  align: "left",
  clearOnComplete: false,
  hideCursor: true,
  autopadding: true,
  noTTYOutput: true,
  format: "[{bar}] {percentage}% | {url}",
});

const downloaders: BinaryDownloader[] = [];

// ============================================
// 🎯 다운로드 팩토리 함수
// ============================================

function createTrivyDownloader(
  args: Omit<BinaryDownloaderArgs, "binaryName" | "url">,
  bar: MultiBar,
): BinaryDownloader {
  if (args.platform === "windows") {
    return new TrivyWindowsDownloader(args, bar);
  }

  return new TrivyDownloader(args, bar);
}

// 🎯 x64 바이너리 다운로드
const downloadX64Binaries = (platform: SupportedPlatform = targetPlatform) => {
  downloaders.push(
    new SkuberPlusK8sProxyDownloader(
      {
        version: packageInfo.config.k8sProxyVersion,
        platform,
        downloadArch: "amd64",
        fileArch: "x64",
        baseDir: pathToBaseDir,
      },
      multiBar,
    ),
    new KubectlDownloader(
      {
        version: packageInfo.config.bundledKubectlVersion,
        platform,
        downloadArch: "amd64",
        fileArch: "x64",
        baseDir: pathToBaseDir,
      },
      multiBar,
    ),
    new HelmDownloader(
      {
        version: packageInfo.config.bundledHelmVersion,
        platform,
        downloadArch: "amd64",
        fileArch: "x64",
        baseDir: pathToBaseDir,
      },
      multiBar,
    ),
    createTrivyDownloader(
      {
        version: packageInfo.config.bundledTrivyVersion,
        platform,
        downloadArch: "amd64",
        fileArch: "x64",
        baseDir: pathToBaseDir,
      },
      multiBar,
    ),
    new KubescapeDownloader(
      {
        version: packageInfo.config.bundledKubescapeVersion,
        platform,
        downloadArch: "amd64",
        fileArch: "x64",
        baseDir: pathToBaseDir,
      },
      multiBar,
    ),
  );
};

// 🎯 arm64 바이너리 다운로드
function downloadArm64Binaries(platform: SupportedPlatform = targetPlatform) {
  downloaders.push(
    new SkuberPlusK8sProxyDownloader(
      {
        version: packageInfo.config.k8sProxyVersion,
        platform,
        downloadArch: "arm64",
        fileArch: "arm64",
        baseDir: pathToBaseDir,
      },
      multiBar,
    ),
    new KubectlDownloader(
      {
        version: packageInfo.config.bundledKubectlVersion,
        platform,
        downloadArch: "arm64",
        fileArch: "arm64",
        baseDir: pathToBaseDir,
      },
      multiBar,
    ),
    new HelmDownloader(
      {
        version: packageInfo.config.bundledHelmVersion,
        platform,
        downloadArch: "arm64",
        fileArch: "arm64",
        baseDir: pathToBaseDir,
      },
      multiBar,
    ),
    createTrivyDownloader(
      {
        version: packageInfo.config.bundledTrivyVersion,
        platform,
        downloadArch: "arm64",
        fileArch: "arm64",
        baseDir: pathToBaseDir,
      },
      multiBar,
    ),
    new KubescapeDownloader(
      {
        version: packageInfo.config.bundledKubescapeVersion,
        platform,
        downloadArch: "arm64",
        fileArch: "arm64",
        baseDir: pathToBaseDir,
      },
      multiBar,
    ),
  );
}

// 🎯 바이너리 다운로드 분기
if (process.env.DOWNLOAD_ALL_ARCHITECTURES === "true") {
  downloadX64Binaries(targetPlatform);
  downloadArm64Binaries(targetPlatform);
} else if (targetArch === "x64") {
  downloadX64Binaries(targetPlatform);
} else if (targetArch === "arm64") {
  downloadArm64Binaries(targetPlatform);
}

const settledResults = await Promise.allSettled(
  downloaders.map((downloader) =>
    downloader.ensureBinary().catch((error) => {
      throw new Error(
        `Failed to download ${downloader.args.binaryName} for ${downloader.args.platform}/${downloader.args.downloadArch}: ${error}`,
      );
    }),
  ),
);

multiBar.stop();
const errorResult = settledResults.find((res) => res.status === "rejected") as PromiseRejectedResult | undefined;

if (errorResult) {
  console.error(String(errorResult.reason));
  process.exit(1);
}

process.exit(0);
