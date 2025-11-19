#!/usr/bin/env node

const { program } = require('commander');
const { startInteractiveMenu } = require('../src/menu');
const { showSystemInfo } = require('../src/system');

program
  .name('uutools')
  .description('一键配置 AI 编码工具 (Claude Code, Codex, Gemini)')
  .version('1.0.0');

program
  .command('setup')
  .description('启动交互式配置菜单')
  .action(async () => {
    await showSystemInfo();
    await startInteractiveMenu();
  });

program
  .command('info')
  .description('显示系统信息和工具安装状态')
  .action(async () => {
    await showSystemInfo();
  });

// 默认启动交互式菜单
if (process.argv.length <= 2) {
  (async () => {
    await showSystemInfo();
    await startInteractiveMenu();
  })();
} else {
  program.parse();
}
