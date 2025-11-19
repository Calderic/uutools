const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const ora = require('ora');
const { execSync } = require('child_process');

/**
 * API 提供商列表
 */
const API_PROVIDERS = [
  {
    name: 'UUcode',
    value: 'uucode',
    baseUrl: 'https://www.uucode.org'
  },
  {
    name: 'Anthropic (官方)',
    value: 'anthropic',
    baseUrl: 'https://api.anthropic.com'
  },
  {
    name: '其他第三方',
    value: 'custom',
    baseUrl: ''
  }
];

/**
 * 配置 Claude Code
 */
async function configureClaude(osInfo, toolInfo, configPath) {
  if (!toolInfo.installed) {
    console.log(chalk.yellow('\n⚠️  Claude Code 未安装'));
    const { installNow } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'installNow',
        message: '是否显示安装指南?',
        default: true
      }
    ]);

    if (installNow) {
      showInstallGuide(osInfo);
    }
    return;
  }

  console.log(chalk.green('\n✓ Claude Code 已安装'));

  const { configType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'configType',
      message: '选择配置类型:',
      choices: [
        { name: '📁 配置 API (配置文件)', value: 'api-file' },
        { name: '🌍 配置 API (环境变量)', value: 'api-env' },
        { name: '↩️  返回', value: 'back' }
      ]
    }
  ]);

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
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: '选择 API 提供商:',
      choices: API_PROVIDERS.map(p => ({
        name: p.name,
        value: p.value
      }))
    }
  ]);

  // 获取 base URL
  let baseUrl = '';
  const selectedProvider = API_PROVIDERS.find(p => p.value === provider);

  if (provider === 'custom') {
    const { customUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customUrl',
        message: '请输入 API Base URL:',
        validate: (input) => {
          if (!input || input.trim() === '') {
            return '请输入有效的 URL';
          }
          try {
            new URL(input);
            return true;
          } catch {
            return '请输入有效的 URL';
          }
        }
      }
    ]);
    baseUrl = customUrl;
  } else {
    baseUrl = selectedProvider.baseUrl;
  }

  // 输入 API Key
  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: '请输入 API Key:',
      mask: '*',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return '请输入有效的 API Key';
        }
        return true;
      }
    }
  ]);

  const spinner = ora('正在配置 settings.json...').start();

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
        // 文件存在但解析失败，使用空对象
        settings = {};
      }
    }

    // 确保 env 和 permissions 对象存在
    if (!settings.env) {
      settings.env = {};
    }
    if (!settings.permissions) {
      settings.permissions = {
        allow: [],
        deny: []
      };
    }

    // 设置环境变量
    settings.env.ANTHROPIC_AUTH_TOKEN = apiKey;
    settings.env.ANTHROPIC_BASE_URL = baseUrl;
    settings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';

    // 写入文件
    fs.writeFileSync(configPath.settings, JSON.stringify(settings, null, 2));

    // 配置 VSCode 支持 (config.json)
    await configureVSCodeSupport(configPath, apiKey);

    spinner.succeed('配置文件已更新');
    console.log(chalk.green(`\n✅ 配置已保存到 ${configPath.settings}`));
    console.log(chalk.gray('\n配置内容:'));
    console.log(chalk.gray(`   API 提供商: ${selectedProvider ? selectedProvider.name : '自定义'}`));
    console.log(chalk.gray(`   Base URL: ${baseUrl}`));
    console.log(chalk.gray(`   API Key: ${'*'.repeat(8)}...`));

    // 提示安装 VSCode 扩展
    showVSCodeExtensionTip();

  } catch (error) {
    spinner.fail(`配置失败: ${error.message}`);
  }
}

/**
 * 通过环境变量配置 API
 */
async function configureApiByEnv(osInfo, configPath) {
  // 选择 API 提供商
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: '选择 API 提供商:',
      choices: API_PROVIDERS.map(p => ({
        name: p.name,
        value: p.value
      }))
    }
  ]);

  // 获取 base URL
  let baseUrl = '';
  const selectedProvider = API_PROVIDERS.find(p => p.value === provider);

  if (provider === 'custom') {
    const { customUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customUrl',
        message: '请输入 API Base URL:',
        validate: (input) => {
          if (!input || input.trim() === '') {
            return '请输入有效的 URL';
          }
          try {
            new URL(input);
            return true;
          } catch {
            return '请输入有效的 URL';
          }
        }
      }
    ]);
    baseUrl = customUrl;
  } else {
    baseUrl = selectedProvider.baseUrl;
  }

  // 输入 API Key
  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: '请输入 API Key:',
      mask: '*',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return '请输入有效的 API Key';
        }
        return true;
      }
    }
  ]);

  const spinner = ora('正在配置环境变量...').start();

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

      spinner.succeed('环境变量已设置 (用户级永久生效)');

      // 配置 VSCode 支持 (config.json)
      await configureVSCodeSupport(configPath, apiKey);

      console.log(chalk.gray('\n请重新打开终端或命令提示符使配置生效'));

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
        spinner.succeed(`环境变量已保存到 ${shellConfig}`);

        // 配置 VSCode 支持 (config.json)
        await configureVSCodeSupport(configPath, apiKey);

        console.log(chalk.gray(`\n请运行以下命令使配置生效:`));
        console.log(chalk.cyan(`   source ${shellConfig}`));
        console.log(chalk.gray('\n或重新打开终端'));

        // 提示安装 VSCode 扩展
        showVSCodeExtensionTip();

      } else {
        spinner.warn('无法确定 shell 配置文件');
        console.log(chalk.yellow('\n请手动添加以下环境变量:'));
        console.log(chalk.gray(`   export ANTHROPIC_AUTH_TOKEN=${apiKey}`));
        console.log(chalk.gray(`   export ANTHROPIC_BASE_URL=${baseUrl}`));
        console.log(chalk.gray(`   export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`));
      }
    }
  } catch (error) {
    spinner.fail(`配置失败: ${error.message}`);
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
    console.log(chalk.green(`✅ VSCode 支持已配置: ${configJsonPath}`));

  } catch (error) {
    console.log(chalk.yellow(`⚠️  VSCode 配置失败: ${error.message}`));
  }
}

/**
 * 显示 VSCode 扩展安装提示
 */
function showVSCodeExtensionTip() {
  console.log(chalk.bold.cyan('\n📦 VSCode 扩展:'));
  console.log(chalk.white('   请在 VSCode 扩展市场安装 "Claude Code for VS Code"'));
  console.log(chalk.gray('   或在 VSCode 中搜索: Claude Code'));
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
  console.log(chalk.bold.cyan('\n📖 Claude Code 安装指南:\n'));

  console.log(chalk.white('使用 npm 安装:'));
  console.log(chalk.gray('   npm install -g @anthropic-ai/claude-code\n'));

  console.log(chalk.white('或使用官方安装脚本:'));
  if (osInfo.type === 'windows') {
    console.log(chalk.gray('   irm https://claude.ai/install.ps1 | iex\n'));
  } else {
    console.log(chalk.gray('   curl -fsSL https://claude.ai/install.sh | sh\n'));
  }

  console.log(chalk.gray('安装完成后重新运行此工具进行配置。\n'));
}

module.exports = {
  configureClaude
};
