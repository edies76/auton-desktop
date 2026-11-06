import { describe, expect, it, vi } from "vitest";
import {
  applyEarlyAppVersionBootstrap,
  extractBootstrapDataBaseDir,
  resolveBootstrapSettingsFile,
} from "../src/main/desktopDataBaseDirBootstrap.js";

describe("applyEarlyAppVersionBootstrap", () => {
  it("把构建期产品版本写入 Electron app，避免开发态默认 0.0 触发 electron-updater semver 校验失败", () => {
    const setVersion = vi.fn();

    expect(applyEarlyAppVersionBootstrap({ setVersion }, "3.16.2")).toBe("3.16.2");
    expect(setVersion).toHaveBeenCalledTimes(1);
    expect(setVersion).toHaveBeenCalledWith("3.16.2");
  });

  it("未显式传版本时使用共享构建版本（合法 semver）", () => {
    const setVersion = vi.fn();

    const version = applyEarlyAppVersionBootstrap({ setVersion });

    expect(version).toMatch(/^\d+\.\d+\.\d+/);
    expect(setVersion).toHaveBeenCalledWith(version);
  });
});

describe("desktopDataBaseDirBootstrap", () => {
  it("应从 bootstrap setting 中提取并裁剪 dataBaseDir", () => {
    expect(
      extractBootstrapDataBaseDir({
        dataBaseDir: "  /tmp/zcode-data  ",
      }),
    ).toBe("/tmp/zcode-data");
  });

  it("应忽略无效的 bootstrap 配置", () => {
    expect(extractBootstrapDataBaseDir(null)).toBeNull();
    expect(extractBootstrapDataBaseDir({ dataBaseDir: "" })).toBeNull();
    expect(extractBootstrapDataBaseDir({ dataBaseDir: 123 })).toBeNull();
  });

  it("应拼出默认 bootstrap setting 路径", () => {
    const result = resolveBootstrapSettingsFile("/Users/tester");
    // Windows 下 path.join 使用反斜杠，统一为正斜杠后再比较
    expect(result.replace(/\\/g, "/")).toBe(
      "/Users/tester/.auton/v2/setting.json",
    );
  });
});
