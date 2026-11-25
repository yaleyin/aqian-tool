# 安全说明

A钱小工具是一个完全离线的桌面工具：

- 不登录、不联网、不包含遥测。
- 项目数据只保存在本机 `文档\A钱小工具\projects`。
- 应用不会上传项目内容。

## 报告安全问题

如果你发现安全问题，请不要直接公开利用细节。可以通过 GitHub 的 Private vulnerability reporting 或 Security Advisory 私下联系维护者。

请尽量提供：

- 受影响的版本
- 复现步骤
- 可能的影响
- 建议的修复方向

## 已知发布限制

当前安装包默认未购买代码签名证书，Windows 可能显示“未知发布者”或 SmartScreen 提示。请从本仓库的 Releases 页面下载，并核对 SHA256 校验值。
