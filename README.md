<div align="center">
  <img src="assets/logo.png" alt="7paws" width="128" height="128" />
  <h1>7paws</h1>
  <p>Windows 与 macOS 的 3D 桌面小猫桌宠<br>全局键鼠响应 · 敲键追光标 · 摸猫呼噜 · 点击穿透</p>
  <p><a href="https://github.com/7wdn/7paws">GitHub</a> &nbsp;|&nbsp; <a href="https://github.com/7wdn/7paws/releases">下载</a> &nbsp;|&nbsp; <a href="https://github.com/7wdn/7paws/issues">反馈</a></p>
</div>

<div align="center">
  <a href="https://github.com/7wdn/7paws/releases"><img src="https://img.shields.io/github/v/release/7wdn/7paws?include_prereleases&amp;style=flat-square" alt="Release" /></a>
  <a href="https://github.com/7wdn/7paws"><img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue?style=flat-square" alt="Platforms" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" /></a>
  <a href="https://github.com/7wdn/7paws/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/7wdn/7paws/ci.yml?branch=main&amp;style=flat-square" alt="CI" /></a>
</div>

## 目录

- [功能特性](#功能特性)
- [下载安装](#下载安装)
- [macOS 首次打开](#macos-首次打开)
- [Windows 安装](#windows-安装)
- [使用](#使用)
- [默认设置](#默认设置)
- [技术栈](#技术栈)
- [从源码构建](#从源码构建)
- [项目结构](#项目结构)
- [浏览器预览](#浏览器预览)
- [隐私与安全](#隐私与安全)
- [当前范围](#当前范围)
- [发布](#发布)
- [开源协议](#开源协议)

## 功能特性

### 互动

- **全局键鼠响应** — 不需要窗口焦点，在任何应用里打字或移动鼠标都会触发动作。
- **3D 小猫** — 圆润的程序化模型，提供六种毛色；会敲键、看光标、伸爪够鼠标，闲置后睡觉。
- **摸猫与拖拽** — 按住猫头是摸猫，按住身体拖动窗口；猫头判定由渲染器射线检测。
- **呼噜声** — WebAudio 合成，无音频资源；按住呼噜和睡眠呼噜可独立开关。

### 桌面

- **点击穿透与始终置顶** — 透明区域不影响桌面操作；需要完全不挡鼠标时可在设置菜单或托盘里锁定穿透，按住 `Alt` 临时恢复鼠标操作。托盘或菜单栏图标可显示、隐藏小猫。
- **65% / 104 键盘** — 同一个安装包内运行时切换，默认 65% 紧凑布局。
- **隐私模式** — 只保留左右手动作提示，不显示具体按键。
- **设置持久化** — 毛色、大小、布局、睡眠时间和各项开关保存到本地。

## 下载安装

安装包发布在 [GitHub Releases](https://github.com/7wdn/7paws/releases)。

| 平台 | 安装包 | 说明 |
| --- | --- | --- |
| Windows x64 | `*-x64-setup.exe` | Windows 10/11 x64 |
| Windows ARM64 | `*-arm64-setup.exe` | Windows ARM64；安装器为 x86，应用为原生 ARM64 |
| macOS Intel | `*-x64.dmg` | Intel Mac |
| macOS Apple Silicon | `*-aarch64.dmg` | Apple Silicon |

每个 Release 附带 `SHA256SUMS.txt`，正文是该版本的更新日志。Windows 安装器跟随系统语言，内置简体中文和英文。历史改动见 [CHANGELOG.md](CHANGELOG.md)。

当前发布包未签名、未公证。macOS 首次打开可能需要手动放行；Windows 未签名安装包可能触发 SmartScreen。

## macOS 首次打开

把对应架构的 `7paws.app` 拖入「应用程序」后：

- 如果提示「无法验证开发者」或「已损坏」，在终端执行：

```bash
xattr -cr /Applications/7paws.app
```

- 打开「系统设置 → 隐私与安全性」，在 **辅助功能**（macOS 26/27 显示为「设备控制与数据访问」）和 **输入监控** 中勾选 7paws，然后完全退出应用再重新打开。
- 只需要这两项权限，没有第三处。
- Apple Silicon 使用 `aarch64` 包，Intel 使用 `x64` 包；不要在 DMG 或下载目录里直接运行。

如果勾选后提示仍在：

1. 从菜单栏彻底退出 7paws，确认没有残留进程；
2. 确认应用位于 `/Applications`，且架构与机器一致；
3. 清除隔离属性和旧授权：

```bash
xattr -cr /Applications/7paws.app
tccutil reset All com.qoder.7paws
```

4. 在「辅助功能」和「输入监控」中用 **+** 重新添加 `/Applications/7paws.app`，打开两个开关；完全退出后重新启动。
5. macOS 26/27 上如果开关已经打开、但启动时仍弹出「7paws 想控制此 Mac 并访问你的数据」：先把两个开关关掉再打开，让系统把授权重新绑定到当前构建，然后完全退出并重新启动。发布包使用 ad-hoc 签名，授权绑定到具体构建，升级后可能需要重新确认一次。
6. 如果仍然无效，正式分发需要 Developer ID 签名与公证。

## Windows 安装

- 需要 Microsoft Edge WebView2 Runtime；安装包内置引导程序，安装时会自动尝试补齐。
- 如果提示 **Could not find the WebView2 Runtime**，常见于 Windows 10 LTSC、精简版或移除了 Edge 的系统。可安装微软官方的 [Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)，安装后重新打开 7paws。离线环境请先在有网络的机器下载安装程序，再拷贝到目标机器。
- 未签名安装包可能显示「未知发布者」；确认文件来自本仓库的 Releases 后，可以选择「更多信息 → 仍要运行」。
- Windows ARM64 版需要 ARM64 WebView2 Runtime，安装包会自动尝试安装。
- Windows 7/8 不支持。7paws 使用 Tauri 2 与当前 Rust 工具链构建。

## 使用

- 右键小猫打开设置窗口，窗口出现在猫的旁边，可拖动标题栏移动；点外部、按 `Esc` 或右上角关闭。
- 按住猫头是摸猫；按住身体拖动窗口。
- 托盘图标（macOS 为菜单栏图标）左键显示或隐藏小猫；菜单可切换锁定鼠标穿透、打开设置或退出。
- 设置菜单可切换毛色、键盘布局、睡眠时间、鼠标左右手、锁定鼠标穿透、隐私模式、呼噜开关和按键字母。
- 锁定鼠标穿透后整窗不接收鼠标操作，按住 `Alt` 可临时拖动或右键打开菜单。
- 大小滑杆拖动时只预览百分比，松手后应用。

## 默认设置

| 设置 | 默认值 |
| --- | --- |
| 大小 | 60%（可调 10%–150%） |
| 键盘布局 | 65% 紧凑 |
| 毛色 | 奶牛猫 |
| 睡眠时间 | 5 分钟 |
| 按住呼噜声 | 开启 |
| 自动睡眠呼噜声 | 关闭 |
| 显示按键字母 | 开启 |
| 鼠标在左手边 | 关闭 |
| 锁定鼠标穿透 | 关闭 |
| 隐私模式 | 关闭 |

配置文件位置：

- Windows：`%APPDATA%\7paws\settings.json`
- macOS：`~/Library/Application Support/7paws/settings.json`

macOS 的开机自启通过 `~/Library/LaunchAgents/com.qoder.7paws.plist` 注册。

## 技术栈

- **桌面壳** — Tauri 2 + Rust；全局键鼠钩子、窗口、托盘、点击穿透和设置持久化。
- **前端** — TypeScript + Vite，无 UI 框架；three.js + WebGL 渲染 3D 小猫。
- **输入** — Windows 低级键鼠钩子；macOS CGEventTap（辅助功能 + 输入监控）。
- **音频** — WebAudio 合成呼噜声，无音频资源；没有网络请求、账号或遥测。

## 从源码构建

```bash
pnpm install
pnpm build
pnpm tauri:dev
```

安装包：

```bash
# Windows x64 NSIS
pnpm tauri:build

# macOS Intel / Apple Silicon
pnpm tauri build --target x86_64-apple-darwin
pnpm tauri build --target aarch64-apple-darwin

# Windows ARM64（在 Windows 上交叉编译）
pnpm tauri build --target aarch64-pc-windows-msvc --bundles nsis
```

macOS 安装包必须在 macOS 上构建，Tauri 不支持从 Windows 交叉编译。按架构构建的产物位于 `src-tauri/target/<target>/release/bundle/`。

Rust 代码检查：

```bash
cd src-tauri
cargo check
```

## 项目结构

```text
.
├─ .github/workflows/   CI、手动构建与 tag 发布
├─ src/                 前端入口、适配层、毛色、音频与样式
├─ public/vendor/       three.js 与 3D 渲染器
├─ src-tauri/           Tauri 窗口、全局输入、设置、托盘与平台配置
├─ assets/              应用图标源、备选图标与 README logo
├─ index.html           小猫窗口骨架与启动错误提示
├─ settings.html        独立设置窗口
├─ LICENSE              MIT 许可证
└─ README.md
```

## 浏览器预览

```bash
pnpm dev
```

浏览器预览没有 Tauri 全局钩子和原生窗口，键鼠动作不会触发全局响应，设置只保存在内存中。右键小猫会在新窗口打开设置页，也可直接访问 `settings.html`。可用参数：

- `?demo=1`：自动输入演示。
- `?localinput`：捕获当前窗口内的键盘事件。
- `?previewCoat=tuxedo`：预览指定毛色，可选 `tuxedo`、`orange`、`tabby`、`calico`、`white`、`blue`。

## 隐私与安全

- 7paws 读取全局键盘和鼠标输入只是为了驱动小猫动作；不记录、不保存、不上传按键内容。
- 隐私模式只发送左右手动作提示，不显示具体按键。
- 设置只写入本地文件；没有网络请求、账号、遥测或分析。
- 配置路径：Windows 为 `%APPDATA%\7paws\settings.json`，macOS 为 `~/Library/Application Support/7paws/settings.json`。

## 当前范围

- 支持 Windows 10/11 x64 与 ARM64，macOS 10.15+ Intel 与 Apple Silicon。
- 不支持 Windows 7/8；Linux 暂未支持，后续版本优先考虑 X11 会话。
- macOS 以菜单栏图标驻留，不显示 Dock 图标。
- 发布包目前未签名；macOS 26/27 上如果权限无法保持，需要 Developer ID 签名与公证。
- 104 布局按标准全键盘排列，包含 F 区、导航区、方向键和小键盘。

## 发布

1. 同步 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 与 `src-tauri/Cargo.lock` 的版本号。
2. 推送 `vX.Y.Z` tag。
3. GitHub Actions 的 Release 工作流构建 Windows x64/ARM64 NSIS 与 macOS Intel/Apple Silicon DMG，并发布 Release，附 `SHA256SUMS.txt`。

发版只走 tag 触发的一次构建；不要先手动运行 “Build bundles” 再打 tag。手动构建工作流只用于排障。

## 开源协议

[MIT](LICENSE)