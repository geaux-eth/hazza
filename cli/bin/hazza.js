#!/usr/bin/env node

const { Command } = require('commander');
const { setJsonMode } = require('../lib/output');
const pkg = require('../package.json');

const program = new Command()
  .name('hazza')
  .description('hazza — immediately useful names on Base, powered by x402 and Net Protocol')
  .version(pkg.version)
  .option('--json', 'Output as JSON')
  .option('--rpc-url <url>', 'Override RPC URL')
  .option('--wallet <address>', 'Override wallet address')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.json) setJsonMode(true);
    const conf = require('../lib/config');
    if (opts.rpcUrl) conf.override('rpcUrl', opts.rpcUrl);
    if (opts.wallet) conf.override('wallet', opts.wallet);
  });

// Register commands
program.addCommand(require('../commands/config'));
program.addCommand(require('../commands/search'));
program.addCommand(require('../commands/register'));
program.addCommand(require('../commands/names'));
program.addCommand(require('../commands/profile'));
program.addCommand(require('../commands/records'));
program.addCommand(require('../commands/stats'));
program.addCommand(require('../commands/marketplace'));
program.addCommand(require('../commands/transfer'));
program.addCommand(require('../commands/site'));
program.addCommand(require('../commands/domain'));
program.addCommand(require('../commands/export'));
program.addCommand(require('../commands/contact'));

// hazza primary <name> — set primary name for reverse resolution
program
  .command('primary <name>')
  .description('Set your primary hazza name (for reverse resolution: address → name)')
  .action(async (name) => {
    const out = require('../lib/output');
    const conf = require('../lib/config');
    const payment = require('../lib/payment');
    const api = require('../lib/api');
    try {
      payment.requireCast();
      const wallet = conf.get('wallet');
      if (!wallet) {
        out.error('No wallet configured. Run: hazza config set wallet <address>');
        process.exit(1);
      }
      const resolved = await api.resolve(name);
      if (!resolved || !resolved.owner) {
        out.error(`"${name}" is not registered`);
        process.exit(1);
      }
      if (resolved.owner.toLowerCase() !== wallet.toLowerCase()) {
        out.error(`You don't own "${name}". Owner: ${resolved.owner}`);
        process.exit(1);
      }
      out.info(`Setting "${name}" as your primary name...`);
      const registry = conf.get('registryAddress');
      const txHash = payment.contractSend(registry, 'setPrimaryName(string)', [name]);
      out.success(`Primary name set to "${name}"`);
      out.info(`Tx: ${txHash}`);
      out.info(`Reverse resolution: ${wallet} → ${name}.hazza.name`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

// Alias: hazza set <name> <key> <value> → hazza records set
program
  .command('set <name> <key> <value>')
  .description('Set a text record (shorthand for: hazza records set)')
  .action(async (name, key, value) => {
    // Delegate to records set
    process.argv = ['node', 'hazza', 'records', 'set', name, key, value];
    await require('../commands/records').parseAsync(['records', 'set', name, key, value], { from: 'user' });
  });

// Alias: hazza get <name> <key> → hazza records get
program
  .command('get <name> <key>')
  .description('Get a text record (shorthand for: hazza records get)')
  .action(async (name, key) => {
    process.argv = ['node', 'hazza', 'records', 'get', name, key];
    await require('../commands/records').parseAsync(['records', 'get', name, key], { from: 'user' });
  });

program.parseAsync().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
