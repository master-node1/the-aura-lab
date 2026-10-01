import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('overview')
  overview(@Request() req: any) {
    return this.analytics.overview(req.user.sub);
  }

  @Get('emotions/trend')
  emotionTrend(@Request() req: any, @Query('days') days = 7) {
    return this.analytics.emotionTrend(req.user.sub, +days);
  }

  @Get('conversations/stats')
  conversationStats(@Request() req: any) {
    return this.analytics.conversationStats(req.user.sub);
  }

  @Get('memories/stats')
  memoryStats(@Request() req: any) {
    return this.analytics.memoryStats(req.user.sub);
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'analytics-service' };
  }
}
