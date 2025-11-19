#!/usr/bin/env node

const { program } = require('commander');
const { startInteractiveMenu } = require('../src/menu');
const { showSystemInfo } = require('../src/system');
const { spawnBackgroundCheck, loadUpdateInfo, showUpdateNotice, getCurrentVersion } = require('../src/updater');

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
    checkAndNotifyUpdate();
    spawnBackgroundCheck();
    await showSystemInfo();
    await startInteractiveMenu();
  });

program
  .command('info')
  .description('显示系统环境信息')
  .action(async () => {
    await showSystemInfo();
  });

program
  .command('update')
  .description('检查并更新到最新版本')
  .action(async () => {
    const { syncUpdate } = require('../src/updater');
    const { theme } = require('../src/ui');

    console.log(theme.primary('\n正在更新 UUTools...\n'));
    const success = syncUpdate();

    if (success) {
      console.log(theme.success('\n✅ 更新成功！\n'));
    } else {
      console.log(theme.error('\n❌ 更新失败，请手动运行: npm install -g uutools\n'));
    }
  });

/**
 * 检查更新并显示提示 (基于缓存)
 */
function checkAndNotifyUpdate() {
  try {
    const updateInfo = loadUpdateInfo();

    if (updateInfo && updateInfo.hasUpdate) {
      // 如果上次检查时间超过 24 小时，可能过期了，但还是提示一下也无妨
      const { theme } = require('../src/ui');
      showUpdateNotice(updateInfo.currentVersion, updateInfo.latestVersion, theme);
    }
  } catch (error) {
    // 静默失败
  }
}

// 默认启动交互式菜单
if (process.argv.length <= 2) {
  (async () => {
    checkAndNotifyUpdate();
    spawnBackgroundCheck();
    await showSystemInfo();
    await startInteractiveMenu();
  })();
} else {
  program.parse();
}
