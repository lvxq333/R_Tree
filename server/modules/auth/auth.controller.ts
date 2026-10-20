import { validationEnabled } from '../facts/validation-environment';
import { BadRequestException, Body, Controller, Get, Post, Query, Req, Res, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { RegisterInput } from '@shared/api.interface';
import { AuthService, OAUTH_COOKIE, SESSION_COOKIE } from './auth.service';

function cookie(request: Request, name: string): string | undefined {
  const value = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : undefined;
}
function cookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: process.env.AUTH_COOKIE_SECURE === 'true', path: '/', maxAge };
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('config')
  config() { return { feishuEnabled: this.auth.feishuConfigured(), ssoEnabled: false, validationMode: validationEnabled() }; }

  @Get('me')
  async me(@Req() request: Request, @Res() response: Response) {
    return response.json(await this.auth.userFromToken(cookie(request, SESSION_COOKIE)));
  }

  @Post('login')
  async login(@Body() body: { username?: string; password?: string }, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = body?.password;
    if (!username || username.length > 100 || typeof password !== 'string' || !password || password.length > 1024) throw new BadRequestException('请输入账号和密码');
    const token = await this.auth.login(username, password, request.ip ?? 'local');
    response.cookie(SESSION_COOKIE, token, cookieOptions(7 * 24 * 60 * 60_000));
    return this.auth.userFromToken(token);
  }

  @Post('register')
  async register(@Body() input: RegisterInput, @Res({ passthrough: true }) response: Response) {
    const token = await this.auth.register(input);
    response.cookie(SESSION_COOKIE, token, cookieOptions(7 * 24 * 60 * 60_000));
    return this.auth.userFromToken(token);
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(cookie(request, SESSION_COOKIE));
    response.clearCookie(SESSION_COOKIE, cookieOptions(0));
    return { ok: true };
  }

  @Get('feishu/start')
  async startFeishu(@Query('link') link: string | undefined, @Req() request: Request, @Res() response: Response) {
    const user = await this.auth.userFromToken(cookie(request, SESSION_COOKIE));
    if (link === '1' && !user) throw new UnauthorizedException('请先登录本地账号');
    const { url, state } = await this.auth.startFeishu(link === '1' ? user!.accountId : null);
    response.cookie(OAUTH_COOKIE, state, cookieOptions(5 * 60_000));
    response.redirect(url);
  }

  @Get('feishu/callback')
  async callback(@Query('code') code: string | undefined, @Query('state') state: string | undefined,
    @Req() request: Request, @Res() response: Response) {
    response.clearCookie(OAUTH_COOKIE, cookieOptions(0));
    if (!code || !state) throw new BadRequestException('飞书未返回授权码');
    const result = await this.auth.finishFeishu(code, state, cookie(request, OAUTH_COOKIE));
    response.cookie(SESSION_COOKIE, result.token, cookieOptions(7 * 24 * 60 * 60_000));
    const appUrl = process.env.AUTH_APP_URL || `http://127.0.0.1:${process.env.SERVER_PORT || 3000}/`;
    response.redirect(new URL('#overview', appUrl).toString());
  }

  @Get('sso/start')
  sso() { throw new ServiceUnavailableException('公司 SSO 协议尚未确定，暂不能登录'); }
}
