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
  const topInset = Math.max(64, Math.min(headerBottom + 12, viewportHeight - 80));
  const effectiveCardHeight = mobile ? Math.min(cardHeight, Math.min(315, Math.max(200, viewportHeight * .44))) : cardHeight;
  const cardTop = mobile && isBottomNavigationStep
    ? topInset
    : Math.max(topInset + 8, viewportHeight - effectiveCardHeight - (mobile ? 14 : 84));
  return {
    cardTop,
    focusTop: mobile && isBottomNavigationStep ? Math.min(viewportHeight - 85, cardTop + effectiveCardHeight + 16) : topInset,
    focusBottom: mobile && isBottomNavigationStep ? viewportHeight - 8 : cardTop - 14,
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
