# 7paws

7paws（七爪）是 Windows 10/11 x64 的桌面小猫桌宠。小猫会响应全局键盘和鼠标输入：敲键、看光标、伸爪够鼠标；按住猫头可以摸它，闲置后它会睡觉。

## 功能

- 全局键鼠响应：不需要窗口焦点，在任何应用里打字或移动鼠标都会触发动作。
- 65%/104 键盘：同一个安装包内运行时切换，默认 65% 紧凑布局。
- 3D 小猫：圆润的程序化模型，提供六种毛色。
- 迷你鼠标：常驻在键盘旁，眼睛和头跟随真实光标，猫会向鼠标侧倾。
- 呼噜声：「按住呼噜声」和「自动睡眠呼噜声」可独立开关。
- 隐私模式：只保留左右侧动作提示，不显示具体按键。
- 点击穿透与始终置顶：不影响正常操作，托盘可显示/隐藏。
- 设置持久化：毛色、大小、布局、睡眠时间和各项开关会保存到本地。

## 系统要求

- Windows 10/11 x64
- Microsoft Edge WebView2 Runtime
- 开发环境：Node.js 20+、pnpm、Rust stable、Microsoft C++ Build Tools（含 Windows SDK）

## 快速开始

```bash
pnpm install
pnpm tauri:dev
```

## 构建

```bash
# 前端类型检查和构建
pnpm build

# Windows NSIS 安装包
pnpm tauri:build
```

安装包生成在 `src-tauri/target/release/bundle/nsis/`。

Rust 代码检查：

```bash
cd src-tauri
cargo check
```

## 使用

- 右键小猫打开设置菜单。
- 按住猫头是摸猫；按住身体拖动窗口。
- 托盘左键显示或隐藏小猫；托盘菜单可打开设置或退出。
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

配置文件位于 `%APPDATA%\7paws\settings.json`。

## 项目结构

```text
.
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
│  ├─ src/input_hook.rs  Windows 全局键鼠钩子
│  ├─ src/keymap.rs      扫描码到 DOM code 的映射
│  ├─ src/config.rs      设置读写
│  └─ src/tray.rs        托盘菜单
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

- 仅支持 Windows 10/11 x64。
- 104 布局按标准全键盘排列，包含 F 区、导航区、方向键和小键盘。
- 产品名与窗口、托盘、安装包统一使用 7paws。