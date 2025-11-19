const https = require('https');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 包名
const PACKAGE_NAME = 'uutools';
// 缓存文件路径
const UPDATE_CONFIG_PATH = path.join(os.homedir(), '.uutools-update.json');

/**
 * 获取当前安装的版本
 */
function getCurrentVersion() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageJson.version;
}

/**
 * 获取 npm 上的最新版本
 */
function getLatestVersion() {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;

    const req = https.get(url, { timeout: 5000 }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.version);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * 比较版本号
 * @returns {number} 1: latest > current, 0: equal, -1: latest < current
 */
function compareVersions(current, latest) {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (latestParts[i] > currentParts[i]) return 1;
    if (latestParts[i] < currentParts[i]) return -1;
  }

  return 0;
}

/**
 * 保存更新信息到缓存
 */
function saveUpdateInfo(info) {
  try {
    fs.writeFileSync(UPDATE_CONFIG_PATH, JSON.stringify(info, null, 2));
  } catch (error) {
    // 忽略写入错误
  }
}

/**
 * 读取缓存的更新信息
 */
function loadUpdateInfo() {
  try {
    if (fs.existsSync(UPDATE_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(UPDATE_CONFIG_PATH, 'utf8'));
    }
  } catch (error) {
    // 忽略读取错误
  }
  return null;
}

/**
 * 检查是否有新版本并缓存结果
 * (这是后台进程运行的主逻辑)
 */
async function checkAndCacheUpdates() {
  try {
    const currentVersion = getCurrentVersion();
    const latestVersion = await getLatestVersion();

    const hasUpdate = compareVersions(currentVersion, latestVersion) === 1;

    const updateInfo = {
      lastCheck: Date.now(),
      hasUpdate,
      currentVersion,
      latestVersion
    };

    saveUpdateInfo(updateInfo);
  } catch (error) {
    // 后台进程出错不需要处理
  }
}

/**
 * 启动后台检查进程
 */
function spawnBackgroundCheck() {
  const scriptPath = __filename;

  const child = spawn(process.execPath, [scriptPath], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, UUTOOLS_BACKGROUND_CHECK: 'true' }
  });

  child.unref();
}

/**
 * 同步更新（等待完成）
 */
function syncUpdate() {
  try {
    const { execSync } = require('child_process');
    execSync(`npm install -g ${PACKAGE_NAME}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 显示更新提示
 */
function showUpdateNotice(currentVersion, latestVersion, theme) {
  console.log('');
  console.log(theme.warning('╭─────────────────────────────────────╮'));
  console.log(theme.warning('│') + '   发现新版本！                      ' + theme.warning('│'));
  console.log(theme.warning('│') + `   ${theme.dim(currentVersion)} → ${theme.success(latestVersion)}                      ` + theme.warning('│'));
  console.log(theme.warning('│') + '                                     ' + theme.warning('│'));
  console.log(theme.warning('│') + `   运行 ${theme.primary('uutools update')} 更新        ` + theme.warning('│'));
  console.log(theme.warning('╰─────────────────────────────────────╯'));
  console.log('');
}

// 如果是作为脚本直接运行，则执行检查逻辑
if (require.main === module) {
  checkAndCacheUpdates();
}

module.exports = {
  getCurrentVersion,
  loadUpdateInfo,
  spawnBackgroundCheck,
  syncUpdate,
  showUpdateNotice
};
