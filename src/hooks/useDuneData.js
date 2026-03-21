import walletData from '../data/walletData.json'

// Data is pre-fetched via Dune MCP and baked into walletData.json.
// No API key needed — loads instantly from the bundled static file.
export function useDuneData() {
  return { wallets: walletData, loading: false }
}
