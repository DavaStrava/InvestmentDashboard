# Investment Portfolio Management Platform - Updated Requirements

## Core System Overview
A comprehensive investment portfolio management platform that provides AI-powered market tracking, advanced data analytics, and intuitive financial visualization with intelligent prediction capabilities and real-time social media sentiment analysis.

## Key Technologies
- React.js frontend with TypeScript
- AI-powered stock prediction system with enhanced detailed analysis
- PostgreSQL database with Drizzle ORM
- Financial Market Prep (FMP) API as primary data source
- Advanced technical analysis with natural language insights
- Responsive cross-device design
- International market data tracking with GPT-4o reasoning
- Enhanced logging and debugging infrastructure
- Simplified prediction tracking dashboard with tabular performance metrics
- **NEW: Social Media Market Sentiment Analysis Engine**

## Core Features

### 1. Portfolio Management
- **Holdings Management**: Full CRUD operations for portfolio holdings
- **Real-time Valuations**: Live portfolio value calculations with daily P&L
- **CSV Import/Export**: Flexible portfolio data import with template support
- **Performance Analytics**: Historical performance tracking with benchmark comparisons

### 2. Market Data Integration
- **Real-time Quotes**: Live stock prices via FMP API
- **Market Indices**: Track major indices (S&P 500, NASDAQ, Dow Jones, etc.)
- **International Markets**: Global market data support
- **Historical Data**: Comprehensive historical price data for analysis

### 3. AI-Powered Predictions
- **Stock Predictions**: 1-day, 1-week, and 1-month price predictions
- **Confidence Scoring**: Weighted accuracy metrics with evaluation tracking
- **Technical Analysis**: Automated technical analysis with narrative insights
- **Market-Aware Scheduling**: Predictions only generate during trading days
- **Performance Evaluation**: Automated accuracy tracking and scoring

### 4. Watchlist Functionality
- **Stock Monitoring**: Track favorite stocks without ownership
- **Real-time Updates**: Live price updates for watchlist items
- **Quick Actions**: Add to portfolio or generate predictions directly

### 5. **NEW: Social Media Market Sentiment Analysis**

#### 5.1 Real-Time Sentiment Monitoring
- **Multi-Platform Aggregation**: 
  - Twitter/X sentiment analysis using official API
  - Reddit financial subreddits monitoring (r/stocks, r/investing, r/SecurityAnalysis)
  - StockTwits integration for trader sentiment
  - News headlines sentiment from financial sources

#### 5.2 Sentiment Scoring Engine
- **AI-Powered Analysis**: GPT-4 based sentiment classification
- **Sentiment Metrics**:
  - Overall sentiment score (-100 to +100)
  - Volume-weighted sentiment (more mentions = higher weight)
  - Trending sentiment direction (improving/declining)
  - Sentiment velocity (rate of change)
  - Confidence level in sentiment analysis

#### 5.3 Sentiment Data Sources
- **Social Platforms**:
  - Twitter/X: Real-time tweets with stock mentions
  - Reddit: Comments and posts from financial subreddits
  - StockTwits: Trader posts and sentiment indicators
  - LinkedIn: Professional market commentary
  
- **News Sources**:
  - Financial news headlines (Reuters, Bloomberg, MarketWatch)
  - Earnings call transcripts sentiment
  - SEC filing sentiment analysis
  - Analyst report summaries

#### 5.4 Sentiment Visualization
- **Sentiment Dashboard**:
  - Real-time sentiment gauge for each stock
  - Sentiment trend charts (hourly, daily, weekly)
  - Volume-weighted sentiment over time
  - Sentiment vs. price correlation analysis
  
- **Interactive Features**:
  - Click to view source posts/articles
  - Filter by platform or time range
  - Sentiment alerts for significant changes
  - Sentiment-based stock screening

#### 5.5 Integration with Existing Features
- **Portfolio Integration**: Sentiment overlay on portfolio holdings
- **Prediction Enhancement**: Use sentiment as input for AI predictions
- **Watchlist Sentiment**: Show sentiment scores for watchlist items
- **Alert System**: Notifications when sentiment changes significantly

