/* The Manager's stages drawn with the shared stage icons (src/ui/icons.tsx STAGE_ICON). */
import type { Stage } from '../../../core/manager/types.ts';
import { STAGE_ICON, type IconName } from '../../../ui/icons.tsx';

export const STAGE_ICON_OF: Record<Stage, IconName> = {
  draft: STAGE_ICON.checking, awaiting_goods: STAGE_ICON.buying, preparing: STAGE_ICON.packing,
  pending_delivery: STAGE_ICON.road, completed: STAGE_ICON.delivered, cancelled: 'void',
};
