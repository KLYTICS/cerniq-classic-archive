import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private authService: AuthService) {
    const callbackURL = (
      process.env.GITHUB_CALLBACK_URL ||
      'https://api.cerniq.io/api/auth/github/callback'
    ).trim();
    super({
      clientID: process.env.GITHUB_CLIENT_ID || 'not-configured',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'not-configured',
      callbackURL,
      scope: ['user:email'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    const email =
      profile.emails?.[0]?.value || `${profile.username}@github.local`;
    const user = await this.authService.validateOAuthUser({
      email,
      name: profile.displayName || profile.username,
      provider: 'github',
      providerId: profile.id,
      avatarUrl: profile.photos?.[0]?.value,
    });
    return user;
  }
}
