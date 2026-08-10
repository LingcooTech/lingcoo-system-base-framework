# Frame 开源与商业边界

## 开源范围

本仓库的 Frame Core、Database、Extension SDK、Admin/Web Shell、CMS、UI、Design Tokens、参考应用、
测试和文档采用 [Apache License 2.0](../LICENSE)。该许可证允许个人和企业使用、修改、分发及商业使用，
并包含明确的专利授权与责任限制。

源码许可证不授予 LingcooTech、Lingcoo、Lingcoo Frame 名称或标识的品牌使用权，具体边界见
[TRADEMARKS.md](../TRADEMARKS.md)。

## 不自动开源的范围

Frame 开源不改变以下资产的权属或分发策略：

- Edu、Retail 等行业应用及其领域扩展；
- Stack 中台、应用市场、授权、计费和一键部署能力；
- 客户代码、数据模型、数据、配置与定制交付；
- 托管运维、SLA、安全响应和商业支持；
- LingcooTech 的商标、Logo 与产品视觉资产。

私有应用可以依赖和修改 Apache-2.0 Frame，并继续通过版本化容器镜像交付。应用自身无需仅因依赖 Frame
而公开源码；分发时仍需保留 Apache-2.0 许可证和 NOTICE。

## 发布通道

```text
公开 GitHub 源码
├── npmjs Stable / latest：目标公开渠道，等待 @lingcootech scope 释放
├── GitHub Packages Preview / Canary：当前渠道，需 GitHub Token
└── GHCR Reference Image：用于体验和参考部署，不等于商业应用镜像
```

八个官方包作为一个兼容版本集发布。Stable 使用 npmjs 的 `latest` dist-tag；业务应用必须在
`package.json` 和 lockfile 中锁定明确版本，不能让生产环境自动跟随 dist-tag。Preview 和 Canary 不作
长期兼容承诺。

GitHub npm registry 即使公开包也要求 Token，因此它只是 scope 等待期和长期预发布通道。npmjs Stable
完成首次发布后，全新 Consumer 才不需要 `.npmrc`、PAT、`NODE_AUTH_TOKEN` 或逐包 Actions Access。

## 商业闭环

推荐边界是“开放底座，商业化产品与交付”：

1. 社区可免费获得 Frame，降低采用、审查和生态扩展成本。
2. LingcooTech 在私有行业应用中沉淀领域模型、流程、内容和运营能力。
3. Stack 中台负责应用上架、版本选择、授权、计费、镜像编排、一键部署、升级与运维。
4. 客户购买的是可直接运行的行业产品、持续升级和服务，而不是对通用底座源码的访问权。

开源版和商业版不维护两套 Core。通用修复进入公开 Frame；行业差异留在私有扩展；部署控制面只消费
不可变应用镜像和版本元数据。

## 安全、贡献和支持

- 漏洞通过 [SECURITY.md](../SECURITY.md) 的私密渠道报告。
- 外部贡献遵循 [CONTRIBUTING.md](../CONTRIBUTING.md) 和
  [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)。
- GitHub Issue 和社区协作不构成响应时间或修复时限承诺；商业 SLA 通过独立合同提供。
- 发布前必须继续执行真实 tarball Consumer、PostgreSQL Migration、类型、测试、Lint 和镜像门禁。
