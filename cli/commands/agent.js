const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');
const payment = require('../lib/payment');

const cmd = new Command('agent')
  .description('Manage ERC-8004 agent identity');

cmd.command('register <name>')
  .description('Register an ERC-8004 agent identity for a name (requires cast)')
  .option('--uri <uri>', 'Agent metadata URI (e.g., https://yourname.hazza.name)')
  .option('--wallet <address>', 'Agent wallet address (defaults to name owner)')
  .action(async (name, opts) => {
    try {
      payment.requireCast();
      const config = require('../lib/config');
      const wallet = payment.getWallet();
      const rpcUrl = payment.getRpcUrl();

      const agentURI = opts.uri || `https://${name}.hazza.name`;

      out.info(`Registering ${name} as ERC-8004 agent...`);

      // Step 1: Get registration data from API
      const regData = await api.post('/api/agent/register', {
        name,
        agentURI,
        agentWallet: opts.wallet || wallet,
      });

      if (regData.error) {
        out.error(regData.error);
        process.exit(1);
      }

      out.info(`Agent URI: ${agentURI}`);
      out.info(`8004 Registry: ${regData.erc8004Registry}`);

      // Step 2: Submit the 8004 register tx
      out.info('Submitting ERC-8004 registration...');
      const txResult = payment.cast(
        ['send', regData.registerTx.to, '--data', regData.registerTx.data, '--rpc-url', rpcUrl, '--json']
      );

      let txHash = txResult;
      try {
        const parsed = JSON.parse(txResult);
        txHash = parsed.transactionHash || parsed.hash || txResult;
      } catch { /* raw hash */ }

      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        throw new Error('Invalid transaction hash returned: ' + txHash);
      }

      out.info(`8004 register tx: ${txHash}`);

      // Step 3: Get the agentId from the receipt logs
      out.info('Reading agentId from receipt...');
      const receiptJson = payment.cast(
        ['receipt', txHash, '--rpc-url', rpcUrl, '--json']
      );

      let agentId = null;
      try {
        const receipt = JSON.parse(receiptJson);
        // Look for Transfer event from 8004 registry — topics[3] is the tokenId
        const erc8004Addr = regData.erc8004Registry.toLowerCase();
        for (const log of (receipt.logs || [])) {
          if (log.address && log.address.toLowerCase() === erc8004Addr) {
            if (log.topics && log.topics[3]) {
              agentId = BigInt(log.topics[3]).toString();
              break;
            }
          }
        }
      } catch (e) {
        out.warn('Could not parse receipt: ' + e.message);
      }

      if (!agentId) {
        out.warn('Could not extract agentId from receipt. Check the tx manually.');
        out.info(`Tx: https://basescan.org/tx/${txHash}`);
        return;
      }

      out.info(`Agent ID: #${agentId}`);

      // Step 4: Confirm with the API to set text records
      out.info('Linking agent to hazza name...');
      const confirmData = await api.post('/api/agent/confirm', {
        name,
        agentId,
        txHash,
        agentWallet: opts.wallet || wallet,
      });

      if (confirmData.error) {
        out.warn(`Agent registered (#${agentId}) but text record linking failed: ${confirmData.error}`);
        out.info('You can link manually: hazza set ' + name + ' agent.8004id ' + agentId);
        return;
      }

      out.success(`Agent registered! ${name} is ERC-8004 Agent #${agentId}`);
      out.info(`Profile: https://${name}.hazza.name`);
      out.info(`8004 Registry: ${regData.erc8004Registry}`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd.command('status <name>')
  .description('Check agent identity status for a name')
  .action(async (name) => {
    try {
      const profile = await api.get(`/api/profile/${name}`);

      if (out.isJsonMode()) {
        return out.json({
          name,
          agentId: profile.agentId,
          agentWallet: profile.agentWallet,
          erc8004: profile.erc8004 || null,
          texts: {
            'agent.8004id': profile.texts?.['agent.8004id'] || null,
            'agent.wallet': profile.texts?.['agent.wallet'] || null,
            'agent.uri': profile.texts?.['agent.uri'] || null,
            'agent.endpoint': profile.texts?.['agent.endpoint'] || null,
            'agent.model': profile.texts?.['agent.model'] || null,
            'agent.status': profile.texts?.['agent.status'] || null,
          },
        });
      }

      const agentId = profile.agentId;
      if (!agentId || agentId === '0') {
        out.warn(`${name} has no agent identity`);
        out.info('Register one: hazza agent register ' + name);
        return;
      }

      out.heading(`Agent Identity — ${name}`);
      out.info(`Agent ID: #${agentId}`);
      out.info(`Wallet: ${profile.agentWallet || '—'}`);
      if (profile.erc8004) {
        out.info(`8004 Owner: ${profile.erc8004.owner}`);
        out.info(`Verified: ${profile.erc8004.verified ? 'yes' : 'NO — 8004 token owner does not match name owner'}`);
        out.info(`Token URI: ${profile.erc8004.tokenURI}`);
      }
      if (profile.texts?.['agent.endpoint']) out.info(`Endpoint: ${profile.texts['agent.endpoint']}`);
      if (profile.texts?.['agent.model']) out.info(`Model: ${profile.texts['agent.model']}`);
      if (profile.texts?.['agent.status']) out.info(`Status: ${profile.texts['agent.status']}`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
