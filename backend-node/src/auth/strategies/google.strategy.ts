import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    const callbackURL = (
      process.env.GOOGLE_CALLBACK_URL ||
      'https://api.cerniq.io/api/auth/google/callback'
    ).trim();
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'not-configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'not-configured',
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const user = await this.authService.validateOAuthUser({
      email: profile.emails[0].value,
      name: profile.displayName,
      provider: 'google',
      providerId: profile.id,
      avatarUrl: profile.photos?.[0]?.value,
    });
    done(null, user);
  }
}
