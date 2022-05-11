const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const assert = require("assert");

const totalSupply = ethers.utils.parseUnits("1000000000", "ether");
const rewardPerYear = ethers.utils.parseUnits("0.4", "ether");
const rewardPerMonth = ethers.utils.parseUnits("0.0284361557263612", "ether");
const rewardPerDay = ethers.utils.parseUnits("0.00092227", "ether");
const rewardPerHour = ethers.utils.parseUnits("0.00003841081034994", "ether");

let hardhatCrowdToken;
let hardhatCrowdDistribution;
let hardhatStakingRewards;
let owner, account1, account2;

describe("StakingRewards", () => {
  beforeEach(async () => {
    [owner, account1, account2] = await ethers.getSigners();

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

    /* ========== DEPLOY STAKING CONTRACT ========== */
    const stakingRewardsFactory = await ethers.getContractFactory(
      "StakingRewards"
    );
    hardhatStakingRewards = await upgrades.deployProxy(stakingRewardsFactory, [
      hardhatCrowdToken.address,
      rewardPerYear,
      rewardPerMonth,
      rewardPerDay,
      rewardPerHour,
    ]);
    await hardhatStakingRewards.deployed();

    /* ========== CREATE TWO BENEFICIARIES AND RELEASE ========== */
    let today = new Date();
    today.setMonth(today.getMonth() - 3);
    let start = Math.round(today.getTime() / 1000);
    let initial = ethers.utils.parseUnits("1000000", "ether");
    await hardhatCrowdDistribution.create(account1.address, start, 0, initial);
    await hardhatCrowdDistribution.release(account1.address);
    await hardhatCrowdDistribution.create(account2.address, start, 0, initial);
    await hardhatCrowdDistribution.release(account2.address);

    /* ======= TRANSFER BALANCE TO STAKING CONTRACT TO PAY AS REWARDS ======= */
    await hardhatCrowdDistribution.create(
      hardhatStakingRewards.address,
      start,
      0,
      initial
    );
    await hardhatCrowdDistribution.release(hardhatStakingRewards.address);
  });

  describe("stake", () => {
    it("should stake", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount);
      await expect(hardhatStakingRewards.connect(account1).stake(stakingAmount))
        .to.emit(hardhatStakingRewards, "Staked")
        .withArgs(account1.address, stakingAmount);
    });

    it("cannot stake 0", async () => {
      await expect(hardhatStakingRewards.stake(0)).to.revertedWith(
        "StakingRewards: cannot stake 0"
      );
    });

    it("should increase stake amount and return balance", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(
          hardhatStakingRewards.address,
          stakingAmount.add(stakingAmount)
        );
      await hardhatStakingRewards.connect(account1).stake(stakingAmount);

      let currentBalance = await hardhatStakingRewards.getBalance(
        account1.address
      );
      assert.equal(currentBalance, stakingAmount.toString());

      //After 5 hours from the first StakeTime
      await moveTimeForward(18000);

      let expectedBalance = "100019206880621993764";
      currentBalance = await hardhatStakingRewards.getBalance(account1.address);
      assert.equal(currentBalance.toString(), expectedBalance);

      //After 7.5 hours from the first StakeTime
      await moveTimeForward(9000);

      await hardhatStakingRewards.connect(account1).stake(stakingAmount);

      expectedBalance = "200026890665763052554"; //100000000000000000000 + 100026890665763052554
      currentBalance = await hardhatStakingRewards.getBalance(account1.address);
      assert.equal(currentBalance.toString(), expectedBalance);

      //After 2 hours from the second StakeTime
      await moveTimeForward(7200);

      expectedBalance = "200042257350805298746";
      currentBalance = await hardhatStakingRewards.getBalance(account1.address);
      assert.equal(currentBalance.toString(), expectedBalance);
    });
  });

  describe("setRewards", () => {
    it("should set rewards", async () => {
      let currentRewardPerHour = await hardhatStakingRewards.rewardPerHour();
      assert.equal(currentRewardPerHour.toString(), rewardPerHour.toString());

      let currentRewardPerDay = await hardhatStakingRewards.rewardPerDay();
      assert.equal(currentRewardPerDay.toString(), rewardPerDay.toString());

      let currentRewardPerMonth = await hardhatStakingRewards.rewardPerMonth();
      assert.equal(currentRewardPerMonth.toString(), rewardPerMonth.toString());

      let currentRewardPerYear = await hardhatStakingRewards.rewardPerYear();
      assert.equal(currentRewardPerYear.toString(), rewardPerYear.toString());

      let newRewardPerYear = ethers.utils.parseUnits("0.3", "ether");
      let newRewardPerMonth = ethers.utils.parseUnits(
        "0.0221044505936158",
        "ether"
      );
      let newRewardPerDay = ethers.utils.parseUnits("0.000719", "ether");
      let newRewardPerHour = ethers.utils.parseUnits(
        "0.00002995070701432",
        "ether"
      );

      await expect(
        hardhatStakingRewards.setRewards(
          newRewardPerYear,
          newRewardPerMonth,
          newRewardPerDay,
          newRewardPerHour
        )
      )
        .to.emit(hardhatStakingRewards, "RewardsSet")
        .withArgs(
          newRewardPerYear,
          newRewardPerMonth,
          newRewardPerDay,
          newRewardPerHour
        );

      currentRewardPerHour = await hardhatStakingRewards.rewardPerHour();
      assert.equal(
        currentRewardPerHour.toString(),
        newRewardPerHour.toString()
      );

      currentRewardPerDay = await hardhatStakingRewards.rewardPerDay();
      assert.equal(currentRewardPerDay.toString(), newRewardPerDay.toString());

      currentRewardPerMonth = await hardhatStakingRewards.rewardPerMonth();
      assert.equal(
        currentRewardPerMonth.toString(),
        newRewardPerMonth.toString()
      );

      currentRewardPerYear = await hardhatStakingRewards.rewardPerYear();
      assert.equal(
        currentRewardPerYear.toString(),
        newRewardPerYear.toString()
      );
    });

    it("should fail to set rewards using none owner address", async () => {
      let newReward = 100;
      await expect(
        hardhatStakingRewards
          .connect(account1)
          .setRewards(newReward, newReward, newReward, newReward)
      ).to.revertedWith("ce30");
    });

    it("should calculate stakeholders rewards before setting rewards to 30%", async () => {
      let stakingAmount1 = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount1);
      await hardhatStakingRewards.connect(account1).stake(stakingAmount1);

      let stakingAmount2 = ethers.utils.parseUnits("200", "ether");
      await hardhatCrowdToken
        .connect(account2)
        .approve(hardhatStakingRewards.address, stakingAmount2);
      await hardhatStakingRewards.connect(account2).stake(stakingAmount2);

      //After 3 months
      await moveTimeForward(7776000); //90*24*60*60

      let newRewardPerYear = ethers.utils.parseUnits("0.3", "ether");
      let newRewardPerMonth = ethers.utils.parseUnits(
        "0.0221044505936158",
        "ether"
      );
      let newRewardPerDay = ethers.utils.parseUnits("0.000719", "ether");
      let newRewardPerHour = ethers.utils.parseUnits(
        "0.00002995070701432",
        "ether"
      );

      await hardhatStakingRewards.setRewards(
        newRewardPerYear,
        newRewardPerMonth,
        newRewardPerDay,
        newRewardPerHour
      );

      let currentBalance1 = await hardhatStakingRewards.getBalance(
        account1.address
      );
      let expectedBalance1 = "108775730593727697429";
      assert.equal(currentBalance1.toString(), expectedBalance1);

      let currentBalance2 = await hardhatStakingRewards.getBalance(
        account2.address
      );
      let expectedBalance2 = "217551461187455394860";
      assert.equal(currentBalance2.toString(), expectedBalance2);

      //After 1 hour from setting new rewards
      await moveTimeForward(3600);

      expectedBalance1 = "108778988503764978771";
      currentBalance1 = await hardhatStakingRewards.getBalance(
        account1.address
      );
      assert.equal(currentBalance1.toString(), expectedBalance1);

      expectedBalance2 = "217557977007529957545";
      currentBalance2 = await hardhatStakingRewards.getBalance(
        account2.address
      );
      assert.equal(currentBalance2.toString(), expectedBalance2);
    });
  });

  describe("getBalance", () => {
    it("should return correct balance at different times", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount);
      await hardhatStakingRewards.connect(account1).stake(stakingAmount);

      let currentBalance = await hardhatStakingRewards.getBalance(
        account1.address
      );
      assert.equal(currentBalance, stakingAmount.toString());

      //After 1 hour from StakeTime
      await moveTimeForward(3600);
      let expectedBalance = "100003841081034994000";
      currentBalance = await hardhatStakingRewards.getBalance(account1.address);
      assert.equal(currentBalance.toString(), expectedBalance);

      //After 6 hours from StakeTime
      await moveTimeForward(18000);
      expectedBalance = "100023048699408836749";
      currentBalance = await hardhatStakingRewards.getBalance(account1.address);
      assert.equal(currentBalance.toString(), expectedBalance);

      //After 12 hours from StakeTime
      await moveTimeForward(21600);
      expectedBalance = "100046102711243117886";
      currentBalance = await hardhatStakingRewards.getBalance(account1.address);
      assert.equal(currentBalance.toString(), expectedBalance);

      //After 20 hours from StakeTime
      await moveTimeForward(28800);
      expectedBalance = "100076849659578104855";
      currentBalance = await hardhatStakingRewards.getBalance(account1.address);
      assert.equal(currentBalance.toString(), expectedBalance);

      //After 24 hours from StakeTime
      await moveTimeForward(14400);
      expectedBalance = "100092227000000000000";
      currentBalance = await hardhatStakingRewards.getBalance(account1.address);
      assert.equal(currentBalance.toString(), expectedBalance);

      //After 1 year from StakeTime
      await moveTimeForward(31449600);
      expectedBalance = "140000000000000000000";
      currentBalance = await hardhatStakingRewards.getBalance(account1.address);
      assert.equal(currentBalance.toString(), expectedBalance);
    });

    it("should fail when address is zero", async () => {
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      await expect(
        hardhatStakingRewards.getBalance(zeroAddress)
      ).to.revertedWith("StakingRewards: address is not valid");
    });

    it("should fail when stakeholder does not exist", async () => {
      await expect(
        hardhatStakingRewards.getBalance(account1.address)
      ).to.revertedWith("StakingRewards: stakeholder does not exist");
    });
  });

  describe("getReward", () => {
    it("should return correct reward at different times", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount);
      await hardhatStakingRewards.connect(account1).stake(stakingAmount);

      let currentReward = await hardhatStakingRewards.getReward(
        account1.address
      );
      assert.equal(currentReward, 0);

      //After 2 hours from StakeTime
      await moveTimeForward(7200);
      let expectedReward = "7682309609023173";
      currentReward = await hardhatStakingRewards.getReward(account1.address);
      assert.equal(currentReward.toString(), expectedReward);

      //After 9 hours from StakeTime
      await moveTimeForward(25200);
      expectedReward = "34575041196275572";
      currentReward = await hardhatStakingRewards.getReward(account1.address);
      assert.equal(currentReward.toString(), expectedReward);

      //After 16 hours from StakeTime
      await moveTimeForward(25200);
      expectedReward = "61475004418093653";
      currentReward = await hardhatStakingRewards.getReward(account1.address);
      assert.equal(currentReward.toString(), expectedReward);

      //After 2 days from StakeTime
      await moveTimeForward(115200);
      expectedReward = "184539058195290000";
      currentReward = await hardhatStakingRewards.getReward(account1.address);
      assert.equal(currentReward.toString(), expectedReward);

      //After 3 months from StakeTime (90*24*60*60)
      await moveTimeForward(7603200);
      expectedReward = "8775730593727697429";
      currentReward = await hardhatStakingRewards.getReward(account1.address);
      assert.equal(currentReward.toString(), expectedReward);

      //After 1 year from StakeTime
      await moveTimeForward(23760000);
      expectedReward = "40000000000000000000";
      currentReward = await hardhatStakingRewards.getReward(account1.address);
      assert.equal(currentReward.toString(), expectedReward);
    });

    it("should fail when address is zero", async () => {
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      await expect(
        hardhatStakingRewards.getReward(zeroAddress)
      ).to.revertedWith("StakingRewards: address is not valid");
    });

    it("should fail when stakeholder does not exist", async () => {
      await expect(
        hardhatStakingRewards.getReward(account1.address)
      ).to.revertedWith("StakingRewards: stakeholder does not exist");
    });
  });

  describe("getStakeTime", () => {
    it("should return correct stakeTime", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount);
      const currentTime = Math.round(new Date().getTime() / 1000);
      await hardhatStakingRewards.connect(account1).stake(stakingAmount);
      const stakeTime = await hardhatStakingRewards.getStakeTime(
        account1.address
      );
      expect(stakeTime).to.be.gt(currentTime);
    });

    it("should fail when address is zero", async () => {
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      await expect(
        hardhatStakingRewards.getStakeTime(zeroAddress)
      ).to.revertedWith("StakingRewards: address is not valid");
    });

    it("should fail when stakeholder does not exist", async () => {
      await expect(
        hardhatStakingRewards.getStakeTime(account1.address)
      ).to.revertedWith("StakingRewards: stakeholder does not exist");
    });
  });

  describe("withdraw", () => {
    it("should withdraw", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount);
      await hardhatStakingRewards.connect(account1).stake(stakingAmount);

      await expect(
        hardhatStakingRewards.connect(account1).withdraw(stakingAmount)
      )
        .to.emit(hardhatStakingRewards, "Withdrawn")
        .withArgs(account1.address, stakingAmount);
    });

    it("cannot withdraw 0", async () => {
      await expect(hardhatStakingRewards.withdraw(0)).to.revertedWith(
        "StakingRewards: cannot withdraw 0"
      );
    });

    it("withdraw and delete stakeholder", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount);
      await hardhatStakingRewards.connect(account1).stake(stakingAmount);

      //After 2 days
      await moveTimeForward(172800);
      let expectedBalance = "100184539058195290000";
      let currentBalance = await hardhatStakingRewards.getBalance(
        account1.address
      );
      assert.equal(currentBalance.toString(), expectedBalance);

      await hardhatStakingRewards.connect(account1).withdraw(expectedBalance);

      await expect(
        hardhatStakingRewards.getBalance(account1.address)
      ).to.revertedWith("StakingRewards: stakeholder does not exist");
    });

    it("should fail when withdraw amount is bigger than balance", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount);
      await hardhatStakingRewards.connect(account1).stake(stakingAmount);

      await expect(
        hardhatStakingRewards
          .connect(account1)
          .withdraw(stakingAmount.add(stakingAmount))
      ).to.revertedWith("StakingRewards: not enough balance");
    });

    it("withdraw after 1 year", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount);
      await hardhatStakingRewards.connect(account1).stake(stakingAmount);

      await moveTimeForward(31536000); //365*24*60*60

      let expectedBalance = "140000000000000000000";
      let currentBalance = await hardhatStakingRewards.getBalance(
        account1.address
      );
      assert.equal(currentBalance.toString(), expectedBalance);

      await expect(
        hardhatStakingRewards.connect(account1).withdraw(currentBalance)
      )
        .to.emit(hardhatStakingRewards, "Withdrawn")
        .withArgs(account1.address, currentBalance);
    });

    it("withdraw after 2 months", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount);
      await hardhatStakingRewards.connect(account1).stake(stakingAmount);

      await moveTimeForward(5184000); //60*24*60*60

      let expectedBalance = "105768092640521626486";
      let currentBalance = await hardhatStakingRewards.getBalance(
        account1.address
      );
      assert.equal(currentBalance.toString(), expectedBalance);

      await expect(
        hardhatStakingRewards.connect(account1).withdraw(currentBalance)
      )
        .to.emit(hardhatStakingRewards, "Withdrawn")
        .withArgs(account1.address, currentBalance);
    });

    it("withdraw after 3 days", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount);
      await hardhatStakingRewards.connect(account1).stake(stakingAmount);

      await moveTimeForward(259200); //3*24*60*60

      let expectedBalance = "100276936253032491770";
      let currentBalance = await hardhatStakingRewards.getBalance(
        account1.address
      );
      assert.equal(currentBalance.toString(), expectedBalance);

      await expect(
        hardhatStakingRewards.connect(account1).withdraw(currentBalance)
      )
        .to.emit(hardhatStakingRewards, "Withdrawn")
        .withArgs(account1.address, currentBalance);
    });

    it("withdraw after 4 hours", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount);
      await hardhatStakingRewards.connect(account1).stake(stakingAmount);

      await moveTimeForward(14400); //4*60*60

      let expectedBalance = "100015365209396855635";
      let currentBalance = await hardhatStakingRewards.getBalance(
        account1.address
      );
      assert.equal(currentBalance.toString(), expectedBalance);

      await expect(
        hardhatStakingRewards.connect(account1).withdraw(currentBalance)
      )
        .to.emit(hardhatStakingRewards, "Withdrawn")
        .withArgs(account1.address, currentBalance);
    });

    it("withdraw after 1 year, 2 months, 3 days and 4 hours", async () => {
      let stakingAmount = ethers.utils.parseUnits("100", "ether");
      await hardhatCrowdToken
        .connect(account1)
        .approve(hardhatStakingRewards.address, stakingAmount);
      await hardhatStakingRewards.connect(account1).stake(stakingAmount);

      await moveTimeForward(36993600); //31536000+5184000+259200+14400

      let expectedBalance = "148508219059701123710";
      let currentBalance = await hardhatStakingRewards.getBalance(
        account1.address
      );
      assert.equal(currentBalance.toString(), expectedBalance);

      await expect(
        hardhatStakingRewards.connect(account1).withdraw(currentBalance)
      )
        .to.emit(hardhatStakingRewards, "Withdrawn")
        .withArgs(account1.address, currentBalance);
    });
  });

  async function moveTimeForward(seconds) {
    let currentTimestamp = await ethers.provider.getBlock("latest");
    await ethers.provider.send("evm_mine", [
      currentTimestamp.timestamp + seconds,
    ]);
  }
});
