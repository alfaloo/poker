import { cache } from 'react';
import { applyDailyReward } from '@/lib/actions/user';

// Deduplicate the daily reward DB call across layout and page within the same request.
// React cache() ensures applyDailyReward is called at most once per userId per render pass.
export const applyDailyRewardCached = cache(applyDailyReward);
