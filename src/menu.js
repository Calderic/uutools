const { intro, outro, select, confirm, isCancel, spinner } = require('@clack/prompts');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { detectOS, detectTools, getConfigPaths } = require('./system');
const { configureClaude } = require('./configurators/claude');
const { configureCodex } = require('./configurators/codex');
const { configureGemini } = require('./configurators/gemini');
const { theme, showBox } = require('./ui');
const { promptApiKey } = require('./utils/apiKeyPrompt');

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
  // 选择供应商
  const provider = await select({
    message: '选择 API 提供商:',
    options: [
      { label: 'UUcode', value: 'uucode' },
      { label: '其他供应商 (分别配置)', value: 'other' }
    ]
  });

  if (isCancel(provider)) return;

  if (provider === 'other') {
    // 分别配置每个工具
    console.log(theme.warning('\n📦 开始配置全部工具...\n'));

    console.log(theme.primary('━━━ Claude Code ━━━'));
    await configureClaude(osInfo, tools.claude, configPaths.claude);

    console.log(theme.primary('\n━━━ Codex CLI ━━━'));
    await configureCodex(osInfo, tools.codex, configPaths.codex);

    console.log(theme.primary('\n━━━ Gemini CLI ━━━'));
    await configureGemini(osInfo, tools.gemini, configPaths.gemini);

    console.log(theme.success('\n✅ 全部工具配置完成！\n'));
  } else {
    // UUcode 一键配置
    await configureAllWithUUcode(osInfo, configPaths);
  }
}

/**
 * 使用 UUcode 一键配置全部工具
 */
async function configureAllWithUUcode(osInfo, configPaths) {
  // 输入 API Key
  const apiKey = await promptApiKey({ provider: 'uucode', message: '请输入 UUcode API Key:' });
  if (!apiKey) return;

  const s = spinner();
  s.start('正在配置全部工具...');

  try {
    // 配置 Claude Code
    await configureClaudeWithUUcode(osInfo, configPaths.claude, apiKey);

    // 配置 Codex
    await configureCodexWithUUcode(osInfo, configPaths.codex, apiKey);

    // 配置 Gemini
    await configureGeminiWithUUcode(configPaths.gemini, apiKey);

    s.stop('全部工具配置完成');

    showBox('配置成功', `
已配置的工具:
  ✅ Claude Code - ~/.claude/settings.json + config.json
  ✅ Codex CLI - ~/.codex/config.toml + auth.json
  ✅ Gemini CLI - ~/.gemini/.env + settings.json

API 提供商: UUcode
API Key: ${'*'.repeat(8)}...

${osInfo.type === 'windows'
  ? '请重新打开终端或命令提示符使配置生效'
  : '请重新打开终端使配置生效'}
`, 'success');

    // 提示安装 VSCode 扩展
    showBox('VSCode 扩展', `
请在 VSCode 扩展市场安装 "Claude Code for VS Code"
或在 VSCode 中搜索: Claude Code
`, 'info');

  } catch (error) {
    s.stop('配置失败');
    console.error(theme.error(`配置失败: ${error.message}`));
  }
}

/**
 * 使用 UUcode 配置 Claude Code
 */
async function configureClaudeWithUUcode(osInfo, configPath, apiKey) {
  // 确保配置目录存在
  if (!fs.existsSync(configPath.config)) {
    fs.mkdirSync(configPath.config, { recursive: true });
  }

  // 配置 settings.json
  let settings = {};
  if (fs.existsSync(configPath.settings)) {
    try {
      settings = JSON.parse(fs.readFileSync(configPath.settings, 'utf8'));
    } catch (e) {
      settings = {};
    }
  }

  if (!settings.env) settings.env = {};
  if (!settings.permissions) {
    settings.permissions = { allow: [], deny: [] };
  }

  settings.env.ANTHROPIC_AUTH_TOKEN = apiKey;
  settings.env.ANTHROPIC_BASE_URL = 'https://api.uucode.org';
  settings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';

  fs.writeFileSync(configPath.settings, JSON.stringify(settings, null, 2));

  // 配置 config.json (VSCode 支持)
  const configJsonPath = path.join(configPath.config, 'config.json');
  let config = {};
  if (fs.existsSync(configJsonPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
    } catch (e) {
      config = {};
    }
  }
  config.primaryApiKey = apiKey;
  fs.writeFileSync(configJsonPath, JSON.stringify(config, null, 2));
}

/**
 * 使用 UUcode 配置 Codex
 */
async function configureCodexWithUUcode(osInfo, configPath, apiKey) {
  // 确保配置目录存在
  if (!fs.existsSync(configPath.config)) {
    fs.mkdirSync(configPath.config, { recursive: true });
  }

  // 创建 config.toml
  const configTomlPath = path.join(configPath.config, 'config.toml');
  const configTomlContent = `model_provider = "uucode"
model = "gpt-5.1"
model_reasoning_effort = "high"
disable_response_storage = true

[model_providers.uucode]
name = "uucode"
base_url = "https://api.uucode.org"
wire_api = "responses"
env_key = "uucode_apikey"
requires_openai_auth = true
`;
  fs.writeFileSync(configTomlPath, configTomlContent);

  // 创建 auth.json
  const authJsonPath = path.join(configPath.config, 'auth.json');
  const authJsonContent = { OPENAI_API_KEY: apiKey };
  fs.writeFileSync(authJsonPath, JSON.stringify(authJsonContent, null, 2));

  // 设置环境变量
  if (osInfo.type === 'windows') {
    const cmd = `[System.Environment]::SetEnvironmentVariable("uucode_apikey", "${apiKey}", [System.EnvironmentVariableTarget]::User)`;
    execSync(`powershell -Command "${cmd}"`, { stdio: 'ignore' });
  } else {
    const shellConfig = getShellConfigFile(osInfo);
    if (shellConfig) {
      let content = '';
      if (fs.existsSync(shellConfig)) {
        content = fs.readFileSync(shellConfig, 'utf8');
      }

      content = content.replace(/# Codex API Configuration[\s\S]*?export \w+=.*\n/g, '');
      content = content.replace(/export uucode_apikey=.*\n/g, '');

      const envConfig = `
# Codex API Configuration
export uucode_apikey=${apiKey}
`;

      content += envConfig;
      fs.writeFileSync(shellConfig, content);
    }
  }
}

/**
 * 使用 UUcode 配置 Gemini
 */
async function configureGeminiWithUUcode(configPath, apiKey) {
  // 确保配置目录存在
  if (!fs.existsSync(configPath.config)) {
    fs.mkdirSync(configPath.config, { recursive: true });
  }

  // 创建 .env 文件
  const envFilePath = path.join(configPath.config, '.env');
  const envContent = `GOOGLE_GEMINI_BASE_URL=https://api.uucode.org
GEMINI_API_KEY=${apiKey}
GEMINI_MODEL=gemini-3-pro-preview
`;
  fs.writeFileSync(envFilePath, envContent);

  // 创建 settings.json 文件
  const settingsPath = path.join(configPath.config, 'settings.json');
  const settingsContent = {
    ide: { enabled: true },
    security: {
      auth: { selectedType: 'gemini-api-key' }
    }
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settingsContent, null, 2));
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

module.exports = {
  startInteractiveMenu
};