#### 5.6 Sentiment Analytics
- **Sentiment Metrics**:
  - Bullish/Bearish ratio
  - Sentiment momentum indicators
  - Fear & Greed index calculation
  - Institutional vs. retail sentiment comparison
  
- **Predictive Features**:
  - Sentiment-based price movement predictions
  - Sentiment divergence alerts (when sentiment contradicts price)
  - Social volume spikes detection
  - Viral content impact tracking

#### 5.7 Data Storage & API Design
- **Database Schema**:
  ```sql
  sentiment_data (
    id, symbol, platform, content, sentiment_score, 
    confidence, post_time, volume_weight, metadata
  )
  
  sentiment_aggregates (
    id, symbol, timeframe, avg_sentiment, post_count,
    weighted_sentiment, trend_direction, calculated_at
  )
  ```

- **API Endpoints**:
  - `GET /api/sentiment/:symbol` - Current sentiment data
  - `GET /api/sentiment/:symbol/history` - Historical sentiment trends
  - `GET /api/sentiment/trending` - Trending sentiment stocks
  - `GET /api/sentiment/alerts` - Sentiment-based alerts

#### 5.8 Required External APIs
- **Twitter/X API v2**: Real-time tweet streaming and search
- **Reddit API**: Subreddit monitoring and comment analysis
- **StockTwits API**: Trader sentiment and message streams
- **News APIs**: Financial news aggregation services
- **OpenAI API**: Enhanced sentiment analysis and classification

#### 5.9 User Interface Components
- **Sentiment Widgets**:
  - Compact sentiment indicators on stock cards
  - Detailed sentiment breakdown modals
  - Sentiment trend charts
  - Social volume indicators
  
- **Sentiment Pages**:
  - Dedicated sentiment dashboard
  - Platform-specific sentiment views
  - Sentiment-based stock screener
  - Alert management interface

#### 5.10 Performance & Scalability
- **Real-time Processing**: WebSocket connections for live updates
- **Caching Strategy**: Redis for frequent sentiment queries
- **Rate Limiting**: Respect API limits with intelligent queuing
- **Background Jobs**: Scheduled sentiment data collection and aggregation

## Enhanced System Architecture

### Frontend (React/TypeScript)
- Portfolio management interface
- Real-time market data displays
- AI prediction visualization
- **Sentiment analysis dashboard**
- **Social media integration widgets**
- Responsive design for all devices

### Backend (Node.js/Express)
- RESTful API architecture
- Real-time data processing
- AI prediction engine
- **Sentiment analysis service**
- **Social media data ingestion**
- Market schedule awareness

### Database (PostgreSQL)
- Portfolio and holdings data
- Market data caching
- Prediction storage and evaluation
- **Sentiment data warehouse**
- **Social media content archive**
- Performance optimization with indexes

### External Integrations
- Financial Market Prep (FMP) API
- OpenAI GPT-4 for predictions and analysis
- **Twitter/X API for real-time sentiment**
- **Reddit API for community sentiment**
- **StockTwits API for trader sentiment**
- **Financial news APIs for headline analysis**

## Security & Privacy
- API key management for external services
- Rate limiting and quota management
- User data privacy compliance
- **Social media data anonymization**
- **Sentiment data retention policies**

## Future Enhancements
- User authentication and multi-user support
- Mobile application development
- Advanced portfolio optimization algorithms
- **Machine learning sentiment prediction models**
- **Sentiment-driven trading signals**
- **Social influence tracking for individual traders/analysts**

## Success Metrics
- Portfolio tracking accuracy
- Prediction performance evaluation
- User engagement with sentiment features
- **Sentiment analysis accuracy vs. market movements**
- **Social media data coverage and freshness**
- Real-time data processing performance

---

*This updated requirements document includes the comprehensive social media market sentiment analysis feature while maintaining all existing functionality and system architecture.*