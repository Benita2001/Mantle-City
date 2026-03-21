export const PROTOCOL_ADDRESSES = {
  '0x765cd3c8ab7f872b4ddcaeefd32714d5a13bcc65': { name: 'Agni Finance',    subtitle: 'DEX Protocol'  },
  '0x4515a45337f461a11ff0fe8abf3c606ae5dc00c9': { name: 'Merchant Moe',    subtitle: 'DEX Protocol'  },
  '0x25356aeca4210ef7553140edb9b8026089e49396': { name: 'Lendle Protocol', subtitle: 'Lending'       },
  '0x30ac02b4c99d140cde2a212ca807cbda35d4f6b5': { name: 'Lendle Pool',     subtitle: 'Lending Pool'  },
}

export function classifyWallet(wallet) {
  const addr    = (wallet.wallet_address || '').toLowerCase()
  if (PROTOCOL_ADDRESSES[addr]) return 'protocol'
  const volume  = wallet.total_volume_mnt || 0
  const txCount = wallet.tx_count         || 0
  if (volume   > 10000) return 'whale'
  if (txCount  >   500) return 'defi'
  if (txCount  >    50 && volume < 100) return 'nft'
  return 'regular'
}

export const WALLET_COLORS = {
  protocol: '#65B3AE',
  defi:     '#008F6A',
  nft:      '#a855f7',
  whale:    '#f59e0b',
  regular:  '#2d3748',
}

export const WALLET_LABELS = {
  protocol: 'Protocol Landmark',
  defi:     'DeFi Protocol',
  nft:      'NFT Wallet',
  whale:    'Whale Wallet',
  regular:  'Regular Wallet',
}

export function getProtocolInfo(address) {
  return PROTOCOL_ADDRESSES[(address || '').toLowerCase()] || null
}

export function formatAddress(addr) {
  if (!addr) return '—'
  const hex = addr.startsWith('0x') ? addr : '0x' + addr
  return hex.slice(0, 6) + '...' + hex.slice(-4)
}

export function formatVolume(vol) {
  if (vol == null) return '0 MNT'
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(2) + 'M MNT'
  if (vol >=     1_000) return (vol /     1_000).toFixed(1) + 'K MNT'
  return vol.toFixed(2) + ' MNT'
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString()
}
