import { app } from "electron";
import {
  applyEarlyAppVersionBootstrap,
  applyEarlyDataBaseDirBootstrap,
} from "./desktopDataBaseDirBootstrap.js";

// 必须在 autoUpdater 等业务模块加载前执行：electron-updater 在模块加载期就读
// app.getVersion()，开发态默认 "0.0" 会让它抛 semver 错误（见 desktopDataBaseDirBootstrap）。
applyEarlyAppVersionBootstrap(app);
applyEarlyDataBaseDirBootstrap();
