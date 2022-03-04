// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./DateTimeUtil.sol";
import "./OwnableUpgradeable.sol";

contract StakingRewards is Initializable, UUPSUpgradeable, OwnableUpgradeable {

    using SafeERC20Upgradeable for IERC20Upgradeable;
    IERC20Upgradeable public stakingToken;

    struct Stakeholder {
        uint balance;
        uint stakeTime;
        bool exist;
    }

    mapping(address => Stakeholder) public stakeholders;
    address[] public addresses;
    uint public rewardPerYear;
    uint public rewardPerMonth;
    uint public rewardPerDay;
    uint public rewardPerHour;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    function initialize(
        address _stakingToken,
        uint _rewardPerYear,
        uint _rewardPerMonth,
        uint _rewardPerDay,
        uint _rewardPerHour
    ) public initializer {
        OwnableUpgradeable.initialize();
        stakingToken = IERC20Upgradeable(_stakingToken);
        rewardPerYear = _rewardPerYear;
        rewardPerMonth = _rewardPerMonth;
        rewardPerDay = _rewardPerDay;
        rewardPerHour = _rewardPerHour;
    }

    function stake(uint _amount) external {
        require(_amount > 0, "StakingRewards: cannot stake 0");

        if (stakeholders[msg.sender].exist) {
            // This process is not fair
            // Sample: one stakeholder stakes at 1 pm, again he stakes at 2:50 pm.
            // The reward of one hour is calculated and given to stakeholder, but the 50 minute is lost
            uint currentBalance = getBalance(msg.sender);
            stakeholders[msg.sender].balance = currentBalance + _amount;
            stakeholders[msg.sender].stakeTime = block.timestamp;
        } else {
            stakeholders[msg.sender] = Stakeholder(_amount, block.timestamp, true);
            addresses.push(msg.sender);
        }

        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit Staked(msg.sender, _amount);
    }

    function withdraw(uint _amount) external {
        require(_amount > 0, "StakingRewards: cannot withdraw 0");
        require(stakeholders[msg.sender].exist, "StakingRewards: stakeholder does not exist");

        uint currentBalance = getBalance(msg.sender);
        require(currentBalance >= _amount, "StakingRewards: not enough balance");
        currentBalance -= _amount;

        if (currentBalance == 0) {
            delete stakeholders[msg.sender];
            uint index;
            for (uint i = 0; i < addresses.length; i++) {
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

    function setRewards(
        uint _rewardPerYear,
        uint _rewardPerMonth,
        uint _rewardPerDay,
        uint _rewardPerHour
    ) external onlyOwner {
        for (uint i = 0; i < addresses.length; i++) {
            address stakeHolderAddress = addresses[i];
            stakeholders[stakeHolderAddress].balance = getBalance(stakeHolderAddress);
            stakeholders[stakeHolderAddress].stakeTime = block.timestamp;
        }
        rewardPerYear = _rewardPerYear;
        rewardPerMonth = _rewardPerMonth;
        rewardPerDay = _rewardPerDay;
        rewardPerHour = _rewardPerHour;
    }

    function getBalance(address _account) public view returns (uint) {
        require(_account != address(0), "StakingRewards: address is not valid");
        require(stakeholders[_account].exist, "StakingRewards: stakeholder does not exist");

        uint balance = stakeholders[_account].balance;
        uint stakeTime = stakeholders[_account].stakeTime;
        uint current = block.timestamp;

        uint yearsPassed = DateTimeUtil.getYearsPassed(stakeTime, current);
        if (yearsPassed > 0) {
            balance = getBalancePerYears(balance, yearsPassed, rewardPerYear);
            current = DateTimeUtil.subYears(current, yearsPassed);
        }

        uint monthsPassed = DateTimeUtil.getMonthsPassed(stakeTime, current);
        if (monthsPassed > 0) {
            balance = getBalancePerMonths(balance, monthsPassed, rewardPerMonth);
            current = DateTimeUtil.subMonths(current, monthsPassed);
        }

        uint daysPassed = DateTimeUtil.getDaysPassed(stakeTime, current);
        if (daysPassed > 0) {
            balance = getBalancePerDays(balance, daysPassed, rewardPerDay);
            current = DateTimeUtil.subDays(current, daysPassed);
        }

        uint hoursPassed = DateTimeUtil.getHoursPassed(stakeTime, current);
        if (hoursPassed > 0) {
            balance = getBalancePerHours(balance, hoursPassed, rewardPerHour);
        }

        return balance;
    }

    function getReward(address _account) public view returns (uint) {
        require(_account != address(0), "StakingRewards: address is not valid");
        require(stakeholders[_account].exist, "StakingRewards: stakeholder does not exist");

        return getBalance(_account) - stakeholders[_account].balance;
    }

    function getStakeTime(address _account) public view returns (uint) {
        require(_account != address(0), "StakingRewards: address is not valid");
        require(stakeholders[_account].exist, "StakingRewards: stakeholder does not exist");

        return stakeholders[_account].stakeTime;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function getBalancePerYears(uint _balance, uint _years, uint _rewardPerYear) private pure returns (uint) {
        for(uint i = 1; i <= _years; i ++) {
            _balance = _balance + ((_balance * _rewardPerYear) / 1 ether);
        }
        return _balance;
    }

    function getBalancePerMonths(uint _balance, uint _months, uint _rewardPerMonth) private pure returns (uint) {
        for(uint i = 1; i <= _months; i ++) {
            _balance = _balance + ((_balance * _rewardPerMonth) / 1 ether);
        }
        return _balance;
    }

    function getBalancePerDays(uint _balance, uint _days, uint _rewardPerDay) private pure returns (uint) {
        for(uint i = 1; i <= _days; i ++) {
            _balance = _balance + ((_balance * _rewardPerDay) / 1 ether);
        }
        return _balance;
    }

    function getBalancePerHours(uint _balance, uint _hours, uint _rewardPerHour) private pure returns (uint) {
        for(uint i = 1; i <= _hours; i ++) {
            _balance = _balance + ((_balance * _rewardPerHour) / 1 ether);
        }
        return _balance;
    }
}