import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@rainbow-me/rainbowkit/styles.css';
import './index.css';
import App from './App';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config, queryClient } from './config/wagmi';
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <RainbowKitProvider>
            <App />
          </RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
