const { intro, outro, select, confirm, isCancel, cancel } = require('@clack/prompts');
const chalk = require('chalk');
const { detectOS, detectTools, getConfigPaths } = require('./system');
const { configureClaude } = require('./configurators/claude');
const { configureCodex } = require('./configurators/codex');
const { configureGemini } = require('./configurators/gemini');
const { theme } = require('./ui');

/**
 * 启动交互式菜单
 */
async function startInteractiveMenu() {
  const osInfo = detectOS();
  const tools = detectTools();
  const configPaths = getConfigPaths(osInfo);

  intro(theme.primary('UUTools 配置向导'));

  while (true) {
    const action = await select({
      message: '请选择要配置的工具:',
      options: [
        { value: 'claude', label: '🤖 配置 Claude Code', hint: tools.claude.installed ? '已安装' : '未安装' },
        { value: 'codex', label: '💻 配置 Codex CLI', hint: tools.codex.installed ? '已安装' : '未安装' },
        { value: 'gemini', label: '✨ 配置 Gemini CLI', hint: tools.gemini.installed ? '已安装' : '未安装' },
        { value: 'all', label: '📦 配置全部工具' },
        { value: 'exit', label: '❌ 退出' }
      ]
    });

    if (isCancel(action) || action === 'exit') {
      outro(theme.primary('👋 感谢使用 UUTools，再见！'));
      break;
    }

    try {
      switch (action) {
        case 'claude':
          await configureClaude(osInfo, tools.claude, configPaths.claude);
          break;
        case 'codex':
          await configureCodex(osInfo, tools.codex, configPaths.codex);
          break;
        case 'gemini':
          await configureGemini(osInfo, tools.gemini, configPaths.gemini);
          break;
        case 'all':
          await configureAll(osInfo, tools, configPaths);
          break;
      }
    } catch (error) {
      console.error(theme.error(`\n❌ 配置出错: ${error.message}\n`));
    }

    // 询问是否继续
    const continueConfig = await confirm({
      message: '是否继续配置其他工具?',
      initialValue: true
    });

    if (isCancel(continueConfig) || !continueConfig) {
      outro(theme.primary('👋 感谢使用 UUTools，再见！'));
      break;
    }

    console.clear();
  }
}

/**
 * 配置全部工具
 */
async function configureAll(osInfo, tools, configPaths) {
  console.log(theme.warning('\n📦 开始配置全部工具...\n'));

  // Claude
  console.log(theme.primary('━━━ Claude Code ━━━'));
  await configureClaude(osInfo, tools.claude, configPaths.claude);

  // Codex
  console.log(theme.primary('\n━━━ Codex CLI ━━━'));
  await configureCodex(osInfo, tools.codex, configPaths.codex);

  // Gemini
  console.log(theme.primary('\n━━━ Gemini CLI ━━━'));
  await configureGemini(osInfo, tools.gemini, configPaths.gemini);

  console.log(theme.success('\n✅ 全部工具配置完成！\n'));
}

module.exports = {
  startInteractiveMenu
};
