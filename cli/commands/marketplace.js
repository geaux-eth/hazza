const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');

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

cmd.command('sell <name> <price>')
  .description('List a name for sale (requires cast)')
  .option('--usdc', 'Price in USDC instead of ETH')
  .option('--duration <seconds>', 'Listing duration', '2592000')
  .action(async (name, price, opts) => {
    const currency = opts.usdc ? 'USDC' : 'ETH';
    out.info(`To list ${name} for ${price} ${currency}:`);
    out.info('1. Approve NFT to Seaport: cast send <registry> "setApprovalForAll(address,bool)" <seaport> true');
    out.info('2. Create and sign Seaport order (EIP-712)');
    out.info('3. Submit order to Bazaar contract');
    out.info(`\nFor now, use the web UI at hazza.name/marketplace?sell=${encodeURIComponent(name)}`);
  });

cmd.command('buy <orderHash>')
  .description('Buy a listing via x402 (requires cast)')
  .action(async (orderHash) => {
    out.info(`To buy listing ${orderHash}:`);
    out.info('1. Check listing currency (ETH or USDC)');
    out.info('2. For USDC: approve USDC to Seaport, then fulfillOrder');
    out.info('3. For ETH: fulfillOrder with value');
    out.info('\nFor now, use the web UI at hazza.name/marketplace');
  });

module.exports = cmd;
