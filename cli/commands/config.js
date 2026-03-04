const { Command } = require('commander');
const conf = require('../lib/config');
const out = require('../lib/output');

const cmd = new Command('config')
  .description('Manage CLI configuration');

cmd
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const cfg = conf.load();
    if (out.isJsonMode()) return out.json(cfg);
    out.heading('Configuration');
    out.item(cfg, [
      ['Wallet', 'wallet'],
      ['Base URL', 'baseUrl'],
      ['RPC URL', 'rpcUrl'],
      ['Registry', 'registryAddress'],
      ['USDC', 'usdcAddress'],
      ['Chain ID', 'chainId'],
    ]);
  });

cmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action((key, value) => {
    try {
      conf.set(key, value);
      out.success(`${key} = ${value}`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd
  .command('get <key>')
  .description('Get a configuration value')
  .action((key) => {
    const val = conf.get(key);
    if (out.isJsonMode()) return out.json({ [key]: val ?? null });
    if (val === undefined) {
      out.warn(`${key} is not set`);
    } else {
      console.log(val);
    }
  });

cmd
  .command('reset')
  .description('Reset configuration to defaults')
  .action(() => {
    conf.save({});
    out.success('Configuration reset to defaults');
  });

module.exports = cmd;
