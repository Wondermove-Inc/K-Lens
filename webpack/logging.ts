/**
 * 🎯 목적: Webpack 로그를 모드에 따라 일관되게 제어하기 위한 헬퍼
 * 📝 사용 방법: 각 webpack 설정에서 `getWebpackLoggingOptions()` 결과를 구조 분해하여
 *              `stats`, `infrastructureLogging` 값을 전달한다.
 */
import webpack from "webpack";

type LoggingOptions = Pick<webpack.Configuration, "infrastructureLogging" | "stats">;

/**
 * 🎯 목적: `DAIVE_DEV_LOG_MODE=quiet`일 때 로그 레벨을 축소한다.
 * @returns quiet 모드일 때만 적용할 Webpack 옵션
 */
export const getWebpackLoggingOptions = (): LoggingOptions => {
  if (process.env.DAIVE_DEV_LOG_MODE !== "quiet") {
    return {};
  }

  return {
    infrastructureLogging: {
      level: "warn",
    },
    stats: "errors-warnings",
  };
};

/**
 * 🎯 목적: Quiet 모드에서도 일정 간격으로 진행 상황을 출력
 * @param label 로그 구분용 레이블
 */
export const getQuietModeProgressPlugins = (label: string): webpack.WebpackPluginInstance[] => {
  if (process.env.DAIVE_DEV_LOG_MODE !== "quiet") {
    return [];
  }

  let previousPercentage = -10;

  return [
    new webpack.ProgressPlugin((percentage, message) => {
      const percent = Math.floor(percentage * 100);

      if (percent === 0 || percent === 100 || percent - previousPercentage >= 5) {
        previousPercentage = percent;
        console.error(`[quiet:${label}] ${percent}% ${message}`);
      }
    }),
  ];
};

/**
 * 🎯 목적: handlebars가 사용하는 `require.extensions` 경고를 식별하는 패턴
 * 📝 renderer/main 모두 동일한 정규식을 사용하므로 헬퍼로 분리
 */
export const handlebarsWarningPattern = /require\.extensions is not supported by webpack\./;
