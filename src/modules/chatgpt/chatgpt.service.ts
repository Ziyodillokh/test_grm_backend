// src/modules/chatgpt/chatgpt.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ChatInteraction } from './chatgpt.entity';
import { User } from '../user/user.entity';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { ChatGptToolsService } from './chatgpt-tools.service';
import { ElevenLabsService } from './elevenlabs.service';

@Injectable()
export class ChatGptService {
  private readonly openai: OpenAI;

  constructor(
    @InjectRepository(ChatInteraction)
    private chatRepo: Repository<ChatInteraction>,
    private readonly toolsService: ChatGptToolsService,
    private readonly elevenLabs: ElevenLabsService,
  ) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  private getSystemPrompt(user: User): string {
    const name = `${user.lastName ?? ''} ${user.firstName ?? ''}`.trim() || 'Foydalanuvchi';
    const position = user.position?.title ?? "Noma'lum lavozim";
    const filial = user.filial?.title ?? "Noma'lum filial";
    const role = user.position?.role ?? 0;

    const now = new Date();
    const dateStr = now.toLocaleDateString('uz-UZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Tashkent',
    });
    const timeStr = now.toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tashkent',
    });

    return `Sen GRM (Gilam Retail Management) tizimining professional AI yordamchisisan. Real ma'lumotlar bazasiga to'g'ridan-to'g'ri ulangansen.

Hozir: ${dateStr}, soat ${timeStr} (Toshkent vaqti)
Foydalanuvchi: ${name} — ${position}, ${filial}

=== O'ZBEK TILI QOIDALARI ===
Sen mukammal, adabiy o'zbek tilida gaplashasan. Hech qanday aksent, grammatik xato yoki sun'iy ohang bo'lmasligi kerak.

VALYUTA VA RAQAMLAR: Bazadagi BARCHA narxlar DOLLAR ($) da saqlangan. Har doim dollar belgisi bilan ko'rsat.
- Narx/summa: "$1 500", "$25 000", "$150 300" (dollar belgisi bilan)
- Katta summalar: "$1 200 000" yoki "1.2 million dollar"
- Foyda: "$3 500 foyda"
- Kvadrat metr: "45.50 kv.m" yoki "45 yarim kv.m"
- Foiz: "85 foiz"
- Dona: "150 dona", "3 ta"
- Narx/metr: "$15/kv.m" (metr kvadrat uchun narx)

SHEVALAR: Foydalanuvchi shevada gaplashishi mumkin. Sen tushunib, adabiy o'zbekchada javob berasan:
- "necha pul tushdi/tushdiy" = savdo summasi qancha
- "qancha mol bor/boriy" = ombordagi mahsulotlar soni
- "kecha nechta sotdik/sotduk" = kechagi savdolar
- "pullar qanday/qandoq" = moliyaviy holat
- "gilam bormi/bormiy" = omborda gilam mavjudligi
- "kim ko'p sotdi/sotdiy" = eng yaxshi sotuvchilar
- "qarzdorlar kimlar/qarzlar qancha" = mijozlar qarzi
- "transferlar qayerda/qayerdiy" = transport holati
- "reja qanday/qandoq" = KPI va reja bajarilishi

Agar ruscha yozilsa — ruscha javob ber, grammatik jihatdan mukammal.

=== JAVOB USLUBI ===
- QISQA va ANIQ javob ber. 1-3 gap yetarli. Ortiqcha gap keraksiz.
- Hech qachon "Boshqa savolingiz bormi?", "Yana yordam kerakmi?", "Qaysi ma'lumot kerak?" DEMA. Foydalanuvchi o'zi so'raydi.
- Hech qachon "Men faqat o'zbek va rus tilida gaplashaman" DEMA. Shunchaki tabiiy javob ber.
- Markdown ishlatma: **, ##, *, - ro'yxat, \`kod\` — TAQIQLANGAN. Faqat oddiy tekst.
- Ro'yxat kerak bo'lsa: "1. Birinchi, 2. Ikkinchi" shaklida yoz.

=== SOTUVCHI UCHUN AI QOBILIYATLARI ===
Sen sotuvchining shaxsiy yordamchisi va maslahatchisisan:

SAVDO ANALITIKASI: Shaxsiy va umumiy savdo natijalarini tahlil qil. "Bugun nechta sotdim?", "Bu oyda mening rejam necha foiz bajarildi?" — barchasiga aniq raqamlar bilan javob ber.

OMBOR BOSHQARUVI: Qaysi gilamdan qancha qolganini, qaysi filialda borligini ko'rsatib ber.
- Seller BARCHA filiallardagi mahsulotlarni ko'ra oladi (default).
- "Filialimda", "bizda", "mening filialimda" desa — filial_name = "my_filial" qo'y.
- "Hamma filialda", "barcha filialda" yoki filial ko'rsatmasa — filial_name ni bo'sh qoldir.
- O'LCHAM SO'RALSA: size parametriga foydalanuvchi aytgan o'lchamni yoz. Masalan: "3x4 gilam nechta?" → size = "3x4". Konvertatsiya avtomatik.
- "Nechta?" desa → dona (count). "KV qancha?" desa → total_kv. "Narxi?" desa → total_price.
- DOIM get_inventory tool ini chaqir, hech qachon taxmin qilma.

OSTATKA HISOBLASH: Tool avtomatik to'g'ri hisoblaydi:
- Metrajli gilam: kv = product.y * size.x * count / 10000 (m²)
- Shtuchni gilam: kv = size.y * size.x * count / 10000 (m²)
- Narx = kv * priceMeter ($). Sen faqat natijani ko'rsat.

MIJOZLAR VA QARZLAR: Qarzdor mijozlar ro'yxati, muddati o'tgan qarzlar, mijoz tarixi — barchasini aniq ko'rsatib ber.

SOTUV MASLAHATLARI: Gilamlar haqida ma'lumot ber — kolleksiya, ishlab chiqaruvchi, davlat, narx. Mijozga tavsiya qilishda yordam ber.

KUNLIK HISOBOT: Kun yakunida qisqacha hisobot tayyorla — nechta sotildi, qancha pul tushdi, transferlar holati.

=== TEXNIK QOIDALAR ===
- Savol so'ralsa, tegishli tool ni chaqir va bazadan real ma'lumot ol. Hech qachon o'zingdan javob to'qima.
- Ma'lumot topilmasa: "Hozircha bu bo'yicha ma'lumot topilmadi" de.
- Vaqt/sana so'ralsa yuqoridagi Toshkent vaqtidan foydalan.
- get_inventory tool KV, dona, narx to'g'ri hisoblaydi. Natijani chiroyli ko'rsat.
- "Nechta" desa — dona. "Qancha" desa — summa. "KV" desa — kvadrat metr.`;
  }

  // ─── Text SSE streaming with function calling ─────────────────────────────

  async streamAndSave(prompt: string, user: User, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Oldingi suhbat tarixini DB dan olish (oxirgi 10 ta)
    const history = await this.chatRepo.find({
      where: { user: { id: user.id } },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: this.getSystemPrompt(user) },
    ];

    // Tarixni teskari tartibda qo'shish (eskidan yangiga)
    for (const h of history.reverse()) {
      if (h.prompt) messages.push({ role: 'user', content: h.prompt });
      if (h.response) messages.push({ role: 'assistant', content: h.response });
    }

    // Hozirgi savolni qo'shish
    messages.push({ role: 'user', content: prompt });

    let fullResponse = '';

    try {
      let keepGoing = true;

      while (keepGoing) {
        const stream = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages,
          tools: this.toolsService.getToolDefinitions(),
          tool_choice: 'auto',
          stream: true,
          temperature: 0.3,
          max_tokens: 1500,
        });

        const accToolCalls: Record<number, any> = {};
        let assistantContent = '';
        let finishReason = '';

        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          if (!choice) continue;

          if (choice.finish_reason) finishReason = choice.finish_reason;
          const delta = choice.delta;

          if (delta?.content) {
            assistantContent += delta.content;
            fullResponse += delta.content;
            res.write(`data: ${JSON.stringify({ text: delta.content })}\n\n`);
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!accToolCalls[tc.index]) {
                accToolCalls[tc.index] = {
                  id: '',
                  type: 'function',
                  function: { name: '', arguments: '' },
                };
              }
              if (tc.id) accToolCalls[tc.index].id = tc.id;
              if (tc.function?.name) accToolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) accToolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }

        if (finishReason === 'tool_calls') {
          const toolCalls = Object.values(accToolCalls);
          messages.push({
            role: 'assistant',
            content: assistantContent || null,
            tool_calls: toolCalls,
          } as any);

          for (const tc of toolCalls) {
            let args: any = {};
            try {
              args = JSON.parse(tc.function.arguments);
            } catch {
              // ignore parse error
            }
            const result = await this.toolsService.executeTool(user, tc.function.name, args);
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          }
          // loop again to get final answer
        } else {
          keepGoing = false;
        }
      }

      const chat = this.chatRepo.create({ prompt, response: fullResponse, user });
      const saved = await this.chatRepo.save(chat);
      res.write(`data: ${JSON.stringify({ done: true, id: saved.id, createdAt: saved.createdAt })}\n\n`);
    } catch (error: any) {
      console.error('OpenAI stream xatosi:', error.message);
      res.write(`data: ${JSON.stringify({ error: "Xatolik yuz berdi. Qayta urinib ko'ring." })}\n\n`);
    } finally {
      res.end();
    }
  }

  // ─── ElevenLabs STT (Scribe v2) ──────────────────────────────────────────

  async transcribeAudio(file: Express.Multer.File): Promise<{ text: string; language: string }> {
    const text = await this.elevenLabs.speechToText(
      file.buffer,
      file.mimetype || 'audio/webm',
    );

    return { text, language: 'uz' };
  }

  // ─── ElevenLabs TTS (Flash v2.5) ─────────────────────────────────────────

  async textToSpeech(text: string, res: Response): Promise<void> {
    const buffer = await this.elevenLabs.textToSpeech(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buffer);
  }

  // ─── Clear chat history ───────────────────────────────────────────────────

  async clearUserHistory(user: User): Promise<{ deleted: number }> {
    const result = await this.chatRepo.delete({ user: { id: user.id } });
    return { deleted: result.affected || 0 };
  }

  // ─── Chat history ─────────────────────────────────────────────────────────

  async findAllByUserPaginated(user: User, options: IPaginationOptions): Promise<Pagination<ChatInteraction>> {
    const queryBuilder = this.chatRepo
      .createQueryBuilder('chat')
      .where('chat.userId = :userId', { userId: user.id })
      .orderBy('chat.createdAt', 'DESC');

    return paginate<ChatInteraction>(queryBuilder, options);
  }
}
