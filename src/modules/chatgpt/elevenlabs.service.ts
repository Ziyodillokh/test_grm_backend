// src/modules/chatgpt/elevenlabs.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);
  private readonly apiKey = process.env.ELEVENLABS_API_KEY;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';

  // Sarah (premade) — works with free plan, multilingual support for Uzbek
  private readonly voiceId = 'EXAVITQu4vr4xnSDxMaL';

  /**
   * Text to Speech — converts text to audio buffer
   * Uses eleven_flash_v2_5 for fast, cost-effective real-time chat
   */
  async textToSpeech(text: string): Promise<Buffer> {
    const cleanedText = text
      .replace(/[*_~`#]/g, '') // remove markdown
      .replace(/\n{2,}/g, '\n') // normalize newlines
      .trim();

    if (!cleanedText) {
      throw new Error('Empty text for TTS');
    }

    const response = await fetch(
      `${this.baseUrl}/text-to-speech/${this.voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: cleanedText,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.85,
            style: 0.20,
            use_speaker_boost: true,
          },
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
   * Speech to Text — converts audio buffer to text
   * Uses Scribe v2 model with Uzbek language
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
