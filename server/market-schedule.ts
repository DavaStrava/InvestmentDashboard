import { logger } from './logger';

// Major US market holidays for 2024-2025
const MARKET_HOLIDAYS = [
  // 2024
  '2024-01-01', // New Year's Day
  '2024-01-15', // Martin Luther King Jr. Day
  '2024-02-19', // Presidents' Day
  '2024-03-29', // Good Friday
  '2024-05-27', // Memorial Day
  '2024-06-19', // Juneteenth
  '2024-07-04', // Independence Day
  '2024-09-02', // Labor Day
  '2024-11-28', // Thanksgiving
  '2024-11-29', // Day after Thanksgiving
  '2024-12-25', // Christmas Day
  
  // 2025
  '2025-01-01', // New Year's Day
  '2025-01-20', // Martin Luther King Jr. Day
  '2025-02-17', // Presidents' Day
  '2025-04-18', // Good Friday
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-11-27', // Thanksgiving
  '2025-11-28', // Day after Thanksgiving
  '2025-12-25', // Christmas Day
];

export interface MarketStatus {
  isOpen: boolean;
  isTradingDay: boolean;
  reason?: string;
  nextTradingDay?: Date;
}

export function getMarketStatus(date: Date = new Date()): MarketStatus {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  const dateString = date.toISOString().split('T')[0];
  
  // Check if it's a weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const nextTradingDay = getNextTradingDay(date);
    return {
      isOpen: false,
      isTradingDay: false,
      reason: dayOfWeek === 0 ? 'Sunday' : 'Saturday',
      nextTradingDay
    };
  }
  
  // Check if it's a market holiday
  if (MARKET_HOLIDAYS.includes(dateString)) {
    const nextTradingDay = getNextTradingDay(date);
    return {
      isOpen: false,
      isTradingDay: false,
      reason: 'Market Holiday',
      nextTradingDay
    };
  }
  
  // It's a trading day - check market hours (9:30 AM - 4:00 PM ET)
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  
  // Market hours: 9:30 AM (570 minutes) to 4:00 PM (960 minutes) ET
  const marketOpen = 9 * 60 + 30; // 570 minutes (9:30 AM)
  const marketClose = 16 * 60; // 960 minutes (4:00 PM)
  
  const isOpen = currentTimeInMinutes >= marketOpen && currentTimeInMinutes < marketClose;
  
  return {
    isOpen,
    isTradingDay: true,
    reason: isOpen ? 'Market Open' : (currentTimeInMinutes < marketOpen ? 'Before Market Open' : 'After Market Close')
  };
}

export function isTradingDay(date: Date = new Date()): boolean {
  const status = getMarketStatus(date);
  return status.isTradingDay;
}

export function getNextTradingDay(date: Date): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  // Keep advancing until we find a trading day
  while (!isTradingDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}

export function getPreviousTradingDay(date: Date): Date {
  const prevDay = new Date(date);
  prevDay.setDate(prevDay.getDate() - 1);
  
  // Keep going back until we find a trading day
  while (!isTradingDay(prevDay)) {
    prevDay.setDate(prevDay.getDate() - 1);
  }
  
  return prevDay;
}

export function getLastTradingDay(): Date {
  const today = new Date();
  
  if (isTradingDay(today)) {
    return today;
  }
  
  return getPreviousTradingDay(today);
}

export function canGeneratePredictions(date: Date = new Date()): boolean {
  const status = getMarketStatus(date);
  
  if (!status.isTradingDay) {
    logger.info('MARKET_SCHEDULE', `Cannot generate predictions: ${status.reason}`);
    return false;
  }
  
  logger.info('MARKET_SCHEDULE', `Can generate predictions: ${status.reason}`);
  return true;
}

export function shouldShowRecentEvaluation(date: Date = new Date()): boolean {
  return !canGeneratePredictions(date);
}

// Log market status for debugging
export function logMarketStatus(date: Date = new Date()): MarketStatus {
  const status = getMarketStatus(date);
  logger.info('MARKET_STATUS', `Date: ${date.toDateString()}, Open: ${status.isOpen}, Trading Day: ${status.isTradingDay}, Reason: ${status.reason}`);
  return status;
}