# Grade Tracker — 项目规格说明书

## 1. 项目概述

**名称**: Grade Tracker
**类型**: macOS 桌面应用（Tauri v2）
**功能**: 帮 BISZ 七年级学生（Andy）追踪九门课成绩、查看统计、设定目标、生成报告
**技术栈**: Tauri v2 + 纯前端（HTML/CSS/JS）+ Rust 后端 + SQLite 本地存储
**构建命令**: `cd /Users/xiejiacheng/grade-tracker-mac && source ~/.cargo/env && npm run tauri build`

---

## 2. 窗口配置（tauri.conf.json 关键配置）

- **identifier**: `com.gradetracker.mac`（注意：不要用 `.app` 结尾，会和 macOS bundle 冲突）
- **title**: `Grade Tracker`
- **width**: 900, **height**: 700, **minWidth**: 800, **minHeight**: 600
- **window.loadURL()**: 必须指向 **app bundle 内的前端文件**，格式为 `附带的 resource URL`
  - Tauri v2 正确做法：在 `tauri.conf.json` 的 `app.windows[0]` 加 `"url": "index.html"`
  - 同时在 `bundle.resources` 把 `src/` 目录附到 app 里：`{"../src": "src"}`
  - 这样 macOS 上 app 打开时窗口自动加载 Resources/src/index.html，不会是空白

---

## 3. Rust 后端（src-tauri/src/lib.rs）

### 数据模型

```rust
struct Score { id: Option<i64>, subject: String, score: f64, score_type: String, date: String, note: String }
struct Goal { id: Option<i64>, subject: String, goal: f64 }
struct AppState { db: Mutex<Connection> }
```

### 数据库初始化

- 路径: `{data_local_dir}/grade-tracker/grades.db`
- 建表:
  ```sql
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    score REAL NOT NULL,
    score_type TEXT NOT NULL,
    date TEXT NOT NULL,
    note TEXT DEFAULT ''
  )
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT UNIQUE NOT NULL,
    goal REAL NOT NULL
  )
  ```

### Tauri Commands（全部用 `state: State<AppState>` 访问 DB）

| Command | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `add_score` | subject, score, score_type, date, note | `bool` | 插入成绩 |
| `get_scores` | subject: Option<String> | `Vec<Score>` | 查成绩，可按科目筛选 |
| `get_stats` | subject: String | `JSON {avg, count, trend, GPA}` | 单科统计（最近20条） |
| `set_goal` | subject, goal | `bool` | 设定/更新目标 |
| `get_goals` | - | `Vec<Goal>` | 查所有目标 |
| `get_report` | - | `JSON {GPA, subjectStats, weakest[2], strongest[2]}` | 全科报告 |

### 注意
- `query_map` 闭包内每个字段访问后都要 `?`，最后整体用 `Ok(...)` 包起来
- 闭包签名: `|row| Ok(Type { field: row.get(i)?, ... })`

---

## 4. 前端（src/ 目录）

### 文件结构
```
src/
  index.html      # SPA 入口，5个页面用CSS display切换
  styles.css      # 全局样式
  main.js         # 所有JS逻辑
  assets/         # 图标等资源（保留原样）
```

### 页面结构（单页应用，通过tab切换）

1. **Dashboard** (`#page-dashboard`)
   - 顶部: GPA 总览（大字显示）
   - 主体: 9个科目卡片网格（3x3），每张显示科目名 + 最近平均分 + 趋势箭头
   - 点击科目卡片 → 跳转 Stats 页

2. **Add Score** (`#page-add`)
   - 表单: 科目选择（9选1）、分数（数字输入）、类型（Quiz/Test/Homework/Exam）、日期（date picker）、备注（可选）
   - 提交按钮 → 调用 `invoke('add_score')` → 清表单 + Toast 提示"已保存"

3. **Stats** (`#page-stats`)
   - 顶部: 选中科目名 + 平均分 + GPA + 趋势
   - 主体: 最近20条成绩列表（分数、类型、日期、备注）
   - 返回按钮 → 回 Dashboard

4. **Goals** (`#page-goals`)
   - 9个科目各一行，显示当前目标分（若无显示"未设置"）
   - 点击"编辑" → inline 输入框 → 调用 `invoke('set_goal')`

5. **Report** (`#page-report`)
   - GPA 总览大字
   - 最强科目（2门）绿色高亮
   - 最弱科目（2门）红色高亮
   - 所有科目表格: 科目 | 平均分 | 次数 | 趋势 | GPA

### 导航
- 底部固定 tab bar，5个按钮: Dashboard | Add | Stats | Goals | Report
- 当前页高亮（用CSS class `.active`）
- JS: `showPage(pageId)` 函数，隐藏所有页，显示目标页

### 颜色规范
```css
--primary: #4A90D9;      /* 蓝色，用于顶栏、按钮 */
--success: #2ECC71;     /* 绿色，趋势上升、达标 */
--danger: #E74C3C;       /* 红色，趋势下降、未达标 */
--bg: #F5F6F8;          /* 页面背景 */
--dark: #2C3E50;         /* 深色文字 */
--card-bg: #FFFFFF;      /* 卡片背景 */
--border: #E0E0E0;       /* 边框 */
```

### 字体
- 系统字体: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

### JavaScript 调用 Tauri 的方式
```js
const { invoke } = window.__TAURI__.core;
// 示例
const scores = await invoke('get_scores', { subject: null });
```

---

## 5. 9门科目（写死）

1. Speech & Debate
2. English 7
3. Chemistry
4. East Asian History
5. Chinese 7
6. Computer Science 7
7. Algebra & Geometry I
8. Physics 7
9. Biology 7 New

---

## 6. 打包配置

- `npm run tauri build` 输出:
  - `.app` 在 `src-tauri/target/release/bundle/macos/`
  - `.dmg` 在 `src-tauri/target/release/bundle/dmg/`
- 安装到 Applications: `cp -R "Grade Tracker.app" /Applications/`
- 打开 app: `open "/Applications/Grade Tracker.app"`

---

## 7. 交付清单

完成所有文件后，执行 `npm run tauri build`，确认:
1. 构建成功无 error
2. 生成 `.app` 和 `.dmg`
3. 把 `.app` 复制到 `/Applications/`
4. 双击打开 app，验证 5 个页面都能正常切换，数据能保存和读取
