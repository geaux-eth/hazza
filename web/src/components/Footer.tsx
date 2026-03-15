export default function Footer() {
  return (
    <div className="footer-bar">
      <div className="footer">
        <p>Built on <a href="https://base.org">Base</a></p>
        <p>
          <span style={{ color: '#8a7d5a' }}>Powered by</span>{' '}
          <a href="https://x402.org">x402</a>
          <span style={{ color: '#8a7d5a' }}>,</span>{' '}
          <a href="https://xmtp.org">XMTP</a>{' '}
          <span style={{ color: '#8a7d5a' }}>and</span>{' '}
          <a href="https://netprotocol.app">Net Protocol</a>
        </p>
      </div>
    </div>
  );
}
