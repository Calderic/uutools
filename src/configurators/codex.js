const { select, text, confirm, isCancel, spinner } = require('@clack/prompts');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { theme, showBox } = require('../ui');
const { promptApiKey } = require('../utils/apiKeyPrompt');

/**
 * API 提供商列表
 */
const API_PROVIDERS = [
  {
    label: 'UUcode',
    value: 'uucode',
    provider: 'uucode',
    baseUrl: 'https://api.uucode.org',
    envKey: 'uucode_apikey'
  },
  {
    label: 'OpenAI ',
    value: 'openai',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY'
  },
  {
    label: '其他第三方',
    value: 'custom',
    provider: '',
    baseUrl: '',
    envKey: ''
  }
];

/**
 * 配置 Codex CLI
 */
async function configureCodex(osInfo, toolInfo, configPath) {
  if (!toolInfo.installed) {
    console.log(theme.warning('\n⚠️  Codex CLI 未安装'));
    const installNow = await confirm({
      message: '是否显示安装指南?',
      initialValue: true
    });

    if (isCancel(installNow)) return;

    if (installNow) {
      showInstallGuide(osInfo);
    }
    return;
  }

  console.log(theme.success('\n✓ Codex CLI 已安装'));

  const configType = await select({
    message: '选择配置类型:',
    options: [
      { label: '📁 配置 API (配置文件 + 环境变量)', value: 'api-config' },
      { label: '↩️  返回', value: 'back' }
    ]
  });

  if (isCancel(configType)) return;

  switch (configType) {
    case 'api-config':
      await configureApi(osInfo, configPath);
      break;
    case 'back':
      return;
  }
}

/**
 * 配置 API (配置文件 + 环境变量)
 */
