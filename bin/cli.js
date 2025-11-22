#!/usr/bin/env node

const { program } = require('commander');
const { startInteractiveMenu } = require('../src/menu');
const { showSystemInfo } = require('../src/system');
const { spawnBackgroundCheck, checkForUpdates, syncUpdate, getCurrentVersion } = require('../src/updater');
const { theme } = require('../src/ui');

// 获取动态版本
const version = getCurrentVersion();

program
  .name('uutools')
  .description('一键配置 AI 编码工具 (Claude Code, Codex, Gemini)')
  .version(version);

program
  .command('setup')
  .description('启动交互式配置菜单')
  .action(async () => {
    await ensureLatestVersion();
    spawnBackgroundCheck();
    await showSystemInfo();
    await startInteractiveMenu();
  });

program
  .command('info')
  .description('显示系统环境信息')
  .action(async () => {
    await ensureLatestVersion();
    await showSystemInfo();
  });

program
  .command('update')
  .description('检查并更新到最新版本')
  .action(async () => {
    console.log(theme.primary('\n正在更新 UUTools...\n'));
    const success = syncUpdate();

    if (success) {
      console.log(theme.success('\n✅ 更新成功！\n'));
    } else {
      console.log(theme.error('\n❌ 更新失败，请手动运行: npm install -g uutools\n'));
    }
  });

/**
 * 启动前自动检查并执行更新
 */
async function ensureLatestVersion() {
  try {
    const updateInfo = await checkForUpdates();

    if (updateInfo && updateInfo.hasUpdate) {
      console.log(theme.primary(`\n检测到新版本 ${updateInfo.latestVersion}，正在自动更新...`));
      const success = syncUpdate();

      if (success) {
        console.log(theme.success(`\n✅ UUTools 已更新至 ${updateInfo.latestVersion}，建议重新运行以使用最新版本。\n`));
      } else {
        console.log(theme.error('\n❌ 自动更新失败，请手动运行: npm install -g @uupkg/uutools\n'));
      }
    }
  } catch (error) {
    console.log(theme.warning('\n⚠️ 自动更新检查失败，已跳过\n'));
  }
}

// 默认启动交互式菜单
if (process.argv.length <= 2) {
  (async () => {
    await ensureLatestVersion();
    spawnBackgroundCheck();
    await showSystemInfo();
    await startInteractiveMenu();
  })();
} else {
  program.parse();
}
