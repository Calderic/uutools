const inquirer = require('inquirer');
const chalk = require('chalk');
const { detectOS, detectTools, getConfigPaths } = require('./system');
const { configureClaude } = require('./configurators/claude');
const { configureCodex } = require('./configurators/codex');
const { configureGemini } = require('./configurators/gemini');

/**
 * 主菜单选项
 */
const mainMenuChoices = [
  {
    name: '🤖 配置 Claude Code',
    value: 'claude'
  },
  {
    name: '💻 配置 Codex CLI',
    value: 'codex'
  },
  {
    name: '✨ 配置 Gemini CLI',
    value: 'gemini'
  },
  {
    name: '📦 配置全部工具',
    value: 'all'
  },
  new inquirer.Separator(),
  {
    name: '❌ 退出',
    value: 'exit'
  }
];

/**
 * 启动交互式菜单
 */
async function startInteractiveMenu() {
  const osInfo = detectOS();
  const tools = detectTools();
  const configPaths = getConfigPaths(osInfo);

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择要配置的工具:',
        choices: mainMenuChoices
      }
    ]);

    if (action === 'exit') {
      console.log(chalk.cyan('\n👋 感谢使用 UUTools，再见！\n'));
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
      console.error(chalk.red(`\n❌ 配置出错: ${error.message}\n`));
    }

    // 询问是否继续
    const { continueConfig } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueConfig',
        message: '是否继续配置其他工具?',
        default: true
      }
    ]);

    if (!continueConfig) {
      console.log(chalk.cyan('\n👋 感谢使用 UUTools，再见！\n'));
      break;
    }

    console.log(''); // 空行分隔
  }
}

/**
 * 配置全部工具
 */
async function configureAll(osInfo, tools, configPaths) {
  console.log(chalk.bold.yellow('\n📦 开始配置全部工具...\n'));

  // Claude
  console.log(chalk.bold.cyan('━━━ Claude Code ━━━'));
  await configureClaude(osInfo, tools.claude, configPaths.claude);

  // Codex
  console.log(chalk.bold.cyan('\n━━━ Codex CLI ━━━'));
  await configureCodex(osInfo, tools.codex, configPaths.codex);

  // Gemini
  console.log(chalk.bold.cyan('\n━━━ Gemini CLI ━━━'));
  await configureGemini(osInfo, tools.gemini, configPaths.gemini);

  console.log(chalk.bold.green('\n✅ 全部工具配置完成！\n'));
}

module.exports = {
  startInteractiveMenu
};
