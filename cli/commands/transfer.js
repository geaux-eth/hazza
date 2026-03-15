const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');
const conf = require('../lib/config');
const payment = require('../lib/payment');

const cmd = new Command('transfer')
  .argument('<name>', 'Name to transfer')
  .argument('<to>', 'Recipient wallet address')
  .description('Transfer a hazza name to another wallet')
  .action(async (name, to) => {
    try {
      payment.requireCast();

      // Resolve the name to get tokenId and current owner
      out.info(`Looking up "${name}"...`);
      const resolved = await api.resolve(name);
      if (!resolved || !resolved.owner || resolved.owner === '0x0000000000000000000000000000000000000000') {
        out.error(`"${name}" is not registered`);
        process.exit(1);
      }

      const wallet = conf.get('wallet');
      if (!wallet) {
        out.error('No wallet configured. Run: hazza config set wallet <address>');
        process.exit(1);
      }

      if (resolved.owner.toLowerCase() !== wallet.toLowerCase()) {
        out.error(`You don't own "${name}". Owner: ${resolved.owner}`);
        process.exit(1);
      }

      const tokenId = resolved.tokenId;
      if (!tokenId) {
        out.error('Could not determine token ID');
        process.exit(1);
      }

      out.info(`Transferring "${name}" (token #${tokenId}) to ${to}...`);

      const registry = conf.get('registryAddress');
      const txHash = payment.contractSend(
        registry,
        'safeTransferFrom(address,address,uint256)',
        [wallet, to, tokenId],
      );

      out.success(`Transferred "${name}" to ${to}`);
      out.info(`Tx: ${txHash}`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
