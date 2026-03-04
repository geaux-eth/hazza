const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');
const conf = require('../lib/config');
const payment = require('../lib/payment');

const cmd = new Command('register')
  .argument('<name>', 'Name to register')
  .option('-y, --years <n>', 'Number of years', '1')
  .option('-w, --wallet <address>', 'Owner wallet address')
  .description('Register a HAZZA name')
  .action(async (name, opts) => {
    try {
      const wallet = opts.wallet || conf.get('wallet');
      if (!wallet) {
        out.error('No wallet configured. Run: hazza config set wallet <address>');
        process.exit(1);
      }
      const years = parseInt(opts.years) || 1;

      // Check availability
      out.info(`Checking availability of "${name}"...`);
      const avail = await api.checkAvailable(name);
      if (!avail.available) {
        out.error(`"${name}" is not available`);
        if (avail.owner) out.info(`Owner: ${avail.owner}`);
        process.exit(1);
      }

      // Check free claim (first registration free for everyone, + Unlimited Pass bonus)
      out.info('Checking free claim eligibility...');
      const fc = await api.freeClaim(wallet).catch(() => null);
      const isFree = fc && fc.eligible;
      if (isFree) {
        if (fc.reason === 'first-registration') {
          out.success('First name is free — just pay gas!');
        } else {
          out.success('Unlimited Pass: free name claim! No payment required.');
        }
      }

      // Get price quote
      const quoteData = await api.quote(name, wallet, years).catch(() => null);
      if (quoteData && !isFree) {
        out.info(`Price: ${payment.formatUSDC(quoteData.totalCost || quoteData.price || 0)} USDC for ${years} year(s)`);
      }

      // Step 1: POST to /x402/register
      out.info('Submitting registration...');
      const regData = { name, owner: wallet, years };
      let result = await api.registerX402(regData);

      // Free claim or server-side registration succeeded
      if (result.registrationTx || result.tokenId) {
        out.success(`Registered "${name}"!`);
        if (out.isJsonMode()) return out.json(result);
        if (result.registrationTx) out.info(`Tx: ${result.registrationTx}`);
        out.info(`Profile: https://${name}.hazza.name`);
        return;
      }

      // 402 — payment required
      if (result.status === 402) {
        const accept = result.accepts?.[0];
        if (!accept) {
          out.error('Server returned 402 but no payment details');
          process.exit(1);
        }

        payment.requireCast();

        const amount = accept.maxAmountRequired;
        const payTo = accept.payTo;
        out.info(`Payment: ${payment.formatUSDC(amount)} USDC → ${payTo}`);

        // Transfer USDC
        const txHash = payment.transferUSDC(payTo, amount);
        out.success(`USDC sent: ${txHash}`);

        // Retry with payment header
        out.info('Confirming registration...');
        const paymentHeader = payment.makePaymentHeader(txHash, wallet);
        result = await api.registerX402(regData, paymentHeader);

        if (result.registrationTx || result.tokenId) {
          out.success(`Registered "${name}"!`);
          if (out.isJsonMode()) return out.json(result);
          if (result.registrationTx) out.info(`Tx: ${result.registrationTx}`);
          out.info(`Profile: https://${name}.hazza.name`);
        } else {
          out.error('Registration failed after payment');
          out.error(JSON.stringify(result));
          process.exit(1);
        }
      }
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
