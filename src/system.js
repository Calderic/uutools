const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

/**
 * 检测操作系统类型
 */
function detectOS() {
  const platform = os.platform();
  const release = os.release();

  // 检测 WSL
  if (platform === 'linux') {
    try {
      const procVersion = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
      if (procVersion.includes('microsoft') || procVersion.includes('wsl')) {
        return {
          type: 'wsl',
          name: 'Windows Subsystem for Linux',
          platform: 'linux',
          release
        };
      }
    } catch (e) {
      // 不是 WSL
    }

    return {
      type: 'linux',
      name: 'Linux',
      platform: 'linux',
      release
    };
  }

  if (platform === 'darwin') {
    return {
      type: 'macos',
      name: 'macOS',
      platform: 'darwin',
      release
    };
  }

  if (platform === 'win32') {
    return {
      type: 'windows',
      name: 'Windows',
      platform: 'win32',
      release
    };
  }

  return {
    type: 'unknown',
    name: 'Unknown OS',
    platform,
    release
  };
}

/**
 * 获取用户主目录
 */
function getHomeDir() {
  return os.homedir();
}

/**
 * 获取配置目录路径
 */
function getConfigPaths(osInfo) {
  const home = getHomeDir();

  const paths = {
    claude: {
      config: path.join(home, '.claude'),
      settings: path.join(home, '.claude', 'settings.json')
    },
    codex: {
      config: path.join(home, '.codex'),
      settings: path.join(home, '.codex', 'config.json')
    },
    gemini: {
      config: path.join(home, '.config', 'gemini'),
      settings: path.join(home, '.config', 'gemini', 'config.json')
    }
  };

  // Windows 特殊路径处理
  if (osInfo.type === 'windows') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    paths.gemini.config = path.join(appData, 'gemini');
    paths.gemini.settings = path.join(appData, 'gemini', 'config.json');
  }

  return paths;
}

/**
 * 检测命令是否存在
 */
function commandExists(command) {
  try {
    const isWindows = os.platform() === 'win32';
    const checkCommand = isWindows ? `where ${command}` : `which ${command}`;
    execSync(checkCommand, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 检测工具安装状态
 */
function detectTools() {
  return {
    claude: {
      name: 'Claude Code',
      installed: commandExists('claude'),
      command: 'claude'
    },
    codex: {
      name: 'OpenAI Codex CLI',
      installed: commandExists('codex'),
      command: 'codex'
    },
    gemini: {
      name: 'Gemini CLI',
      installed: commandExists('gemini'),
      command: 'gemini'
    }
  };
}

/**
 * 显示系统信息
 */
async function showSystemInfo() {
  const osInfo = detectOS();
  const tools = detectTools();
  const configPaths = getConfigPaths(osInfo);
  const { showBanner, showBox, theme } = require('./ui');

  showBanner();

  // 系统信息
  const sysInfoContent = `
操作系统: ${theme.primary(osInfo.name)}
版本: ${theme.dim(osInfo.release)}
主目录: ${theme.dim(getHomeDir())}
`.trim();

  showBox('系统信息', sysInfoContent, 'info');

  // 工具状态
  let toolsContent = '';
  Object.values(tools).forEach(tool => {
    const status = tool.installed
      ? theme.success('✓ 已安装')
      : theme.error('✗ 未安装');
    toolsContent += `   ${tool.name}: ${status}\n`;
  });

  showBox('工具安装状态', toolsContent.trim(), 'info');

  return { osInfo, tools, configPaths };
}

module.exports = {
  detectOS,
  getHomeDir,
  getConfigPaths,
  commandExists,
  detectTools,
  showSystemInfo
};
