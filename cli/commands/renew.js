const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');
const conf = require('../lib/config');
const payment = require('../lib/payment');

const cmd = new Command('renew')
  .argument('<name>', 'Name to renew')
  .option('-y, --years <n>', 'Number of years', '1')
  .description('Renew a HAZZA name registration')
  .action(async (name, opts) => {
    try {
      payment.requireCast();

      const wallet = conf.get('wallet');
      if (!wallet) {
        out.error('No wallet configured. Run: hazza config set wallet <address>');
        process.exit(1);
      }

      const years = parseInt(opts.years) || 1;
      const registryAddress = conf.get('registryAddress');
      const rpcUrl = conf.get('rpcUrl');

      // Get renewal quote
      out.info(`Getting renewal quote for "${name}" (${years} year(s))...`);
      const quoteData = await api.quote(name, wallet, years).catch(() => null);
      if (quoteData) {
        const cost = quoteData.totalCost || quoteData.renewalCost || quoteData.price || 0;
        out.info(`Cost: ${payment.formatUSDC(cost)} USDC`);

        // Approve USDC to registry
        out.info('Approving USDC...');
        const approveTx = payment.approveUSDC(registryAddress, cost, rpcUrl);
        out.success(`Approved: ${approveTx}`);
      }

      // Call renew on the registry contract
      out.info('Submitting renewal...');
      const renewTx = payment.contractSend(
        registryAddress,
        'renew(string,uint256)',
        [name, years.toString()],
        rpcUrl,
      );

      out.success(`Renewed "${name}" for ${years} year(s)!`);
      out.info(`Tx: ${renewTx}`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
