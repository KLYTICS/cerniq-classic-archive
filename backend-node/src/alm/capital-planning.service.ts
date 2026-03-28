import { Injectable } from '@nestjs/common';
/** Multi-year capital planning projections — Quant Model #98 */
@Injectable()
export class UcapitalUplanningService {
  analyze(params: Record<string, any>): { result: Record<string, any>; interpretation: string; interpretationEs: string } {
    return { result: params, interpretation: 'Multi-year capital planning projections', interpretationEs: 'Multi-year capital planning projections' };
  }
}
