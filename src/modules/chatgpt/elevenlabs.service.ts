import { Injectable, Logger } from '@nestjs/common';

// ═══════════════════════════════════════════════════════
// O'ZBEK TILI — RAQAMLARNI SO'ZGA AYLANTIRUVCHI
// ═══════════════════════════════════════════════════════

const ONES = ['', 'bir', 'ikki', 'uch', 'to\'rt', 'besh', 'olti', 'yetti', 'sakkiz', 'to\'qqiz'];
const TENS = ['', 'o\'n', 'yigirma', 'o\'ttiz', 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', 'to\'qson'];

function numberToUzbek(n: number): string {
  if (n < 0) return 'minus ' + numberToUzbek(-n);
  if (n === 0) return 'nol';

  let result = '';

  if (n >= 1_000_000_000) {
    result += numberToUzbek(Math.floor(n / 1_000_000_000)) + ' milliard ';
    n %= 1_000_000_000;
  }
  if (n >= 1_000_000) {
    result += numberToUzbek(Math.floor(n / 1_000_000)) + ' million ';
    n %= 1_000_000;
  }
  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    result += (thousands === 1 ? '' : numberToUzbek(thousands) + ' ') + 'ming ';
    n %= 1000;
  }
  if (n >= 100) {
    const hundreds = Math.floor(n / 100);
    result += (hundreds === 1 ? '' : ONES[hundreds] + ' ') + 'yuz ';
    n %= 100;
  }
  if (n >= 10) {
    result += TENS[Math.floor(n / 10)] + ' ';
    n %= 10;
  }
  if (n > 0) {
    result += ONES[n] + ' ';
  }

  return result.trim();
}

/**
 * O'zbek TTS uchun matn tayyorlash — raqamlar, belgilar, tozalash
 */
function preprocessUzbek(text: string): string {
  let t = text;

  // Markdown tozalash
  t = t.replace(/[*_~`#]/g, '');
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // markdown links

  // Emoji va maxsus belgilarni olib tashlash
  t = t.replace(/[\u{1F600}-\u{1F9FF}]/gu, '');
  t = t.replace(/[\u{2600}-\u{26FF}]/gu, '');
  t = t.replace(/[\u{2700}-\u{27BF}]/gu, '');

  // Birlik almashtirishlar
  t = t.replace(/m²/g, ' kvadrat metr');
  t = t.replace(/km²/g, ' kvadrat kilometr');
  t = t.replace(/km/g, ' kilometr');
  t = t.replace(/kg/g, ' kilogramm');
  t = t.replace(/kv\.m/gi, ' kvadrat metr');

  // Valyuta va foizlar — raqam OLDIN aytilishi kerak
  t = t.replace(/(\d[\d\s.,]*)\s*\$/g, (_, num) => {
    const n = parseFloat(num.replace(/[\s,]/g, ''));
    return isNaN(n) ? num + ' dollar' : numberToUzbek(n) + ' dollar';
  });
  t = t.replace(/\$\s*(\d[\d\s.,]*)/g, (_, num) => {
    const n = parseFloat(num.replace(/[\s,]/g, ''));
    return isNaN(n) ? num + ' dollar' : numberToUzbek(n) + ' dollar';
  });
  t = t.replace(/(\d[\d\s.,]*)\s*%/g, (_, num) => {
    const n = parseFloat(num.replace(/[\s,]/g, ''));
    return isNaN(n) ? num + ' foiz' : numberToUzbek(n) + ' foiz';
  });
  t = t.replace(/(\d[\d\s.,]*)\s*so'm/gi, (_, num) => {
    const n = parseFloat(num.replace(/[\s,]/g, ''));
    return isNaN(n) ? num + ' so\'m' : numberToUzbek(n) + ' so\'m';
  });

  // O'nlik raqamlar (masalan 3.14 → uch butun o'n to'rt)
  t = t.replace(/(\d+)\.(\d+)/g, (_, intPart, decPart) => {
    return numberToUzbek(parseInt(intPart)) + ' butun ' + numberToUzbek(parseInt(decPart));
  });

  // Qolgan barcha raqamlarni so'zga aylantirish
  t = t.replace(/\d[\d\s,]*/g, (match) => {
    const n = parseInt(match.replace(/[\s,]/g, ''));
    return isNaN(n) ? match : numberToUzbek(n);
  });

  // Ko'p bo'shliqlarni tozalash
  t = t.replace(/\s{2,}/g, ' ');
  t = t.replace(/\.\.\./g, ', ');

  return t.trim();
}

// ═══════════════════════════════════════════════════════
// ELEVENLABS SERVICE
// ═══════════════════════════════════════════════════════

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);
  private readonly apiKey = process.env.ELEVENLABS_API_KEY;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';

  // Sarah (premade) — multilingual, bepul plan da ishlaydi
  private readonly voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

  /**
   * Text to Speech — o'zbek tilida, raqamlar so'zga aylantirilgan
   */
  async textToSpeech(text: string): Promise<Buffer> {
    // O'zbek preprocessing — raqamlar, belgilar, tozalash
    const cleanedText = preprocessUzbek(text);

    if (!cleanedText) {
      throw new Error('Empty text for TTS');
    }

    this.logger.log(`TTS: "${cleanedText.substring(0, 80)}..."`);

    // Streaming endpoint — tezroq javob
    const response = await fetch(
      `${this.baseUrl}/text-to-speech/${this.voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: cleanedText,
          model_id: 'eleven_flash_v2_5',
          language_code: 'uz',
          voice_settings: {
            stability: 0.80,
            similarity_boost: 0.90,
            style: 0.15,
            use_speaker_boost: true,
          },
          output_format: 'mp3_44100_128',
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`ElevenLabs TTS error: ${response.status} ${error}`);
      throw new Error(`ElevenLabs TTS failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Speech to Text — o'zbek tilida audio → matn
   */
  async speechToText(
    audioBuffer: Buffer,
    mimetype: string = 'audio/webm',
  ): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimetype });
    formData.append('file', blob, 'audio.webm');
    formData.append('model_id', 'scribe_v2');
    formData.append('language_code', 'uz');

    const response = await fetch(`${this.baseUrl}/speech-to-text`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`ElevenLabs STT error: ${response.status} ${error}`);
      throw new Error(`ElevenLabs STT failed: ${response.status}`);
    }

    const result = await response.json();
    return result.text || '';
  }
}
