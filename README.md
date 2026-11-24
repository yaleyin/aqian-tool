# A钱小工具 Tauri（试验版）

这是现有 Electron 版 A钱小工具的独立 Tauri 试验版本。它不会读取或修改当前 Electron 项目的源码。

## 当前状态

- React 界面、金额分摊、计算器和组件测试已迁移。
- 数据使用独立目录：`文档\A钱小工具-Tauri\projects\`
- Rust 后端待本机安装 Visual Studio C++ 工作负载后进行编译和打包。

## 环境要求

- Node.js 22+
- Rust stable MSVC 工具链
- Visual Studio Build Tools 的“使用 C++ 的桌面开发”工作负载
- WebView2 Runtime（Windows 10/11 通常已自带）

## 开发

```powershell
npm install
npm run tauri dev
```

如果 PowerShell 没有找到 MSVC 的链接器，可以先进入 Visual Studio 的 x64 开发者命令提示符，或在 PowerShell 中加载 `vcvars64.bat` 后再运行。

## 测试

前端单元/组件测试：

```powershell
npm test
npm run typecheck
```

Rust 存储测试：

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

## 打包

```powershell
npm run tauri build
```

实测产物：

- 主程序 `aqian-tauri.exe`：约 4.3 MB
- NSIS 安装包：约 1.5 MB
- 安装包位置：`release\A钱小工具 Tauri-Setup-0.1.0.exe`

Tauri 使用系统自带的 WebView2，因此安装包不包含 Chromium。Windows 10/11 通常已安装 WebView2；如果目标机器没有，安装时可能需要补装 WebView2 Runtime。

## 与 Electron 版的隔离

- 应用标识：`com.aqian.tool.tauri`
- 产品名称：`A钱小工具 Tauri`
- 数据目录：`文档\A钱小工具-Tauri`
- 不会覆盖现有 Electron 版的快捷方式或数据

## 后续

先验证 Tauri 原型的功能和安装体积；确认稳定后，再决定是否正式迁移。
