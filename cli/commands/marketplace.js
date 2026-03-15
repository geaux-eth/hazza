const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');
const payment = require('../lib/payment');

function ethToWei(eth) {
  if (eth === '' || eth === undefined || eth === null) {
    throw new Error('Price cannot be empty');
  }
  const str = String(eth).trim();
  if (str === '') {
    throw new Error('Price cannot be empty');
  }
  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid price "${str}" — must be a numeric value`);
  }
  if (str.startsWith('-')) {
    throw new Error('Price cannot be negative');
  }
  const [whole, frac = ''] = str.split('.');
  const padded = (frac + '000000000000000000').slice(0, 18);
  return BigInt(whole || '0') * BigInt('1000000000000000000') + BigInt(padded);
}

const cmd = new Command('market')
  .description('Browse and interact with the hazza marketplace');

cmd.command('listings')
  .alias('ls')
  .description('Browse active marketplace listings')
  .action(async () => {
    try {
      const result = await api.marketListings();
      const listings = result.listings || [];

      if (out.isJsonMode()) return out.json(listings);

      if (listings.length === 0) {
        out.warn('No active listings. List a name at hazza.name/marketplace');
        return;
      }

      out.heading(`Marketplace — ${listings.length} listing${listings.length === 1 ? '' : 's'}`);
      out.table(
        ['Name', 'Price', 'Currency', 'Seller', 'Expires'],
        listings.map(l => [
          l.name,
          String(l.price),
          l.currency,
          l.seller ? l.seller.slice(0, 6) + '...' + l.seller.slice(-4) : '—',
          l.listingExpiry ? new Date(l.listingExpiry * 1000).toLocaleDateString() : '—',
        ]),
      );
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd.command('offers')
  .description('View active collection offers')
  .action(async () => {
    try {
      const result = await api.marketOffers();
      const offers = result.offers || [];

      if (out.isJsonMode()) return out.json(offers);

      if (offers.length === 0) {
        out.warn('No active offers');
        return;
      }

      out.heading(`Collection Offers — ${offers.length}`);
      out.table(
        ['Offerer', 'Price', 'Currency', 'Expires'],
        offers.map(o => [
          o.offerer ? o.offerer.slice(0, 6) + '...' + o.offerer.slice(-4) : '—',
          String(o.price),
          o.currency || 'ETH',
          o.expirationDate ? new Date(o.expirationDate * 1000).toLocaleDateString() : '—',
        ]),
      );
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd.command('sales')
  .description('View recent sales')
  .action(async () => {
    try {
      const result = await api.marketSales();
      const sales = result.sales || [];

      if (out.isJsonMode()) return out.json(sales);

      if (sales.length === 0) {
        out.warn('No sales recorded yet');
        return;
      }

      out.heading(`Recent Sales — ${sales.length}`);
      out.table(
        ['Name', 'Price', 'Currency', 'Buyer', 'Seller', 'Date'],
        sales.map(s => [
          s.name || `Token #${s.tokenId}`,
          String(s.price),
          s.currency,
          s.buyer ? s.buyer.slice(0, 6) + '...' + s.buyer.slice(-4) : '—',
          s.seller ? s.seller.slice(0, 6) + '...' + s.seller.slice(-4) : '—',
          s.timestamp ? new Date(s.timestamp * 1000).toLocaleDateString() : '—',
        ]),
      );
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd.command('buy <orderHash>')
  .description('Buy a listing (requires cast + configured wallet)')
  .action(async (orderHash) => {
    try {
      payment.requireCast();
      const wallet = payment.getWallet();
      const rpcUrl = payment.getRpcUrl();

      out.info(`Preparing purchase for listing ${orderHash.slice(0, 10)}...`);

      // Get fulfillment data from worker
      const fulfillData = await api.post('/api/marketplace/fulfill', {
        orderHash,
        buyerAddress: wallet,
      });

      if (fulfillData.error) {
        out.error(fulfillData.error);
        process.exit(1);
      }

      // Handle approvals first
      if (fulfillData.approvals && fulfillData.approvals.length > 0) {
        for (const approval of fulfillData.approvals) {
          if (approval.amount && approval.amount !== '0') {
            out.info(`Approving token ${approval.to.slice(0, 10)}...`);
            payment.cast(
              ['send', approval.to, '--data', approval.data, '--rpc-url', rpcUrl, '--json']
            );
            out.success('Approval sent');
          }
        }
      }

      // Execute fulfillment
      const value = fulfillData.fulfillment.value || '0';
      out.info('Fulfilling order...');
      const castArgs = ['send', fulfillData.fulfillment.to, '--data', fulfillData.fulfillment.data];
      if (value !== '0') castArgs.push('--value', value);
      castArgs.push('--rpc-url', rpcUrl, '--json');
      const txResult = payment.cast(castArgs);

      let txHash = txResult;
      try {
        const parsed = JSON.parse(txResult);
        txHash = parsed.transactionHash || parsed.hash || txResult;
      } catch { /* raw hash */ }

      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        throw new Error('Invalid transaction hash returned: ' + txHash);
      }

      out.success(`Purchase complete!`);
      out.info(`Tx: ${txHash}`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd.command('sell <name> <price>')
  .description('List a name for sale (requires cast + configured wallet)')
  .option('--duration <seconds>', 'Listing duration in seconds (0 = no expiry)', '0')
  .action(async (name, price, opts) => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    try {
      payment.requireCast();
      const wallet = payment.getWallet();
      const rpcUrl = payment.getRpcUrl();
      const config = require('../lib/config');
      const registryAddress = config.get('registryAddress');
      const seaportAddress = '0x0000000000000068F116a894984e2DB1123eB395';
      const bazaarAddress = '0x000000058f3ade587388daf827174d0e6fc97595';
      const TREASURY_ADDRESS = config.get('treasuryAddress') || '0x62B7399B2ac7e938Efad06EF8746fDBA3B351900';
      const treasury = TREASURY_ADDRESS;
      const zonePublic = '0x000000007F8c58fbf215bF91Bda7421A806cf3ae';
      const zeroAddr = '0x0000000000000000000000000000000000000000';
      const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

      out.info(`Listing ${name} for ${price} ETH...`);

      // Step 1: Check & set NFT approval for Seaport
      out.info('Checking NFT approval...');
      const isApproved = payment.contractCall(
        registryAddress,
        'isApprovedForAll(address,address)(bool)',
        [wallet, seaportAddress],
        rpcUrl,
      );

      if (isApproved.trim() === 'false') {
        out.info('Approving NFT to Seaport...');
        payment.contractSend(
          registryAddress,
          'setApprovalForAll(address,bool)',
          [seaportAddress, 'true'],
          rpcUrl,
        );
        out.success('NFT approved');
      }

      // Step 2: Get counter
      const counterHex = payment.contractCall(
        seaportAddress,
        'getCounter(address)(uint256)',
        [wallet],
        rpcUrl,
      );
      const counter = BigInt(counterHex.trim());

      // Step 3: Resolve tokenId
      out.info('Resolving name...');
      const resolveResult = await api.get(`/api/resolve/${name}`);
      if (!resolveResult.tokenId) {
        out.error(`Could not resolve ${name} — is it registered?`);
        process.exit(1);
      }
      const tokenId = BigInt(resolveResult.tokenId);

      // Step 4: Build order
      const priceWei = ethToWei(price);
      const feeBps = 200n; // 2%
      const feeAmount = (priceWei * feeBps) / 10000n;
      const sellerAmount = priceWei - feeAmount;
      const duration = parseInt(opts.duration);
      const endTime = duration === 0
        ? BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
        : BigInt(Math.floor(Date.now() / 1000) + duration);
      const saltBytes = require('crypto').randomBytes(32);
      const saltHex = '0x' + saltBytes.toString('hex');
      const salt = BigInt(saltHex);

      // Format fee using BigInt — feeAmount is in wei, convert to readable string
      const feeWhole = feeAmount / BigInt('1000000000000000000');
      const feeRemainder = feeAmount % BigInt('1000000000000000000');
      const feeDecimal = feeRemainder.toString().padStart(18, '0').slice(0, 6);
      const feeDisplay = `${feeWhole}.${feeDecimal}`;
      out.info(`Listing: ${name} for ${price} ETH (2% fee = ${feeDisplay} ETH)`);
      out.info(`Duration: ${duration === 0 ? 'no expiry' : `${duration}s`}`);

      // Step 5: Build EIP-712 typed data and sign with cast
      const consideration = [
        {
          itemType: '0',
          token: zeroAddr,
          identifierOrCriteria: '0',
          startAmount: sellerAmount.toString(),
          endAmount: sellerAmount.toString(),
          recipient: wallet,
        },
      ];
      if (feeAmount > 0n) {
        consideration.push({
          itemType: '0',
          token: zeroAddr,
          identifierOrCriteria: '0',
          startAmount: feeAmount.toString(),
          endAmount: feeAmount.toString(),
          recipient: treasury,
        });
      }

      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          OrderComponents: [
            { name: 'offerer', type: 'address' },
            { name: 'zone', type: 'address' },
            { name: 'offer', type: 'OfferItem[]' },
            { name: 'consideration', type: 'ConsiderationItem[]' },
            { name: 'orderType', type: 'uint8' },
            { name: 'startTime', type: 'uint256' },
            { name: 'endTime', type: 'uint256' },
            { name: 'zoneHash', type: 'bytes32' },
            { name: 'salt', type: 'uint256' },
            { name: 'conduitKey', type: 'bytes32' },
            { name: 'counter', type: 'uint256' },
          ],
          OfferItem: [
            { name: 'itemType', type: 'uint8' },
            { name: 'token', type: 'address' },
            { name: 'identifierOrCriteria', type: 'uint256' },
            { name: 'startAmount', type: 'uint256' },
            { name: 'endAmount', type: 'uint256' },
          ],
          ConsiderationItem: [
            { name: 'itemType', type: 'uint8' },
            { name: 'token', type: 'address' },
            { name: 'identifierOrCriteria', type: 'uint256' },
            { name: 'startAmount', type: 'uint256' },
            { name: 'endAmount', type: 'uint256' },
            { name: 'recipient', type: 'address' },
          ],
        },
        primaryType: 'OrderComponents',
        domain: {
          name: 'Seaport',
          version: '1.6',
          chainId: config.get('chainId') || '8453',
          verifyingContract: seaportAddress,
        },
        message: {
          offerer: wallet,
          zone: zonePublic,
          offer: [{
            itemType: '2',
            token: registryAddress,
            identifierOrCriteria: tokenId.toString(),
            startAmount: '1',
            endAmount: '1',
          }],
          consideration,
          orderType: '2',
          startTime: '0',
          endTime: endTime.toString(),
          zoneHash: zeroBytes32,
          salt: salt.toString(),
          conduitKey: zeroBytes32,
          counter: counter.toString(),
        },
      };

      const tmpFile = path.join(os.tmpdir(), `hazza-order-${Date.now()}.json`);
      fs.writeFileSync(tmpFile, JSON.stringify(typedData, null, 2), { mode: 0o600 });

      try {
        out.info('Signing Seaport order (EIP-712)...');
        const signature = payment.cast(['wallet', 'sign', '--data', '--from-file', tmpFile]);
        const sig = signature.trim();

        // Step 6: Submit to Bazaar on-chain
        out.info('Submitting listing to Bazaar...');

        // Build consideration args for cast
        let considStr = `(0,${zeroAddr},0,${sellerAmount},${sellerAmount},${wallet})`;
        if (feeAmount > 0n) {
          considStr += `,(0,${zeroAddr},0,${feeAmount},${feeAmount},${treasury})`;
        }

        const submitSig = 'submit(((address,address,(uint8,address,uint256,uint256,uint256)[],(uint8,address,uint256,uint256,uint256,address)[],uint8,uint256,uint256,bytes32,uint256,bytes32,uint256),uint256,bytes))';
        const submitArg = `((${wallet},${zonePublic},[(2,${registryAddress},${tokenId},1,1)],[${considStr}],2,0,${endTime},${zeroBytes32},${salt},${zeroBytes32},${consideration.length}),${counter},${sig})`;

        const txResult = payment.cast(
          ['send', bazaarAddress, submitSig, submitArg, '--rpc-url', rpcUrl, '--json']
        );

        let txHash = txResult;
        try {
          const parsed = JSON.parse(txResult);
          txHash = parsed.transactionHash || parsed.hash || txResult;
        } catch { /* raw hash */ }

        if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
          throw new Error('Invalid transaction hash returned: ' + txHash);
        }

        out.success(`Listed! ${name}.hazza.name is now for sale at ${price} ETH (2% fee)`);
        out.info(`Tx: ${txHash}`);
        out.info(`View at: hazza.name/marketplace`);
      } finally {
        // Always clean up temp file
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd.command('contact <name>')
  .description('Get contact info for a listing seller')
  .action(async (name) => {
    try {
      const result = await api.contact(name);
      if (out.isJsonMode()) return out.json(result);

      if (result.contactAddress) {
        out.success(`XMTP: ${result.contactAddress}`);
        if (result.xmtpUrl) out.info(`Chat: ${result.xmtpUrl}`);
        if (result.isDelegated) {
          out.info(`Delegated to: ${result.contactName || result.delegateXmtp}`);
          out.info(`Mode: ${result.mode}`);
        }
      } else {
        out.warn(`${name} has no XMTP address set.`);
      }
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd.command('board')
  .description('Read forum / message board posts')
  .action(async () => {
    try {
      const result = await api.get('/api/board');
      const messages = result.messages || [];

      if (out.isJsonMode()) return out.json(messages);

      if (messages.length === 0) {
        out.warn('No forum posts yet. Be the first: hazza market board-post "your message"');
        return;
      }

      out.heading(`Forum — ${messages.length} post${messages.length === 1 ? '' : 's'}`);
      messages.slice(-20).forEach(m => {
        const author = m.authorName || (m.author ? m.author.slice(0, 6) + '...' + m.author.slice(-4) : '?');
        const time = m.timestamp ? new Date(m.timestamp).toLocaleString() : '';
        out.info(`[${author}] ${m.text}  ${time ? '(' + time + ')' : ''}`);
      });
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd.command('board-post <message>')
  .description('Post a message to the forum (requires cast)')
  .action(async (message) => {
    try {
      payment.requireCast();
      const wallet = payment.getWallet();

      out.info('Signing forum post...');
      const sigMessage = 'hazza board post: ' + message.trim();
      const signature = payment.cast(['wallet', 'sign', '--no-hash', sigMessage]);

      out.info('Posting...');
      const result = await api.post('/api/board', {
        text: message.trim(),
        author: wallet,
        signature: signature.trim(),
      });

      if (result.error) {
        out.error(result.error);
        process.exit(1);
      }

      out.success('Posted to the hazza forum!');
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd.command('bounty <name>')
  .description('Check if a name has an active agent bounty')
  .action(async (name) => {
    try {
      // Resolve name to tokenId first
      const resolved = await api.get(`/api/resolve/${name}`);
      if (!resolved.tokenId) {
        out.error(`${name} is not registered`);
        process.exit(1);
      }

      const result = await api.get(`/api/bounty/${resolved.tokenId}`);
      if (out.isJsonMode()) return out.json(result);

      if (!result.active) {
        out.info(`No active bounty for ${name}`);
        if (result.message) out.warn(result.message);
        return;
      }

      out.heading(`Agent Bounty — ${name}`);
      out.info(`Amount: ${result.amount} ETH`);
      out.info(`Agent: ${result.agent || 'open (any agent)'}`);
      out.info(`Seller: ${result.seller}`);
      if (result.expiresAt > 0) {
        out.info(`Expires: ${new Date(result.expiresAt * 1000).toLocaleString()}`);
      } else {
        out.info('Expires: never');
      }
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
