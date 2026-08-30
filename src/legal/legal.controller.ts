import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PRIVACY_POLICY_HTML } from './privacy-policy.page';
import { ACCOUNT_DELETION_HTML } from './account-deletion.page';

/**
 * Public legal pages.
 *
 * Google Play will not accept a submission from an app that collects personal
 * data without a publicly reachable privacy policy URL. This app collects a
 * great deal — including optional national ID numbers and people's written
 * accounts of their own circumstances — and had a menu entry pointing at a CMS
 * page that did not exist in the CMS document. A link to a policy, and no policy.
 *
 * The URL is `/api/v1/privacy`, which is not pretty. nginx forwards only
 * `/api/*` and `/uploads/*` to this process — everything else hits a default
 * page — so a bare `/privacy` would need an nginx change on the server. Play
 * accepts any stable public URL, and this one is under our control today rather
 * than after a request to someone else.
 */
@ApiTags('Health')
@Controller()
export class LegalController {
  @ApiOperation({
    summary: 'Privacy policy (public HTML page)',
    description: 'The URL submitted to Google Play. Bilingual, Arabic first.',
  })
  @ApiExcludeEndpoint()
  @Public()
  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  // A policy is read rarely and changes rarely; let it be cached, but not so
  // long that a correction takes a day to reach anyone.
  @Header('Cache-Control', 'public, max-age=3600')
  privacy(@Res() res: Response) {
    res.send(PRIVACY_POLICY_HTML);
  }

  @ApiOperation({
    summary: 'Account deletion instructions (public HTML page)',
    description:
      'Play requires a web URL for deletion requests separately from the in-app control — someone '
      + 'who has uninstalled the app still has data and no way back into it.',
  })
  @ApiExcludeEndpoint()
  @Public()
  @Get('account-deletion')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  accountDeletion(@Res() res: Response) {
    res.send(ACCOUNT_DELETION_HTML);
  }
}
