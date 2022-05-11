const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const assert = require("assert");

const totalSupply = ethers.utils.parseUnits("1000000000", "ether");
const initial = ethers.utils.parseUnits("1000000", "ether");
const rewardPerYear = ethers.utils.parseUnits("0.4", "ether");
const rewardPerMonth = ethers.utils.parseUnits("0.0284361557263612", "ether");
const rewardPerDay = ethers.utils.parseUnits("0.00092227", "ether");
const rewardPerHour = ethers.utils.parseUnits("0.00003841081034994", "ether");

let stakingRewardsFactory;
let stakingRewardsFactoryV2;
let hardhatStakingRewards;
let hardhatStakingRewardsV2;
let hardhatCrowdToken;
let hardhatCrowdDistribution;
let owner, account1;
let today = new Date();
today.setMonth(today.getMonth() - 3);
const start = Math.round(today.getTime() / 1000);

describe("StakingRewardsProxy", () => {
  beforeEach(async () => {
    [owner, account1] = await ethers.getSigners();

    /* ========== DEPLOY DISTRIBUTION CONTRACT ========== */
    const crowdDistributionFactory = await ethers.getContractFactory(
      "CrowdLinearDistribution"
    );
    hardhatCrowdDistribution = await crowdDistributionFactory.deploy();

    /* ========== DEPLOY TOKEN CONTRACT ========== */
    const crowdTokenFactory = await ethers.getContractFactory("CrowdToken");
    hardhatCrowdToken = await crowdTokenFactory.deploy(
      "CrowdToken",
      "CROWD",
      totalSupply,
      hardhatCrowdDistribution.address
    );

    /* ========== INITIALIZE DISTRIBUTION CONTRACT ========== */
    await hardhatCrowdDistribution.initialize(hardhatCrowdToken.address);

    /* ========== CREATE STAKING CONTRACTS FACTORY ========== */
    stakingRewardsFactory = await ethers.getContractFactory("StakingRewards");
    stakingRewardsFactoryV2 = await ethers.getContractFactory(
      "StakingRewardsV2Test"
    );

    /* ========== CREATE A BENEFICIARY AND RELEASE ========== */
    await hardhatCrowdDistribution.create(account1.address, start, 0, initial);
    await hardhatCrowdDistribution.release(account1.address);
  });

  it("has the same address before and after upgrading", async () => {
    hardhatStakingRewards = await upgrades.deployProxy(stakingRewardsFactory, [
      hardhatCrowdToken.address,
      rewardPerYear,
      rewardPerMonth,
      rewardPerDay,
      rewardPerHour,
    ]);

    hardhatStakingRewardsV2 = await upgrades.upgradeProxy(
      hardhatStakingRewards.address,
      stakingRewardsFactoryV2
    );
    assert.strictEqual(
      hardhatStakingRewards.address,
      hardhatStakingRewardsV2.address
    );
  });

  it("works before and after upgrading", async () => {
    hardhatStakingRewards = await upgrades.deployProxy(stakingRewardsFactory, [
      hardhatCrowdToken.address,
      rewardPerYear,
      rewardPerMonth,
      rewardPerDay,
      rewardPerHour,
    ]);
    assert.strictEqual(
      await hardhatStakingRewards.stakingToken(),
      hardhatCrowdToken.address
    );

    hardhatStakingRewardsV2 = await upgrades.upgradeProxy(
      hardhatStakingRewards.address,
      stakingRewardsFactoryV2
    );
    assert.strictEqual(
      await hardhatStakingRewardsV2.stakingToken(),
      hardhatCrowdToken.address
    );

    await hardhatStakingRewardsV2.incrementRewards();
    const newValue = await hardhatStakingRewardsV2.rewardPerYear();
    assert.strictEqual(newValue.toString(), "400000000000000001");
  });

  it("withdraw after upgrading", async () => {
    /* ======= DEPLOY StakingRewards CONTRACT ======= */
    hardhatStakingRewards = await upgrades.deployProxy(stakingRewardsFactory, [
      hardhatCrowdToken.address,
      rewardPerYear,
      rewardPerMonth,
      rewardPerDay,
      rewardPerHour,
    ]);

    /* ======= TRANSFER BALANCE TO STAKING CONTRACT TO PAY AS REWARDS ======= */
    await hardhatCrowdDistribution.create(
      hardhatStakingRewards.address,
      start,
      0,
      initial
    );
    await hardhatCrowdDistribution.release(hardhatStakingRewards.address);

    /* ======= STAKE ======= */
    let stakingAmount = ethers.utils.parseUnits("100", "ether");
    await hardhatCrowdToken
      .connect(account1)
      .approve(hardhatStakingRewards.address, stakingAmount);
    await hardhatStakingRewards.connect(account1).stake(stakingAmount);

    /* ======= AFTER 2 DAYS ======= */
    await moveTimeForward(172800);

    /* ======= UPDATE StakingRewards CONTRACT ======= */
    hardhatStakingRewardsV2 = await upgrades.upgradeProxy(
      hardhatStakingRewards.address,
      stakingRewardsFactoryV2
    );

    /* ======= GET BALANCE ======= */
    let expectedBalance = "100184539058195290000";
    let currentBalance = await hardhatStakingRewardsV2.getBalance(
      account1.address
    );
    assert.equal(currentBalance.toString(), expectedBalance);

    /* ======= WITHDRAW ======= */
    await expect(
      hardhatStakingRewardsV2.connect(account1).withdraw(expectedBalance)
    )
      .to.emit(hardhatStakingRewardsV2, "Withdrawn")
      .withArgs(account1.address, expectedBalance);
  });

  async function moveTimeForward(seconds) {
    let currentTimestamp = await ethers.provider.getBlock("latest");
    await ethers.provider.send("evm_mine", [
      currentTimestamp.timestamp + seconds,
    ]);
  }
});
