# 7paws

[![CI](https://github.com/7wdn/7paws/actions/workflows/ci.yml/badge.svg)](https://github.com/7wdn/7paws/actions/workflows/ci.yml)

7paws（七爪）是 Windows 与 macOS 的桌面小猫桌宠。小猫会响应全局键盘和鼠标输入：敲键、看光标、伸爪够鼠标；按住猫头可以摸它，闲置后它会睡觉。

## 功能

- 全局键鼠响应：不需要窗口焦点，在任何应用里打字或移动鼠标都会触发动作。
- 65%/104 键盘：同一个安装包内运行时切换，默认 65% 紧凑布局。
- 3D 小猫：圆润的程序化模型，提供六种毛色。
- 迷你鼠标：常驻在键盘旁，眼睛和头跟随真实光标，猫会向鼠标侧倾。
- 呼噜声：「按住呼噜声」和「自动睡眠呼噜声」可独立开关。
- 隐私模式：只保留左右侧动作提示，不显示具体按键。
- 点击穿透与始终置顶：不影响正常操作，托盘可显示/隐藏。
- 设置持久化：毛色、大小、布局、睡眠时间和各项开关会保存到本地。

## 下载

从 [GitHub Releases](https://github.com/7wdn/7paws/releases) 获取最新构建：

- Windows 10/11 x64：`*-setup.exe`
- macOS 10.15+：`*.dmg`（Universal，Intel 与 Apple Silicon）

发布包目前未做代码签名；首次打开或 WebView2 缺失时请参考下方说明。

## 系统要求

- Windows 10/11 x64，需 Microsoft Edge WebView2 Runtime
- macOS 10.15+（Intel / Apple Silicon）
- 开发环境：Node.js 20+、pnpm、Rust stable；Windows 另需 Microsoft C++ Build Tools（含 Windows SDK），macOS 另需 Xcode Command Line Tools

## 快速开始

```bash
pnpm install
pnpm tauri:dev
```

## 构建

```bash
# 前端类型检查和构建
pnpm build

# 桌面安装包（按当前系统）
pnpm tauri:build
```

Windows 生成 NSIS 安装包，位于 `src-tauri/target/release/bundle/nsis/`；macOS 生成 `.app` 与 `.dmg`，位于 `src-tauri/target/release/bundle/`。macOS 版本必须在 macOS 上构建，Tauri 不支持从 Windows 交叉编译。

macOS 通用包：

```bash
pnpm tauri build --target universal-apple-darwin
```

Rust 代码检查：

```bash
cd src-tauri
cargo check
```

## macOS

### 首次打开

当前发布包未签名、未公证。把 `7paws.app` 拖入「应用程序」后，如果提示「无法验证开发者」或「已损坏」，在「终端」执行：

```bash
xattr -cr /Applications/7paws.app
```

然后重新打开应用。上述命令只清除本次下载的隔离属性，不会修改应用内容。

### 权限

打开「系统设置 → 隐私与安全性」，在「辅助功能」和「输入监控」中勾选 7paws，然后重新启动应用。

- 全局键鼠响应需要这两项权限同时开启；只勾选其中一项时，小猫不会完整响应。
- 授权对象是当前构建出的 7paws（开发模式下可能是终端或未签名的 `.app`）。
- 如果同时使用 Karabiner-Elements 等键盘工具，请确认 7paws 的两项授权没有被关闭。
- 全局键鼠监听只用于驱动小猫动作，不记录、不保存、不上传按键内容。

正式分发前建议配置 Apple Developer ID 签名与公证，届时可以省略 `xattr` 步骤。

## Windows

安装包内置 WebView2 引导程序；安装时如果系统缺少运行时，会自动尝试安装。

### 提示 “Could not find the WebView2 Runtime”

常见于 Windows 10 LTSC、精简版或移除了 Edge 的系统。请安装微软官方的 Evergreen Runtime：

https://developer.microsoft.com/microsoft-edge/webview2/

安装完成后重新打开 7paws。如果自动安装失败，可以下载 Evergreen 安装程序并右键以管理员身份运行。离线环境请先在有网络的机器下载安装程序，再拷贝到目标机器。

### Windows 7/8

不支持。7paws 使用 Tauri 2 与当前 Rust 工具链构建；Windows 7 需要单独的旧工具链和 WebView2 109 离线包，不在当前发布范围内。

### SmartScreen

未签名的安装包可能显示「未知发布者」。确认文件来自本仓库的 Releases 后，可以选择「更多信息 → 仍要运行」。

## 使用

- 右键小猫打开设置菜单。
- 按住猫头是摸猫；按住身体拖动窗口。
- 托盘图标（macOS 为菜单栏图标）左键显示或隐藏小猫；菜单可打开设置或退出。
- 设置菜单里可以切换毛色、键盘布局、睡眠时间、鼠标左右手、隐私模式、呼噜开关和按键字母。
- 大小滑杆拖动时只预览百分比，松手后应用。

## 默认设置

| 设置 | 默认值 |
| --- | --- |
| 大小 | 60%（可调 60%–150%） |
| 键盘布局 | 65% 紧凑 |
| 毛色 | 奶牛猫 |
| 睡眠时间 | 5 分钟 |
| 按住呼噜声 | 开启 |
| 自动睡眠呼噜声 | 关闭 |
| 显示按键字母 | 开启 |
| 鼠标在左手边 | 关闭 |
| 隐私模式 | 关闭 |

配置文件位置：

- Windows：`%APPDATA%\7paws\settings.json`
- macOS：`~/Library/Application Support/7paws/settings.json`

macOS 的开机自启通过 `~/Library/LaunchAgents/com.qoder.7paws.plist` 注册。

## 项目结构

```text
.
├─ .github/workflows/    CI、安装包构建与 tag 发布
├─ index.html            窗口与设置菜单
├─ src/
│  ├─ main.ts            启动、设置、菜单和指针交互
│  ├─ pet/               小猫适配层和毛色
│  ├─ audio.ts           呼噜声合成
│  ├─ style.css          菜单与页面样式
│  └─ types.ts           共享类型
├─ public/vendor/        WebGL 渲染资源
├─ src-tauri/
│  ├─ src/lib.rs         窗口、命中测试、位置监听和命令
│  ├─ src/input_hook.rs  全局键鼠钩子（Windows / macOS）
│  ├─ src/keymap.rs      Windows 扫描码到 DOM code 的映射
│  ├─ src/keymap_macos.rs macOS 虚拟键码到 DOM code 的映射
│  ├─ src/config.rs      设置读写与开机自启
│  ├─ src/tray.rs        托盘 / 菜单栏菜单
│  ├─ Info.plist         macOS LSUIElement（不显示 Dock 图标）
│  └─ tauri.macos.conf.json macOS 打包目标
└─ assets/               图标源文件
```

## 浏览器预览

```bash
pnpm dev
```

浏览器预览没有 Tauri 全局钩子和原生窗口，键鼠动作不会触发全局响应，设置只保存在内存中。可用参数：

- `?demo=1`：自动输入演示。
- `?localinput`：捕获当前窗口内的键盘事件。
- `?previewCoat=tuxedo`：预览指定毛色，可选 `tuxedo`、`orange`、`tabby`、`calico`、`white`、`blue`。

## 当前范围

- 支持 Windows 10/11 x64 与 macOS 10.15+。
- 不支持 Windows 7/8；Linux 暂未支持，后续版本优先考虑 X11 会话。
- macOS 以菜单栏图标驻留，不显示 Dock 图标；安装包需在 Mac 上构建，正式分发前还需自行签名与公证。
- 104 布局按标准全键盘排列，包含 F 区、导航区、方向键和小键盘。
- 产品名与窗口、托盘、安装包统一使用 7paws。

## 发布

1. 同步 `package.json` 与 `src-tauri/tauri.conf.json` 的版本号。
2. 推送 `vX.Y.Z` tag。
3. GitHub Actions 构建 Windows NSIS 与 macOS Universal DMG，并创建 Release。

也可以在 Actions 中手动运行 “Build bundles”，只构建安装包、不创建 Release。

## License

[MIT](LICENSE)
