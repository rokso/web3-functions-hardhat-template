import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Contract } from "@ethersproject/contracts";

const ESCROW_TOKEN_ABI = [
  "function canUnlock(uint256 tokenId_) external view returns (bool)",
  "function positions(uint256 tokenId_) external view returns(uint256 lockedAmount,uint256 boostedAmount,uint256 unlockTime)",
  "function kick(uint256 tokenId_) external",
];

const ESCROW_NFT_ABI = [
  "function nextTokenId() external view returns(uint256)",
];

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { userArgs, multiChainProvider } = context;

  const provider = multiChainProvider.default();
  // Read addresses from user args
  const escrowTokenAddress = userArgs.escrowToken as string;
  if (!escrowTokenAddress)
    return { canExec: false, message: `userArgs.escrowToken is not provided` };

  const escrowNftAddress = userArgs.escrowNft as string;
  if (!escrowNftAddress)
    return { canExec: false, message: `userArgs.escrowNft is not provided` };

  try {
    // Get nextTokenId from escrowNft
    const escrowNft = new Contract(escrowNftAddress, ESCROW_NFT_ABI, provider);
    const nextTokenId = await escrowNft.nextTokenId();

    const escrowToken = new Contract(
      escrowTokenAddress,
      ESCROW_TOKEN_ABI,
      provider
    );

    // loop through all position ids
    for (let i = 0; i < nextTokenId; i++) {
      const positions = await escrowToken.positions(i);
      // check whether position exist
      if (positions.unlockTime.gt(0)) {
        // check whether position is unlock and can be kicked.
        const canUnlock = await escrowToken.canUnlock(i);
        if (canUnlock) {
          console.log(`Position with id ${i} is unlocked and can be kicked.`);
          // Running entire loop can cause too many calls per trigger, hence it is better
          // to perform one kick() call each time Gelato trigger this function.
          console.log(`Calling kick() for id ${i}`);
          return {
            canExec: true,
            callData: [
              {
                to: escrowTokenAddress,
                data: escrowToken.interface.encodeFunctionData("kick", [i]),
              },
            ],
          };
        }
      }
    }
    return { canExec: false, message: "Done, No calls to kick()" };
  } catch (err) {
    return { canExec: false, message: `Rpc call failed with error ${err}` };
  }
});
