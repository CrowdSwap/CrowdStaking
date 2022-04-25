// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

/**
 * @title DateTimeUtil
 * @dev The library is written to be used only in StakingRewards contract. It
 * does not consider leap years. All months are considered 30 days. The extra
 * days in leap years and specific months are being considered as days when
 * calculating rewards.
 */
library DateTimeUtil {

    uint256 constant SECONDS_PER_YEAR = 365 * 1 days;
    uint256 constant SECONDS_PER_MONTH = 30 * 1 days;
    uint256 constant SECONDS_PER_DAY = 24 * 1 hours;
    uint256 constant SECONDS_PER_HOUR = 60 * 1 minutes;

    function getYearsPassed(uint256 fromTimestamp, uint256 toTimestamp) internal pure returns (uint256 _years) {
        require(fromTimestamp <= toTimestamp, 'ce10');
        _years = (toTimestamp - fromTimestamp) / SECONDS_PER_YEAR;
    }
    function getMonthsPassed(uint256 fromTimestamp, uint256 toTimestamp) internal pure returns (uint256 _months) {
        require(fromTimestamp <= toTimestamp, 'ce10');
        _months = (toTimestamp - fromTimestamp) / SECONDS_PER_MONTH;
    }
    function getDaysPassed(uint256 fromTimestamp, uint256 toTimestamp) internal pure returns (uint256 _days) {
        require(fromTimestamp <= toTimestamp, 'ce10');
        _days = (toTimestamp - fromTimestamp) / SECONDS_PER_DAY;
    }
    function getHoursPassed(uint256 fromTimestamp, uint256 toTimestamp) internal pure returns (uint256 _hours) {
        require(fromTimestamp <= toTimestamp, 'ce10');
        _hours = (toTimestamp - fromTimestamp) / SECONDS_PER_HOUR;
    }

    function subYears(uint256 timestamp, uint256 _years) internal pure returns (uint256 newTimestamp) {
        newTimestamp = timestamp - _years * SECONDS_PER_YEAR;
        require(newTimestamp <= timestamp, "ce10");
    }
    function subMonths(uint256 timestamp, uint256 _months) internal pure returns (uint256 newTimestamp) {
        newTimestamp = timestamp - _months * SECONDS_PER_MONTH;
        require(newTimestamp <= timestamp, "ce10");
    }
    function subDays(uint256 timestamp, uint256 _days) internal pure returns (uint256 newTimestamp) {
        newTimestamp = timestamp - _days * SECONDS_PER_DAY;
        require(newTimestamp <= timestamp, "ce10");
    }

}