import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Networks, Dexchanges } from "@crowdswap/constant";
import { ethers, upgrades } from "hardhat";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { network, config } = hre;

  if (
    ![Networks.POLYGON_MAINNET_NAME, Networks.POLYGON_MUMBAI_NAME].includes(
      network.name.toUpperCase()
    )
  ) {
    throw Error(
      `Deploying [stakingRewards] contracts on the given network ${network.name} is not supported`
    );
  }

  if (
      !Dexchanges.CrowdswapAggregator.networks[network.config.chainId].stakingContractAddress
  ) {
    throw Error('stakingContractAddress is missing.');
  }

  console.log("Start [StakingRewards] contract deployment");
  const stakingRewardsFactory = await ethers.getContractFactory(
    "StakingRewards"
  );
  const stakingRewardsProxy = await upgrades.upgradeProxy(
      Dexchanges.CrowdswapAggregator.networks[network.config.chainId].stakingContractAddress,
      stakingRewardsFactory
  );
  console.log("Finish [StakingRewards] contract deployment");

  const stakingRewardsImpl = await getImplementationAddress(
    ethers.provider,
    stakingRewardsProxy.address
  );
  console.log("stakingRewardsProxy", stakingRewardsProxy.address);
  console.log("stakingRewardsImpl", stakingRewardsImpl);

  try {
    console.log("Start [StakingRewards] contract verification");
    if (!config.etherscan || !config.etherscan[Networks.POLYGON_MAINNET]) {
      throw Error(
        `The Polygonscan api key does not exist in the configuration`
      );
    }
    config.etherscan.apiKey = config.etherscan[Networks.POLYGON_MAINNET].apiKey;
    await hre.run("verify:verify", {
      address: stakingRewardsImpl,
    });
    console.log("Finish [StakingRewards] contract verification");
  } catch (e) {
    console.log(e.message);
    throw e;
  }
};
export default func;
func.tags = ["UpgradeStakingOnPolygon"];
