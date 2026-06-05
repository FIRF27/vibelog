# 更新日志

本项目所有重要变更记录于此。

> English: [CHANGELOG.md](CHANGELOG.md)

## [v0.1.0] - 2026-06-05

### Added

- 新增 `--language`、`VIBELOG_LANGUAGE` 和配置项 `language`，可控制摘要输出语言，同时保持代码标识符和专有名词不变。 ([`18fa738`](https://github.com/FIRF27/vibelog/commit/18fa738))
- 新增 GitHub Action shell 与 ncc 打包支持。 ([`7c3881d`](https://github.com/FIRF27/vibelog/commit/7c3881d))
- 新增 CLI shell，支持 `stdout` / `--write`，并接入真实的 git、llm 和 octokit。 ([`328f158`](https://github.com/FIRF27/vibelog/commit/328f158))
- 新增 `generateChangelog` 编排流程，空范围时返回 `null`。 ([`eae71d2`](https://github.com/FIRF27/vibelog/commit/eae71d2))
- 新增带批处理、校验和合并的 LLM 摘要能力。 ([`4fdc7b4`](https://github.com/FIRF27/vibelog/commit/4fdc7b4))
- 新增从提交和 PR 元数据组装 `ChangeSet` 的能力。 ([`4c1d7ef`](https://github.com/FIRF27/vibelog/commit/4c1d7ef))
- 新增通过 octokit 获取并标准化 PR 元数据的能力。 ([`c86072b`](https://github.com/FIRF27/vibelog/commit/c86072b))
- 新增 git 范围解析、提交列表获取和 PR 编号解析功能。 ([`ba71340`](https://github.com/FIRF27/vibelog/commit/ba71340))
- 新增按 flags、env、配置文件和默认值优先级加载配置的能力。 ([`f06c385`](https://github.com/FIRF27/vibelog/commit/f06c385))
- 新增将结构化结果渲染为 Keep a Changelog Markdown 的功能。 ([`b58cfd3`](https://github.com/FIRF27/vibelog/commit/b58cfd3))
- 新增核心类型和 zod schema。 ([`b93e8e2`](https://github.com/FIRF27/vibelog/commit/b93e8e2))

### Changed

- 生成流程改为使用 temperature 0 和固定 seed，以提高变更日志结构的可复现性。 ([`4f61987`](https://github.com/FIRF27/vibelog/commit/4f61987))
- 改进 `CHANGELOG` 锚点和渲染逻辑，以避免 fence 标记错位和空白行增长。 ([`8f13f98`](https://github.com/FIRF27/vibelog/commit/8f13f98))
- 改进 git 解析与变更日志生成，支持 `-z` 输出、回滚安全的 PR 检测、未知 LLM 分类、按大小分批、代理项安全截断和 PR 获取失败警告。 ([`45b4647`](https://github.com/FIRF27/vibelog/commit/45b4647))
- 将 Action 的 `to` 输入接入生成流程。 ([`04b2818`](https://github.com/FIRF27/vibelog/commit/04b2818))

### Removed

- 移除了已记录为无操作的 `includeAuthors` 功能，以及未使用的 `chunk()`。 ([`081c1ef`](https://github.com/FIRF27/vibelog/commit/081c1ef))

### Fixed

- 当 LLM 返回带有 `breaking` 字段但没有用户可见变化时，解析结果会降级为无操作而不是报错。 ([`1d9fd90`](https://github.com/FIRF27/vibelog/commit/1d9fd90))
- 当 LLM 返回错误形状的 JSON 时，程序现在会明确失败并给出可操作提示。 ([`263d5ea`](https://github.com/FIRF27/vibelog/commit/263d5ea))
- 修复发布后的 CLI 入口在 npm 软链接场景下无效的问题。 ([`830fa48`](https://github.com/FIRF27/vibelog/commit/830fa48))
- 修复 `parsePrNumber` 对末尾标点的回归问题。 ([`830fa48`](https://github.com/FIRF27/vibelog/commit/830fa48))
- 完善 LLM schema 处理，允许空对象作为无操作结果，并对数字型 ref id 做兼容处理。 ([`830fa48`](https://github.com/FIRF27/vibelog/commit/830fa48))
- 验证并报告配置文件，避免无效配置和 `ignorePattern` 正则错误。 ([`e9d40e0`](https://github.com/FIRF27/vibelog/commit/e9d40e0))
- 增强输出安全性，防止摘要换行伪造标题、ref 链接突破和非有限 ref id。 ([`2f8323c`](https://github.com/FIRF27/vibelog/commit/2f8323c))
- 容忍格式不规范的 LLM 输出，避免坏的 ref、缺失条目和字符串化 `breaking` 导致链接损坏。 ([`081c1ef`](https://github.com/FIRF27/vibelog/commit/081c1ef))
- 捕获 git stderr，避免被捕获的失败泄露错误文本。 ([`693e9de`](https://github.com/FIRF27/vibelog/commit/693e9de))
- 修复 `prepack` 构建钩子和包元数据，避免 `npx vibelog` 发布后不可用。 ([`0fc0cb8`](https://github.com/FIRF27/vibelog/commit/0fc0cb8))

### Security

- 阻止通过 git 参数注入和版本标题伪造造成的输出篡改与任意文件写入风险。 ([`6b78327`](https://github.com/FIRF27/vibelog/commit/6b78327))
- 加固 `CHANGELOG` 输出，防止换行、链接突破和不安全的 ref id 导致的注入问题。 ([`2f8323c`](https://github.com/FIRF27/vibelog/commit/2f8323c))
