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
