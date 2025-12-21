import { translate } from 'google-translate-api-x';

export async function getTranslation(text: string, targetLang: string) {
  // 1. If English or undefined, return null (no translation needed)
  if (!targetLang || targetLang.toLowerCase() === 'english') return null;

  try {
    // 2. Map full names to ISO codes
    const langMap: Record<string, string> = {
      'Hindi': 'hi',
      'Tamil': 'ta',
      'Telugu': 'te',
      'Kannada': 'kn',
      'Malayalam': 'ml',
      'Marathi': 'mr',
      'Bangla': 'bn',     // Bengali
      'Spanish': 'es',    // Kept just in case
      'French': 'fr'
    };

    const code = langMap[targetLang];
    
    // If language is not in our list, return null (default to English)
    if (!code) return null; 

    // 3. Call the API
    const res = await translate(text, { to: code });
    return res.text;

  } catch (error) {
    console.error(`Translation failed for ${targetLang}:`, error);
    return null; // Fallback to English
  }
}