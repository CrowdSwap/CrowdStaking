// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./DateTimeUtil.sol";
import "./OwnableUpgradeable.sol";

/**
 * @title StakingRewards for the CrowdToken
 * @notice Staking mechanism and rewards calculation
 */
contract StakingRewards is Initializable, UUPSUpgradeable, OwnableUpgradeable {

    using SafeERC20Upgradeable for IERC20Upgradeable;
    IERC20Upgradeable public stakingToken;

    struct Stakeholder {
        uint256 balance;
        uint256 stakeTime;
        bool exist;
    }

    mapping(address => Stakeholder) public stakeholders;
    address[] public addresses;
    uint256 public rewardPerYear;
    uint256 public rewardPerMonth;
    uint256 public rewardPerDay;
    uint256 public rewardPerHour;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardsSet(uint256 _rewardPerYear, uint256 _rewardPerMonth, uint256 _rewardPerDay, uint256 _rewardPerHour);

    /**
     * @dev The contract constructor
     * @param _stakingToken The address of the staking token
     * @param _rewardPerYear The initial reward rate per year
     * @param _rewardPerMonth The initial reward rate per month
     * @param _rewardPerDay The initial reward rate per day
     * @param _rewardPerHour The initial reward rate per hour
     */
    function initialize(
        address _stakingToken,
        uint256 _rewardPerYear,
        uint256 _rewardPerMonth,
        uint256 _rewardPerDay,
        uint256 _rewardPerHour
    ) public initializer {
        OwnableUpgradeable.initialize();
        stakingToken = IERC20Upgradeable(_stakingToken);
        rewardPerYear = _rewardPerYear;
        rewardPerMonth = _rewardPerMonth;
        rewardPerDay = _rewardPerDay;
        rewardPerHour = _rewardPerHour;
    }

    /**
     * @dev If the stakeholder has already staked some tokens and wants to
     * stake more, this process is not fully fair. For example: a stakeholder
     * stakes at 1 pm, then he stakes again at 2:50 pm. The reward of one hour
     * is calculated and added to the stakeholder's balance, but the remaining
     * 50 minutes are not considered. The stakeholder should be informed when
     * calling the contract.
     * @param _amount The amount of the token to be staked
     */
    function stake(uint256 _amount) external {
        require(_amount > 0, "StakingRewards: cannot stake 0");

        if (stakeholders[msg.sender].exist) {
            uint256 currentBalance = getBalance(msg.sender);
            stakeholders[msg.sender].balance = currentBalance + _amount;
            stakeholders[msg.sender].stakeTime = block.timestamp;
        } else {
            stakeholders[msg.sender] = Stakeholder(_amount, block.timestamp, true);
            addresses.push(msg.sender);
        }

        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit Staked(msg.sender, _amount);
    }

    /**
     * @param _amount The amount of the token to be withdrawn
     */
    function withdraw(uint256 _amount) external {
        require(_amount > 0, "StakingRewards: cannot withdraw 0");
        require(stakeholders[msg.sender].exist, "StakingRewards: stakeholder does not exist");

        uint256 currentBalance = getBalance(msg.sender);
        require(currentBalance >= _amount, "StakingRewards: not enough balance");
        currentBalance -= _amount;

        if (currentBalance == 0) {
            delete stakeholders[msg.sender];
            uint256 index;
            for (uint256 i = 0; i < addresses.length; i++) {
                address stakeHolderAddress = addresses[i];
                if (stakeHolderAddress == msg.sender) {
                    index = i;
                    break;
                }
            }
            addresses[index] = addresses[addresses.length - 1];
            addresses.pop();
        } else {
            stakeholders[msg.sender].balance = currentBalance;
            stakeholders[msg.sender].stakeTime = block.timestamp;
        }

        stakingToken.safeTransfer(msg.sender, _amount);
        emit Withdrawn(msg.sender, _amount);
    }

    /**
     * @param _rewardPerYear The reward rate per year
     * @param _rewardPerMonth The reward rate per month
     * @param _rewardPerDay The reward rate per day
     * @param _rewardPerHour The reward rate per hour
     */
    function setRewards(
        uint256 _rewardPerYear,
        uint256 _rewardPerMonth,
        uint256 _rewardPerDay,
        uint256 _rewardPerHour
    ) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            address stakeHolderAddress = addresses[i];
            stakeholders[stakeHolderAddress].balance = getBalance(stakeHolderAddress);
            stakeholders[stakeHolderAddress].stakeTime = block.timestamp;
        }
        rewardPerYear = _rewardPerYear;
        rewardPerMonth = _rewardPerMonth;
        rewardPerDay = _rewardPerDay;
        rewardPerHour = _rewardPerHour;
        emit RewardsSet(_rewardPerYear, _rewardPerMonth, _rewardPerDay, _rewardPerHour);
    }

    /**
     * @param _account The address of the account
     * @return the current balance of the account
     */
    function getBalance(address _account) public view returns (uint256) {
        require(_account != address(0), "StakingRewards: address is not valid");
        require(stakeholders[_account].exist, "StakingRewards: stakeholder does not exist");

        uint256 balance = stakeholders[_account].balance;
        uint256 stakeTime = stakeholders[_account].stakeTime;
        uint256 current = block.timestamp;

        uint256 yearsPassed = DateTimeUtil.getYearsPassed(stakeTime, current);
        if (yearsPassed > 0) {
            balance = getBalancePerYears(balance, yearsPassed, rewardPerYear);
            current = DateTimeUtil.subYears(current, yearsPassed);
        }

        uint256 monthsPassed = DateTimeUtil.getMonthsPassed(stakeTime, current);
        if (monthsPassed > 0) {
            balance = getBalancePerMonths(balance, monthsPassed, rewardPerMonth);
            current = DateTimeUtil.subMonths(current, monthsPassed);
        }

        uint256 daysPassed = DateTimeUtil.getDaysPassed(stakeTime, current);
        if (daysPassed > 0) {
            balance = getBalancePerDays(balance, daysPassed, rewardPerDay);
            current = DateTimeUtil.subDays(current, daysPassed);
        }

        uint256 hoursPassed = DateTimeUtil.getHoursPassed(stakeTime, current);
        if (hoursPassed > 0) {
            balance = getBalancePerHours(balance, hoursPassed, rewardPerHour);
        }

        return balance;
    }

    /**
     * @param _account The address of the account
     * @return the current reward amount of the account
     */
    function getReward(address _account) public view returns (uint256) {
        require(_account != address(0), "StakingRewards: address is not valid");
        require(stakeholders[_account].exist, "StakingRewards: stakeholder does not exist");

        return getBalance(_account) - stakeholders[_account].balance;
    }

    /**
     * @param _account The address of the account
     * @return the timestamp when the staking started
     */
    function getStakeTime(address _account) public view returns (uint256) {
        require(_account != address(0), "StakingRewards: address is not valid");
        require(stakeholders[_account].exist, "StakingRewards: stakeholder does not exist");

        return stakeholders[_account].stakeTime;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function getBalancePerYears(uint256 _balance, uint256 _years, uint256 _rewardPerYear) private pure returns (uint256) {
        for(uint256 i = 1; i <= _years; i ++) {
            _balance = _balance + ((_balance * _rewardPerYear) / 1 ether);
        }
        return _balance;
    }

    function getBalancePerMonths(uint256 _balance, uint256 _months, uint256 _rewardPerMonth) private pure returns (uint256) {
        for(uint256 i = 1; i <= _months; i ++) {
            _balance = _balance + ((_balance * _rewardPerMonth) / 1 ether);
        }
        return _balance;
    }

    function getBalancePerDays(uint256 _balance, uint256 _days, uint256 _rewardPerDay) private pure returns (uint256) {
        for(uint256 i = 1; i <= _days; i ++) {
            _balance = _balance + ((_balance * _rewardPerDay) / 1 ether);
        }
        return _balance;
    }

    function getBalancePerHours(uint256 _balance, uint256 _hours, uint256 _rewardPerHour) private pure returns (uint256) {
        for(uint256 i = 1; i <= _hours; i ++) {
            _balance = _balance + ((_balance * _rewardPerHour) / 1 ether);
        }
        return _balance;
    }
}