import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { resolveGoogleCallbackUrl } from '../oauth-config.util';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'not-configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'not-configured',
      callbackURL: resolveGoogleCallbackUrl(),
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
