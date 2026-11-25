# 贡献指南

感谢你愿意改进 A钱小工具。

## 开发环境

- Windows 10/11 x64
- Node.js 22+
- Rust stable MSVC 工具链
- Visual Studio Build Tools 的“使用 C++ 的桌面开发”工作负载
- WebView2 Runtime

## 本地开发

```powershell
npm install
npm run tauri dev
```

## 测试

```powershell
npm test
npm run typecheck
cargo test --manifest-path src-tauri/Cargo.toml
```

## 修改约定

- 金额统一按整数分处理，不使用浮点数存储。
- 均摊尾差按人员添加顺序分配。
- 修改业务行为时，同时补充或更新测试。
- 新增用户可见文案使用中文。
- 不要提交个人项目数据、安装包、`node_modules`、`src-tauri/target` 或 `release/`。

## 提交 Pull Request

1. 从 `main` 创建功能分支。
2. 保持改动聚焦，说明用户可感知的变化。
3. 确认测试通过。
4. 在 PR 描述中写明测试方式和截图（涉及界面时）。

## 发布流程

1. 更新 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 的版本号。
2. 更新 `CHANGELOG.md`。
3. 提交并打 `vX.Y.Z` 标签。
4. GitHub Actions 会构建 NSIS 安装包并上传到 Release。
