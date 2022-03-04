// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

library DateTimeUtil {

    uint constant SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
    uint constant SECONDS_PER_MONTH = 30 * 24 * 60 * 60;
    uint constant SECONDS_PER_DAY = 24 * 60 * 60;
    uint constant SECONDS_PER_HOUR = 60 * 60;

    function getYearsPassed(uint fromTimestamp, uint toTimestamp) internal pure returns (uint _years) {
        require(fromTimestamp <= toTimestamp, 'ce10');
        _years = (toTimestamp - fromTimestamp) / SECONDS_PER_YEAR;
    }
    function getMonthsPassed(uint fromTimestamp, uint toTimestamp) internal pure returns (uint _months) {
        require(fromTimestamp <= toTimestamp, 'ce10');
        _months = (toTimestamp - fromTimestamp) / SECONDS_PER_MONTH;
    }
    function getDaysPassed(uint fromTimestamp, uint toTimestamp) internal pure returns (uint _days) {
        require(fromTimestamp <= toTimestamp, 'ce10');
        _days = (toTimestamp - fromTimestamp) / SECONDS_PER_DAY;
    }
    function getHoursPassed(uint fromTimestamp, uint toTimestamp) internal pure returns (uint _hours) {
        require(fromTimestamp <= toTimestamp, 'ce10');
        _hours = (toTimestamp - fromTimestamp) / SECONDS_PER_HOUR;
    }

    function subYears(uint timestamp, uint _years) internal pure returns (uint newTimestamp) {
        newTimestamp = timestamp - _years * SECONDS_PER_YEAR;
        require(newTimestamp <= timestamp, "ce10");
    }
    function subMonths(uint timestamp, uint _months) internal pure returns (uint newTimestamp) {
        newTimestamp = timestamp - _months * SECONDS_PER_MONTH;
        require(newTimestamp <= timestamp, "ce10");
    }
    function subDays(uint timestamp, uint _days) internal pure returns (uint newTimestamp) {
        newTimestamp = timestamp - _days * SECONDS_PER_DAY;
        require(newTimestamp <= timestamp, "ce10");
    }

}