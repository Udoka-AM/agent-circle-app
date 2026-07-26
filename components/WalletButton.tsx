"use client";

import dynamic from "next/dynamic";

function WalletButtonFallback() {
  return (
    <button type="button" className="btn-accent h-[38px] min-w-[132px] px-4 text-xs" disabled>
      Connect wallet
    </button>
  );
}

export const WalletButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  {
    ssr: false,
    loading: () => <WalletButtonFallback />,
  }
);
