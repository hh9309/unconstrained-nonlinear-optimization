# 无约束最优化可视化平台

这是一个交互式的无约束最优化算法学习工具，支持梯度下降、牛顿法等多种算法的动态演示和AI原理解析。

## 部署到 GitHub Pages

该项目已配置好 GitHub Pages 部署体系。

### 方式一：使用 GitHub Actions (推荐)

1. 将代码推送到 GitHub 仓库的 `main` 分支。
2. 在仓库设置中：`Settings` -> `Pages` -> `Build and deployment` -> `Source` 选择 `GitHub Actions`。
3. 每次推送代码，GitHub Actions 会自动构建并部署。

### 方式二：手动部署

1. 在本地运行：
   ```bash
   npm run deploy
   ```
   这会构建项目并推送到 `gh-pages` 分支。

## API Key 设置

为了保护您的隐私，Gemini API Key 存储在浏览器的 `localStorage` 中。
在应用界面的 AI 洞察模块中，点击设置图标即可输入您的 API Key。
该 Key 仅保存在您的本地浏览器中，不会上传到任何服务器。
