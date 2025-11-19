const { select, text, password, confirm, isCancel, cancel, spinner } = require('@clack/prompts');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { theme, showBox } = require('../ui');

/**
 * API 提供商列表
 */
const API_PROVIDERS = [
  {
    label: 'UUcode',
    value: 'uucode',
    baseUrl: 'https://www.uucode.org'
  },
  {
    label: 'Anthropic (官方)',
    value: 'anthropic',
    baseUrl: 'https://api.anthropic.com'
  },
  {
    label: '其他第三方',
    value: 'custom',
    baseUrl: ''
  }
];

/**
 * 配置 Claude Code
 */
async function configureClaude(osInfo, toolInfo, configPath) {
  if (!toolInfo.installed) {
    console.log(theme.warning('\n⚠️  Claude Code 未安装'));
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

  console.log(theme.success('\n✓ Claude Code 已安装'));

  const configType = await select({
    message: '选择配置类型:',
    options: [
      { label: '📁 配置 API (配置文件)', value: 'api-file' },
      { label: '🌍 配置 API (环境变量)', value: 'api-env' },
      { label: '↩️  返回', value: 'back' }
    ]
  });

  if (isCancel(configType)) return;

  switch (configType) {
    case 'api-file':
      await configureApiByFile(configPath);
      break;
    case 'api-env':
      await configureApiByEnv(osInfo, configPath);
      break;
    case 'back':
      return;
  }
}

/**
 * 通过配置文件配置 API
 */
async function configureApiByFile(configPath) {
  // 选择 API 提供商
  const provider = await select({
    message: '选择 API 提供商:',
    options: API_PROVIDERS
  });

  if (isCancel(provider)) return;

  // 获取 base URL
  let baseUrl = '';
  const selectedProvider = API_PROVIDERS.find(p => p.value === provider);

  if (provider === 'custom') {
    const customUrl = await text({
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
    if (isCancel(customUrl)) return;
    baseUrl = customUrl;
  } else {
    baseUrl = selectedProvider.baseUrl;
  }

  // 输入 API Key
  const apiKeyMessage = provider === 'uucode'
    ? '请输入 UUcode API Key:'
    : provider === 'anthropic'
      ? '请输入 Anthropic API Key:'
      : '请输入 API Key:';

  const apiKey = await password({
    message: apiKeyMessage,
    mask: '*',
    validate: (input) => {
      if (!input || input.trim() === '') return '请输入有效的 API Key';
    }
  });

  if (isCancel(apiKey)) return;

  const s = spinner();
  s.start('正在配置 settings.json...');

  try {
    // 确保配置目录存在
    if (!fs.existsSync(configPath.config)) {
      fs.mkdirSync(configPath.config, { recursive: true });
    }

    // 读取或创建设置文件
    let settings = {};
    if (fs.existsSync(configPath.settings)) {
      try {
        settings = JSON.parse(fs.readFileSync(configPath.settings, 'utf8'));
      } catch (e) {
        settings = {};
      }
    }

    // 确保 env 和 permissions 对象存在
    if (!settings.env) settings.env = {};
    if (!settings.permissions) {
      settings.permissions = { allow: [], deny: [] };
    }

    // 设置环境变量
    settings.env.ANTHROPIC_AUTH_TOKEN = apiKey;
    settings.env.ANTHROPIC_BASE_URL = baseUrl;
    settings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';

    // 写入文件
    fs.writeFileSync(configPath.settings, JSON.stringify(settings, null, 2));

    // 配置 VSCode 支持 (config.json)
    await configureVSCodeSupport(configPath, apiKey);

    s.stop('配置文件已更新');

    showBox('配置成功', `
配置文件: ${configPath.settings}
API 提供商: ${selectedProvider ? selectedProvider.label : '自定义'}
Base URL: ${baseUrl}
API Key: ${'*'.repeat(8)}...
`, 'success');

    // 提示安装 VSCode 扩展
    showVSCodeExtensionTip();

  } catch (error) {
    s.stop('配置失败');
    console.error(theme.error(`配置失败: ${error.message}`));
  }
}

/**
 * 通过环境变量配置 API
 */
async function configureApiByEnv(osInfo, configPath) {
  // 选择 API 提供商
  const provider = await select({
    message: '选择 API 提供商:',
    options: API_PROVIDERS
  });

  if (isCancel(provider)) return;

  // 获取 base URL
  let baseUrl = '';
  const selectedProvider = API_PROVIDERS.find(p => p.value === provider);

  if (provider === 'custom') {
    const customUrl = await text({
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
    if (isCancel(customUrl)) return;
    baseUrl = customUrl;
  } else {
    baseUrl = selectedProvider.baseUrl;
  }

  // 输入 API Key
  const apiKeyMessage = provider === 'uucode'
    ? '请输入 UUcode API Key:'
    : provider === 'anthropic'
      ? '请输入 Anthropic API Key:'
      : '请输入 API Key:';

  const apiKey = await password({
    message: apiKeyMessage,
    mask: '*',
    validate: (input) => {
      if (!input || input.trim() === '') return '请输入有效的 API Key';
    }
  });

  if (isCancel(apiKey)) return;

  const s = spinner();
  s.start('正在配置环境变量...');

  try {
    if (osInfo.type === 'windows') {
      // Windows: 使用 PowerShell 设置用户级环境变量
      const commands = [
        `[System.Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "${baseUrl}", [System.EnvironmentVariableTarget]::User)`,
        `[System.Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "${apiKey}", [System.EnvironmentVariableTarget]::User)`,
        `[System.Environment]::SetEnvironmentVariable("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1", [System.EnvironmentVariableTarget]::User)`
      ];

      for (const cmd of commands) {
        execSync(`powershell -Command "${cmd}"`, { stdio: 'ignore' });
      }

      s.stop('环境变量已设置 (用户级永久生效)');

      // 配置 VSCode 支持 (config.json)
      await configureVSCodeSupport(configPath, apiKey);

      console.log(theme.dim('\n请重新打开终端或命令提示符使配置生效'));

      // 提示安装 VSCode 扩展
      showVSCodeExtensionTip();

    } else {
      // macOS/Linux: 写入 shell 配置文件
      const shellConfig = getShellConfigFile(osInfo);

      if (shellConfig) {
        // 读取现有配置
        let content = '';
        if (fs.existsSync(shellConfig)) {
          content = fs.readFileSync(shellConfig, 'utf8');
        }

        // 移除旧的 Claude Code 配置
        content = content.replace(/# Claude Code API Configuration[\s\S]*?export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=.*\n/g, '');
        content = content.replace(/export ANTHROPIC_AUTH_TOKEN=.*\n/g, '');
        content = content.replace(/export ANTHROPIC_BASE_URL=.*\n/g, '');
        content = content.replace(/export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=.*\n/g, '');

        // 添加新配置
        const envConfig = `
# Claude Code API Configuration
export ANTHROPIC_AUTH_TOKEN=${apiKey}
export ANTHROPIC_BASE_URL=${baseUrl}
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
`;

        content += envConfig;

        fs.writeFileSync(shellConfig, content);
        s.stop(`环境变量已保存到 ${shellConfig}`);

        // 配置 VSCode 支持 (config.json)
        await configureVSCodeSupport(configPath, apiKey);

        showBox('配置成功', `
请运行以下命令使配置生效:
source ${shellConfig}

或重新打开终端
`, 'success');

        // 提示安装 VSCode 扩展
        showVSCodeExtensionTip();

      } else {
        s.stop('无法确定 shell 配置文件');
        showBox('手动配置', `
请手动添加以下环境变量:
export ANTHROPIC_AUTH_TOKEN=${apiKey}
export ANTHROPIC_BASE_URL=${baseUrl}
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
`, 'warning');
      }
    }
  } catch (error) {
    s.stop('配置失败');
    console.error(theme.error(`配置失败: ${error.message}`));
  }
}

/**
 * 配置 VSCode 支持 (config.json)
 */
async function configureVSCodeSupport(configPath, apiKey) {
  try {
    // 确保配置目录存在
    if (!fs.existsSync(configPath.config)) {
      fs.mkdirSync(configPath.config, { recursive: true });
    }

    // config.json 路径
    const configJsonPath = path.join(configPath.config, 'config.json');

    // 读取或创建 config.json
    let config = {};
    if (fs.existsSync(configJsonPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
      } catch (e) {
        config = {};
      }
    }

    // 设置 primaryApiKey
    config.primaryApiKey = apiKey;

    // 写入文件
    fs.writeFileSync(configJsonPath, JSON.stringify(config, null, 2));
    console.log(theme.success(`✅ VSCode 支持已配置: ${configJsonPath}`));

  } catch (error) {
    console.log(theme.warning(`⚠️  VSCode 配置失败: ${error.message}`));
  }
}

/**
 * 显示 VSCode 扩展安装提示
 */
function showVSCodeExtensionTip() {
  showBox('VSCode 扩展', `
请在 VSCode 扩展市场安装 "Claude Code for VS Code"
或在 VSCode 中搜索: Claude Code
`, 'info');
}

/**
 * 获取 shell 配置文件路径
 */
function getShellConfigFile(osInfo) {
  const home = require('os').homedir();
  const shell = process.env.SHELL || '';

  if (osInfo.type === 'windows') {
    // Windows PowerShell profile
    return path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
  }

  if (shell.includes('zsh')) {
    return path.join(home, '.zshrc');
  } else if (shell.includes('bash')) {
    return path.join(home, '.bashrc');
  } else if (shell.includes('fish')) {
    return path.join(home, '.config', 'fish', 'config.fish');
  }

  // 默认 bash
  return path.join(home, '.bashrc');
}

/**
 * 显示安装指南
 */
function showInstallGuide(osInfo) {
  let installCmd = '';
  if (osInfo.type === 'windows') {
    installCmd = 'irm https://claude.ai/install.ps1 | iex';
  } else {
    installCmd = 'curl -fsSL https://claude.ai/install.sh | sh';
  }

  showBox('Claude Code 安装指南', `
使用 npm 安装:
npm install -g @anthropic-ai/claude-code

或使用官方安装脚本:
${installCmd}

安装完成后重新运行此工具进行配置。
`, 'info');
}

module.exports = {
  configureClaude
};
