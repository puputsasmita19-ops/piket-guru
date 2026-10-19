/** Preview only: the board continues to receive and render the original message. */
export function announcementPreview(content: string, maxCharacters = 240): string {
  if (typeof content !== 'string') return '';
  const compact = content.replace(/\s+/g, ' ').trim();
  const characters = Array.from(compact);
  if (characters.length <= maxCharacters) return compact;
  const prefix = characters.slice(0, maxCharacters).join('');
  const lastSpace = prefix.lastIndexOf(' ');
  return `${lastSpace > maxCharacters * .65 ? prefix.slice(0, lastSpace) : prefix}…`;
}