async function configureApi(osInfo, configPath) {
  // 选择 API 提供商
  const provider = await select({
    message: '选择 API 提供商:',
    options: API_PROVIDERS
  });

  if (isCancel(provider)) return;

  // 获取 provider 信息
  const selectedProvider = API_PROVIDERS.find(p => p.value === provider);
  let providerName = '';
  let baseUrl = '';
  let envKey = '';

  if (provider === 'custom') {
    const customProvider = await text({
      message: '请输入 Provider 名称:',
      validate: (input) => {
        if (!input || input.trim() === '') return '请输入有效的 Provider 名称';
      }
    });
    if (isCancel(customProvider)) return;
    providerName = customProvider;

    const customBaseUrl = await text({
      message: '请输入 API Base URL:',
      validate: (input) => {
        if (!input || input.trim() === '') return '请输入有效的 URL';
        try {
          new URL(input);
        } catch {
          return '请输入有效的 URL';
        }
      }
    });
    if (isCancel(customBaseUrl)) return;
    baseUrl = customBaseUrl;

    const customEnvKey = await text({
      message: '请输入环境变量名称:',
      placeholder: 'CUSTOM_API_KEY',
      validate: (input) => {
        if (!input || input.trim() === '') return '请输入有效的环境变量名称';
      }
    });
    if (isCancel(customEnvKey)) return;
    envKey = customEnvKey;
  } else {
    providerName = selectedProvider.provider;
    baseUrl = selectedProvider.baseUrl;
    envKey = selectedProvider.envKey;
  }

  // 输入 API Key
  const apiKeyMessage = provider === 'uucode'
    ? '请输入 UUcode API Key:'
    : provider === 'openai'
      ? '请输入 OpenAI API Key:'
      : '请输入 API Key:';

  const apiKey = await promptApiKey({ message: apiKeyMessage, provider });
  if (!apiKey) return;

  const s = spinner();
  s.start('正在配置 Codex...');
  let windowsShell = null;

  try {
    // 确保配置目录存在
    if (!fs.existsSync(configPath.config)) {
      fs.mkdirSync(configPath.config, { recursive: true });
    }

    // 创建 config.toml (完整配置)
    const configTomlPath = path.join(configPath.config, 'config.toml');
    const configTomlContent = `model_provider = "${providerName}"
model = "gpt-5.1"
model_reasoning_effort = "high"
disable_response_storage = true

[model_providers.${providerName}]
name = "${providerName}"
base_url = "${baseUrl}"
wire_api = "responses"
env_key = "${envKey}"
requires_openai_auth = true
`;
    fs.writeFileSync(configTomlPath, configTomlContent);

    // 创建 auth.json
    const authJsonPath = path.join(configPath.config, 'auth.json');
    const authJsonContent = {
      OPENAI_API_KEY: apiKey
    };
    fs.writeFileSync(authJsonPath, JSON.stringify(authJsonContent, null, 2));

    // 设置环境变量
    if (osInfo.type === 'windows') {
      windowsShell = detectWindowsShell();
      setWindowsEnvVariable(envKey, apiKey, windowsShell);
    } else {
      // macOS/Linux: 写入 shell 配置文件
      const shellConfig = getShellConfigFile(osInfo);
      if (shellConfig) {
        let content = '';
        if (fs.existsSync(shellConfig)) {
          content = fs.readFileSync(shellConfig, 'utf8');
        }

        // 移除旧的 Codex 配置
        content = content.replace(/# Codex API Configuration[\s\S]*?export \w+=.*\n/g, '');
        content = content.replace(/export uucode_apikey=.*\n/g, '');
        content = content.replace(/export OPENAI_API_KEY=.*\n/g, '');

        // 添加新配置
        const envConfig = `
# Codex API Configuration
export ${envKey}=${apiKey}
`;

        content += envConfig;
        fs.writeFileSync(shellConfig, content);
      }
    }

    s.stop('Codex 配置完成');

    showBox('配置成功', `
配置文件目录: ${configPath.config}
config.toml: 已创建
auth.json: 已创建

配置内容:
  Provider: ${providerName}
  Base URL: ${baseUrl}
  Model: gpt-5.1
  API Key: ${'*'.repeat(8)}...

${osInfo.type === 'windows'
  ? getWindowsReloadTip(windowsShell)
  : `请运行 'source ${getShellConfigFile(osInfo)}' 或重新打开终端`}
`, 'success');

  } catch (error) {
    s.stop('配置失败');
    console.error(theme.error(`配置失败: ${error.message}`));
  }
}

/**
 * 获取 shell 配置文件路径
 */
function getShellConfigFile(osInfo) {
  const home = require('os').homedir();
  const shell = process.env.SHELL || '';

  if (osInfo.type === 'windows') {
    return path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
  }

  if (shell.includes('zsh')) {
    return path.join(home, '.zshrc');
  } else if (shell.includes('bash')) {
    return path.join(home, '.bashrc');
  }

  return path.join(home, '.bashrc');
}

/**
 * 检测 Windows 下正在使用的 shell
 */
function detectWindowsShell() {
  const shellEnv = (process.env.SHELL || '').toLowerCase();
  if (shellEnv.includes('powershell')) return 'powershell';
  if (shellEnv.includes('cmd')) return 'cmd';

  if (process.env.POWERSHELL_DISTRIBUTION_CHANNEL || process.env.PSExecutionPolicyPreference) {
    return 'powershell';
  }

  // cmd 默认带 PROMPT 环境变量，PowerShell 通常没有
  if (process.env.PROMPT) return 'cmd';

  return 'powershell';
}

/**
 * 在 Windows 下设置用户级环境变量
 */
function setWindowsEnvVariable(key, value, preferredShell = 'powershell') {
  const safeValue = String(value);

  if (preferredShell === 'cmd') {
    const cmdResult = spawnSync('setx', [key, safeValue], { stdio: 'ignore' });
    if (!cmdResult.error && cmdResult.status === 0) return;
  }

  const escapedValue = safeValue.replace(/'/g, "''");
  const psCommand = `[System.Environment]::SetEnvironmentVariable('${key}', '${escapedValue}', [System.EnvironmentVariableTarget]::User)`;
  const psResult = spawnSync('powershell', ['-NoProfile', '-Command', psCommand], { stdio: 'ignore' });

  if (psResult.error || psResult.status !== 0) {
    const fallback = spawnSync('setx', [key, safeValue], { stdio: 'ignore' });
    if (fallback.error || fallback.status !== 0) {
      throw new Error('无法在 Windows 上设置环境变量，请手动设置后重试');
    }
  }
}

/**
 * Windows 下的生效提示
 */
function getWindowsReloadTip(shell) {
  const target = shell === 'cmd' ? '命令提示符 (cmd)' : 'PowerShell';
  return `请重新打开 ${target} 使环境变量生效`;
}

/**
 * 显示安装指南
 */
function showInstallGuide(osInfo) {
  showBox('Codex CLI 安装指南', `
使用 npm 安装:
npm install -g @openai/codex

安装完成后重新运行此工具进行配置。
`, 'info');
}

module.exports = {
  configureCodex
};
