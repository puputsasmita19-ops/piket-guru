/** Pure geometry utilities for a guided spotlight that never sits under its own card. */
export interface GuideRect { top: number; left: number; width: number; height: number }

export function getGuideAreas(
  viewportWidth: number,
  viewportHeight: number,
  cardHeight: number,
  headerBottom: number,
  isBottomNavigationStep: boolean
) {
  const mobile = viewportWidth < 768;
  // Bottom navigation stays visible through tablet widths (<1024px).
  const bottomNavLayout = isBottomNavigationStep && viewportWidth < 1024;
  const topInset = Math.max(64, Math.min(headerBottom + 12, viewportHeight - 80));
  const effectiveCardHeight = mobile || bottomNavLayout ? Math.min(cardHeight, 315) : cardHeight;
  const cardTop = bottomNavLayout
    ? topInset
    : Math.max(topInset + 8, viewportHeight - effectiveCardHeight - (mobile ? 14 : 84));
  return {
    cardTop,
    focusTop: bottomNavLayout ? Math.min(viewportHeight - 85, cardTop + effectiveCardHeight + 16) : topInset,
    focusBottom: bottomNavLayout ? viewportHeight - 8 : cardTop - 14,
    mobile,
  };
}

export function clipGuideFocus(
  rectangle: GuideRect,
  viewportWidth: number,
  focusTop: number,
  focusBottom: number
): GuideRect | null {
  const left = Math.max(8, rectangle.left);
  const right = Math.min(viewportWidth - 8, rectangle.left + rectangle.width);
  const top = Math.max(focusTop, rectangle.top);
  const bottom = Math.min(focusBottom, rectangle.top + rectangle.height);
  if (right - left < 12 || bottom - top < 10) return null;
  return { left, top, width: right - left, height: bottom - top };
}

/** Whether the page must scroll to reveal a meaningful amount of the target. */
export function needsGuideScroll(rectangle: GuideRect, focusTop: number, focusBottom: number) {
  const availableHeight = Math.max(0, focusBottom - focusTop);
  const visibleHeight = Math.max(0, Math.min(rectangle.top + rectangle.height, focusBottom) - Math.max(rectangle.top, focusTop));
  return visibleHeight < Math.min(rectangle.height, Math.max(30, availableHeight * .45)) || rectangle.top < focusTop;
}


/** R72: fixed per-viewport reservation prevents feedback between guide card content
 * height, spotlight visibility and placement. It does NOT depend on measured card DOM. */
export function getGuideCardBudget(viewportWidth: number, viewportHeight: number, bottomNavigationStep: boolean): number {
  const mobile = viewportWidth < 768 || bottomNavigationStep;
  const maxBudget = mobile ? 315 : 360;
  // Reserve enough visible room for the focus area even on short laptops/phones.
  const topSpace = bottomNavigationStep ? 92 : mobile ? 200 : 205;
  const bottomSpace = bottomNavigationStep ? 88 : mobile ? 14 : 84;
  return Math.max(140, Math.min(maxBudget, viewportHeight - topSpace - bottomSpace));
}

/** R72: a bounded single scroll, only when the useful portion is out of view.
 * Deliberately never attempts to center a very tall section. */
export function getGuideScrollDelta(rect: GuideRect, focusTop: number, focusBottom: number): number {
  const safeTop = focusTop + 12;
  const safeBottom = focusBottom - 12;
  const free = Math.max(0, safeBottom - safeTop);
  if (free < 24) return 0;
  const usefulHeight = Math.min(rect.height, Math.max(30, free * .6));
  if (rect.top < safeTop) return rect.top - safeTop;
  if (rect.top + usefulHeight > safeBottom) return rect.top + usefulHeight - safeBottom;
  return 0;
}
