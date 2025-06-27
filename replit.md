# Investment Portfolio Management Platform

## Overview

This is a comprehensive investment portfolio management platform built with modern TypeScript/React architecture. The system provides sophisticated financial data processing, AI-powered stock predictions, real-time market tracking, and comprehensive portfolio analytics. It serves as a professional-grade tool for managing investment holdings, tracking market performance, and making data-driven investment decisions.

## System Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript, Wouter (routing), TanStack Query (state management)
- **UI Components**: Radix UI with Tailwind CSS for modern, accessible design
- **Backend**: Express.js + TypeScript with comprehensive API layer
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: OpenID Connect (Replit Auth) with session management
- **Build System**: Vite for development and production builds
- **Deployment**: Single-port deployment (5000) with autoscale configuration

### External Integrations
- **Financial Data**: Financial Modeling Prep (FMP) API for real-time stock quotes and market data
- **AI Services**: OpenAI GPT-4 for intelligent stock predictions and technical analysis
- **Market Data**: Support for international markets with comprehensive historical data

## Key Components

### 1. Database Schema (`shared/schema.ts`)
Multi-tenant architecture with proper foreign key constraints:
- **Holdings**: User portfolio positions with decimal precision for financial calculations
- **Watchlist**: Stock tracking without ownership
- **Predictions**: AI-generated stock predictions with confidence scoring
- **Historical Prices**: Offline/weekend portfolio valuations
- **Sessions**: Encrypted session management for authentication

**Security Model**: All operations require `userId` parameter for complete data isolation between users.

### 2. Data Access Layer (`server/storage.ts`)
Repository pattern implementation providing:
- Type-safe database operations using Drizzle ORM
- Centralized query logic with proper error handling
- Multi-tenant security enforced at the data layer
- Optimized queries with comprehensive indexing strategy

### 3. API Routes Layer (`server/routes.ts`)
RESTful conventions with comprehensive endpoints:
- **Authentication**: `/api/auth/*` - Replit OpenID Connect integration
- **Portfolio Management**: `/api/holdings/*`, `/api/portfolio/*` - Holdings CRUD operations
- **Watchlist**: `/api/watchlist/*` - Stock monitoring without ownership
- **AI Predictions**: `/api/predictions/*` - Stock price predictions and accuracy tracking
- **Market Data**: `/api/market/*`, `/api/stock/*` - Real-time quotes and historical data
- **Data Import/Export**: `/api/import/*` - CSV portfolio import functionality

### 4. Frontend Architecture (`client/src/`)
Modern React application with:
- **Component-based UI**: Reusable components with consistent design system
- **State Management**: TanStack Query for server state, local React hooks for UI state
- **Routing**: Wouter for lightweight client-side routing
- **Authentication Flow**: Protected routes with automatic redirects

## Data Flow

1. **Authentication**: Users authenticate via Replit OpenID Connect
2. **Data Fetching**: TanStack Query manages server state with intelligent caching
3. **Real-time Updates**: Market data refreshed every 30-60 seconds during trading hours
4. **AI Predictions**: GPT-4 generates predictions with confidence scoring and technical analysis
5. **Portfolio Calculations**: Real-time portfolio valuation with gain/loss tracking
6. **Performance Tracking**: Prediction accuracy evaluation with weighted scoring

## External Dependencies

### Required API Keys
- `FMP_API_KEY`: Financial Modeling Prep for market data
- `OPENAI_API_KEY`: GPT-4 for AI predictions
- `DATABASE_URL`: PostgreSQL database connection

### Optional Enhancement APIs
- `ALPHA_VANTAGE_API_KEY`: Alternative market data source
- `FINNHUB_API_KEY`: Additional financial data provider

### Development Configuration
- `ENABLE_API_LOGGING`: Detailed API request/response logging
- `ENABLE_DATA_VALIDATION`: Enhanced data validation and error checking
- `ENABLE_PERFORMANCE_LOGGING`: Performance metrics and optimization tracking

## Deployment Strategy

### Production Deployment
- **Build Process**: Vite builds optimized frontend bundle, ESBuild packages backend
- **Single Binary**: Combined frontend and backend deployment
- **Database**: PostgreSQL with automated migrations via Drizzle
- **Environment**: Node.js 20 with autoscale deployment target

### Development Environment
- **Hot Reload**: Vite development server with HMR
- **Database**: Local PostgreSQL with schema synchronization
- **API Proxying**: Development server proxies API requests to Express backend

### Performance Optimizations
- **Database Query Optimization**: Aggregated queries reducing round trips by 60-80%
- **Intelligent Caching**: Multi-tiered caching strategy for market data
- **API Rate Limiting**: Conservative external API usage with smart fallbacks
- **Connection Pooling**: Optimized database connections for scalability

## Changelog
- June 27, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.