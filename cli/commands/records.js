const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');
const conf = require('../lib/config');
const payment = require('../lib/payment');

const cmd = new Command('records')
  .description('Get or set text records for a name');

cmd
  .command('get <name> <key>')
  .description('Get a text record')
  .action(async (name, key) => {
    try {
      const result = await api.getText(name, key);
      if (out.isJsonMode()) return out.json(result);
      const value = result.value ?? result.text ?? result;
      if (value) {
        console.log(value);
      } else {
        out.warn(`No record found for key "${key}"`);
      }
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd
  .command('set <name> <key> <value>')
  .description('Set a text record (uses x402 $0.02 USDC or direct contract call)')
  .option('--direct', 'Use direct contract call instead of x402 (requires ETH for gas)')
  .action(async (name, key, value, opts) => {
    try {
      payment.requireCast();
      const wallet = payment.getWallet();
      const rpcUrl = payment.getRpcUrl();

      // Verify ownership
      const resolved = await api.resolve(name);
      if (!resolved || !resolved.owner) {
        out.error(`Name "${name}" not found`);
        process.exit(1);
      }
      if (resolved.owner.toLowerCase() !== wallet.toLowerCase()) {
        out.error(`You don't own "${name}" — owner is ${resolved.owner}`);
        process.exit(1);
      }

      if (opts.direct) {
        // Direct contract call (costs ETH gas)
        out.info(`Setting ${key} = "${value}" for ${name} (direct)...`);
        const txHash = payment.contractSend(
          conf.get('registryAddress'),
          'setText(string,string,string)',
          [name, key, value],
          rpcUrl,
        );
        out.success(`Record set!`);
        out.info(`Tx: ${txHash}`);
      } else {
        // x402 flow ($0.02 USDC, relayer executes)
        out.info(`Setting ${key} = "${value}" for ${name} via x402...`);

        // Step 1: Get payment requirements
        const initial = await api.setTextX402(name, { key, value });
        if (initial.status !== 402) {
          // Shouldn't happen without payment, but handle it
          out.success('Record set!');
          return;
        }

        const payTo = initial.accepts[0].payTo;
        const amount = initial.accepts[0].maxAmountRequired;
        out.info(`Payment: ${payment.formatUSDC(amount)} USDC`);

        // Step 2: Transfer USDC
        const txHash = payment.transferUSDC(payTo, amount, rpcUrl);
        out.info(`Payment tx: ${txHash}`);

        // Step 3: Retry with payment proof
        const header = payment.makePaymentHeader(txHash, wallet);
        const result = await api.setTextX402(name, { key, value }, header);
        if (result.error) throw new Error(result.error);

        out.success(`Record set!`);
        out.info(`Tx: ${result.tx}`);
      }
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd
  .command('list <name>')
  .description('List all text records for a name')
  .action(async (name) => {
    try {
      const result = await api.profile(name);
      const records = result.textRecords || result.texts || {};
      const keys = Object.keys(records).filter(k => records[k]);

      if (out.isJsonMode()) return out.json(records);

      if (keys.length === 0) {
        out.warn(`No text records for "${name}"`);
        return;
      }

      out.heading(`Text Records — ${name}`);
      out.table(['Key', 'Value'], keys.map(k => [k, records[k]]));
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
