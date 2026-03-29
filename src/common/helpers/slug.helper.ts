const translitMap: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
};

function transliterate(text: string): string {
  return text
    .split('')
    .map((char) => {
      const lower = char.toLowerCase();
      if (translitMap[lower] !== undefined) {
        return translitMap[lower];
      }
      return char;
    })
    .join('');
}

export function generateSlug(text: string): string {
  if (!text) return '';

  return transliterate(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateUniqueSlug(text: string, suffix?: string): string {
  const base = generateSlug(text);
  if (suffix) {
    return `${base}-${suffix}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}
