"""
hazza promo v3 — featuring Nomi
Shorter, simpler: h → Nomi appears → text cards → hazza.name + Nomi → h pop
"""
import subprocess, wave, os
from PIL import Image, ImageDraw, ImageFont
import numpy as np

# ============================================================
# Config
# ============================================================
W, H = 1920, 1080
FPS = 30
BG = (207, 55, 72)  # #CF3748
WHITE = (255, 255, 255)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.path.join(SCRIPT_DIR, 'Fredoka-Bold.ttf')
NOMI_PATH = os.path.join(SCRIPT_DIR, '..', 'hazza-agent', 'colorways', 'nomi-transparent.png')
OUT_PATH = os.path.join(SCRIPT_DIR, 'hazza-promo.mp4')
WAV_PATH = os.path.join(SCRIPT_DIR, 'temp_audio.wav')

font_big = ImageFont.truetype(FONT_PATH, 96)
font_med = ImageFont.truetype(FONT_PATH, 56)
font_tag = ImageFont.truetype(FONT_PATH, 42)

# Pre-load and resize Nomi
_nomi_raw = Image.open(NOMI_PATH).convert('RGBA')
NOMI_H = 500
NOMI_W = int(_nomi_raw.width * NOMI_H / _nomi_raw.height)
NOMI_IMG = _nomi_raw.resize((NOMI_W, NOMI_H), Image.LANCZOS)

SR = 44100


def text_size(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def ease_out_cubic(t):
    return 1 - (1 - t) ** 3


def ease_in_cubic(t):
    return t ** 3


def ease_in_out_cubic(t):
    if t < 0.5:
        return 4 * t * t * t
    else:
        return 1 - (-2 * t + 2) ** 3 / 2


def gen_tick(pitch=800, vol=0.08):
    n = int(SR * 0.05)
    t = np.linspace(0, 0.05, n, dtype=np.float32)
    w = np.sin(2 * np.pi * pitch * t) * vol
    w *= np.linspace(1, 0, n, dtype=np.float32) ** 2.5
    return w


def mix_at(base, overlay, offset):
    s = int(offset)
    e = s + len(overlay)
    if e > len(base): e = len(base); overlay = overlay[:e - s]
    if s < 0: overlay = overlay[-s:]; s = 0
    base[s:e] += overlay


class FrameWriter:
    def __init__(self):
        self.frame_count = 0
        self.audio_events = []
        self._tmp = Image.new('RGB', (W, H), BG)
        self._td = ImageDraw.Draw(self._tmp)

    def ts(self, text, font):
        return text_size(self._td, text, font)

    def make_frame(self):
        return Image.new('RGB', (W, H), BG)

    def draw_text(self, img, text, font, x, y, color=WHITE, alpha=1.0):
        if alpha < 0.01:
            return
        if alpha >= 1.0:
            ImageDraw.Draw(img).text((x, y), text, fill=color, font=font)
        else:
            overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(overlay).text((x, y), text, fill=(*color, int(255 * alpha)), font=font)
            img.paste(Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB'))

    def draw_nomi(self, img, x, y, alpha=1.0, scale=1.0):
        """Composite Nomi onto frame"""
        if alpha < 0.01:
            return
        if scale != 1.0:
            sw = max(1, int(NOMI_W * scale))
            sh = max(1, int(NOMI_H * scale))
            nomi = NOMI_IMG.resize((sw, sh), Image.LANCZOS)
        else:
            nomi = NOMI_IMG

        if alpha < 1.0:
            # Reduce alpha of entire RGBA image
            r, g, b, a = nomi.split()
            a = a.point(lambda p: int(p * alpha))
            nomi = Image.merge('RGBA', (r, g, b, a))

        # Composite onto RGB frame
        frame_rgba = img.convert('RGBA')
        # Center nomi at (x, y) where x,y is the center point
        paste_x = int(x - nomi.width // 2)
        paste_y = int(y - nomi.height // 2)
        frame_rgba.paste(nomi, (paste_x, paste_y), nomi)
        img.paste(frame_rgba.convert('RGB'))

    def emit(self, img):
        self.writer.write(img.tobytes())
        self.frame_count += 1

    def emit_n(self, img, n):
        data = img.tobytes()
        for _ in range(n):
            self.writer.write(data)
            self.frame_count += 1

    def add_audio(self, etype, **params):
        self.audio_events.append((self.frame_count / FPS, etype, params))

    # ---- PHASES ----

    def phase_intro_h(self):
        """Red screen, then white h fades in centered, holds, then animates away"""
        hw, hh = self.ts('h', font_big)
        hx = (W - hw) // 2
        hy = (H - hh) // 2

        # Red pause (0.5s)
        self.emit_n(self.make_frame(), int(FPS * 0.5))

        # h fades in (0.6s)
        n = int(FPS * 0.6)
        for f in range(n):
            t = ease_out_cubic(f / max(n - 1, 1))
            img = self.make_frame()
            self.draw_text(img, 'h', font_big, hx, hy, WHITE, t)
            self.emit(img)

        # h holds (0.8s)
        img = self.make_frame()
        self.draw_text(img, 'h', font_big, hx, hy)
        self.emit_n(img, int(FPS * 0.8))

        # h slides left + shrinks while Nomi fades in from right (1.0s)
        # h will move to ~left third and fade out
        n = int(FPS * 1.0)
        nomi_cx = W // 2
        nomi_cy = H // 2
        for f in range(n):
            t = ease_in_out_cubic(f / max(n - 1, 1))
            h_alpha = 1.0 - ease_out_cubic(t)
            h_scale = 1.0 - t * 0.3
            h_cur_x = hx - int(t * 200)
            nomi_alpha = ease_out_cubic(t)
            nomi_scale = 0.7 + t * 0.3

            img = self.make_frame()
            # Draw h fading out
            if h_alpha > 0.01:
                scaled_size = max(10, int(96 * h_scale))
                scaled_font = ImageFont.truetype(FONT_PATH, scaled_size)
                self.draw_text(img, 'h', scaled_font, h_cur_x, hy, WHITE, h_alpha)
            # Draw Nomi fading in
            self.draw_nomi(img, nomi_cx, nomi_cy, nomi_alpha, nomi_scale)
            self.emit(img)

        self.add_audio('tick', pitch=600, vol=0.04)

    def phase_nomi_intro(self):
        """Nomi centered, text cards appear below"""
        nomi_cx = W // 2
        nomi_cy = H // 2 - 80  # shift up to make room for text

        # Nomi slides up to make room (0.5s)
        n = int(FPS * 0.5)
        for f in range(n):
            t = ease_in_out_cubic(f / max(n - 1, 1))
            cur_cy = H // 2 + int((nomi_cy - H // 2) * t)
            img = self.make_frame()
            self.draw_nomi(img, nomi_cx, cur_cy)
            self.emit(img)

        # "gm. i'm nomi." — fade in below Nomi (0.5s fade, 1.2s hold)
        line1 = "gm. i'm nomi."
        lw1, lh1 = self.ts(line1, font_med)
        lx1 = (W - lw1) // 2
        ly1 = nomi_cy + NOMI_H // 2 + 40

        self.add_audio('tick', pitch=500, vol=0.03)
        n = int(FPS * 0.5)
        for f in range(n):
            t = ease_out_cubic(f / max(n - 1, 1))
            img = self.make_frame()
            self.draw_nomi(img, nomi_cx, nomi_cy)
            self.draw_text(img, line1, font_med, lx1, ly1, WHITE, t)
            self.emit(img)

        img = self.make_frame()
        self.draw_nomi(img, nomi_cx, nomi_cy)
        self.draw_text(img, line1, font_med, lx1, ly1)
        self.emit_n(img, int(FPS * 1.2))

        # Fade out line1, fade in "names are kinda my thing." (0.4s cross, 1.2s hold)
        line2 = "names are kinda my thing."
        lw2, lh2 = self.ts(line2, font_med)
        lx2 = (W - lw2) // 2

        self.add_audio('tick', pitch=550, vol=0.03)
        n = int(FPS * 0.4)
        for f in range(n):
            t = ease_out_cubic(f / max(n - 1, 1))
            img = self.make_frame()
            self.draw_nomi(img, nomi_cx, nomi_cy)
            self.draw_text(img, line1, font_med, lx1, ly1, WHITE, 1.0 - t)
            self.draw_text(img, line2, font_med, lx2, ly1, WHITE, t)
            self.emit(img)

        img = self.make_frame()
        self.draw_nomi(img, nomi_cx, nomi_cy)
        self.draw_text(img, line2, font_med, lx2, ly1)
        self.emit_n(img, int(FPS * 1.2))

        # Fade out line2, fade in "everyone hazza name" (0.4s cross, 1.5s hold)
        line3 = "everyone hazza name"
        lw3, lh3 = self.ts(line3, font_med)
        lx3 = (W - lw3) // 2

        self.add_audio('tick', pitch=600, vol=0.04)
        n = int(FPS * 0.4)
        for f in range(n):
            t = ease_out_cubic(f / max(n - 1, 1))
            img = self.make_frame()
            self.draw_nomi(img, nomi_cx, nomi_cy)
            self.draw_text(img, line2, font_med, lx2, ly1, WHITE, 1.0 - t)
            self.draw_text(img, line3, font_med, lx3, ly1, WHITE, t)
            self.emit(img)

        img = self.make_frame()
        self.draw_nomi(img, nomi_cx, nomi_cy)
        self.draw_text(img, line3, font_med, lx3, ly1)
        self.emit_n(img, int(FPS * 1.5))

        self.add_audio('swell')

        # Fade out line3, fade in "find yours at hazza.name" (0.4s cross, 1.5s hold)
        line4 = "find yours at hazza.name"
        lw4, lh4 = self.ts(line4, font_med)
        lx4 = (W - lw4) // 2

        self.add_audio('tick', pitch=650, vol=0.04)
        n = int(FPS * 0.4)
        for f in range(n):
            t = ease_out_cubic(f / max(n - 1, 1))
            img = self.make_frame()
            self.draw_nomi(img, nomi_cx, nomi_cy)
            self.draw_text(img, line3, font_med, lx3, ly1, WHITE, 1.0 - t)
            self.draw_text(img, line4, font_med, lx4, ly1, WHITE, t)
            self.emit(img)

        img = self.make_frame()
        self.draw_nomi(img, nomi_cx, nomi_cy)
        self.draw_text(img, line4, font_med, lx4, ly1)
        self.emit_n(img, int(FPS * 1.5))

        return nomi_cx, nomi_cy, ly1

    def phase_isolate(self, nomi_cx, nomi_cy, text_y):
        """Everything fades except hazza.name and Nomi, then Nomi fades, then isolate h"""
        line4 = "find yours at hazza.name"
        lw4, _ = self.ts(line4, font_med)
        lx4 = (W - lw4) // 2

        site = "hazza.name"
        sw, sh = self.ts(site, font_med)
        sx = (W - sw) // 2
        # Calculate where "hazza.name" is within "find yours at hazza.name"
        prefix = "find yours at "
        pw, _ = self.ts(prefix, font_med)
        hazza_name_x_in_line = lx4 + pw

        # Fade "find yours at " away, slide "hazza.name" to center (1.0s)
        n = int(FPS * 1.0)
        for f in range(n):
            t = ease_in_out_cubic(f / max(n - 1, 1))
            fade = 1.0 - ease_out_cubic(t)
            cur_x = hazza_name_x_in_line + (sx - hazza_name_x_in_line) * t
            img = self.make_frame()
            self.draw_nomi(img, nomi_cx, nomi_cy)
            self.draw_text(img, prefix, font_med, lx4, text_y, WHITE, fade)
            self.draw_text(img, site, font_med, int(cur_x), text_y)
            self.emit(img)

        # Hold Nomi + hazza.name (1.0s)
        img = self.make_frame()
        self.draw_nomi(img, nomi_cx, nomi_cy)
        self.draw_text(img, site, font_med, sx, text_y)
        self.emit_n(img, int(FPS * 1.0))

        # Nomi fades out (0.8s)
        n = int(FPS * 0.8)
        for f in range(n):
            t = f / max(n - 1, 1)
            nomi_alpha = 1.0 - ease_out_cubic(t)
            img = self.make_frame()
            self.draw_nomi(img, nomi_cx, nomi_cy, nomi_alpha)
            self.draw_text(img, site, font_med, sx, text_y)
            self.emit(img)

        # Hold hazza.name alone (0.8s)
        img = self.make_frame()
        self.draw_text(img, site, font_med, sx, text_y)
        self.emit_n(img, int(FPS * 0.8))

        return sx, text_y

    def phase_final_h(self, site_x, site_y):
        """hazza.name → isolate h → slide center → pop"""
        site = "hazza.name"
        hw_big, hh_big = self.ts('h', font_big)

        # Measure parts in font_med
        hw_med, _ = self.ts('h', font_med)
        azza_w, _ = self.ts('azza', font_med)
        dot_name_w, _ = self.ts('.name', font_med)
        azza_x = site_x + hw_med
        dot_name_x = site_x + hw_med + azza_w

        # Fade "azza.name" (0.7s)
        n = int(FPS * 0.7)
        for f in range(n):
            t = f / max(n - 1, 1)
            fade = 1.0 - ease_out_cubic(t)
            img = self.make_frame()
            self.draw_text(img, 'h', font_med, site_x, site_y)
            self.draw_text(img, 'azza', font_med, azza_x, site_y, WHITE, fade)
            self.draw_text(img, '.name', font_med, dot_name_x, site_y, WHITE, fade)
            self.emit(img)

        # Hold lone h in font_med (0.3s)
        img = self.make_frame()
        self.draw_text(img, 'h', font_med, site_x, site_y)
        self.emit_n(img, int(FPS * 0.3))

        # Cross-fade: h grows from font_med to font_big while sliding to center (1.0s)
        target_x = (W - hw_big) // 2
        target_y = (H - hh_big) // 2

        n = int(FPS * 1.0)
        for f in range(n):
            t = ease_in_out_cubic(f / max(n - 1, 1))
            # Interpolate font size
            cur_size = int(56 + (96 - 56) * t)
            cur_font = ImageFont.truetype(FONT_PATH, cur_size)
            cw, ch = self.ts('h', cur_font)
            cur_x = site_x + (target_x - site_x) * t
            cur_y = site_y + (target_y - site_y) * t
            img = self.make_frame()
            self.draw_text(img, 'h', cur_font, int(cur_x), int(cur_y))
            self.emit(img)

        # Hold centered h (0.8s)
        img = self.make_frame()
        self.draw_text(img, 'h', font_big, target_x, target_y)
        self.emit_n(img, int(FPS * 0.8))

        # Pop: scale up + fade (0.5s, no sound)
        pop_dur = 0.5
        n = int(FPS * pop_dur)
        for f in range(n):
            t = f / max(n - 1, 1)
            scale = 1.0 + ease_out_cubic(t) * 0.6
            alpha = 1.0 if t < 0.4 else 1.0 - ease_out_cubic((t - 0.4) / 0.6)
            scaled_size = max(10, int(96 * scale))
            scaled_font = ImageFont.truetype(FONT_PATH, scaled_size)
            sw, sh = self.ts('h', scaled_font)
            sx = (W - sw) // 2
            sy = (H - sh) // 2
            img = self.make_frame()
            self.draw_text(img, 'h', scaled_font, sx, sy, WHITE, alpha)
            self.emit(img)

        # Red hold (0.5s)
        self.emit_n(self.make_frame(), int(FPS * 0.5))

    def generate_audio(self):
        video_dur = self.frame_count / FPS
        total_samples = int(SR * video_dur) + SR
        audio = np.zeros(total_samples, dtype=np.float32)

        # Gentle ambient pad
        n = int(SR * video_dur)
        t = np.linspace(0, video_dur, n, dtype=np.float32)
        pad = np.zeros(n, dtype=np.float32)
        for freq in [130.81, 196.00, 261.63]:
            pad += np.sin(2 * np.pi * freq * t)
        pad *= 0.02 / 3
        env = np.ones(n, dtype=np.float32)
        pk = int(n * 0.3)
        cl = int(n * 0.8)
        env[:pk] = np.linspace(0, 1, pk, dtype=np.float32)
        env[cl:] = np.linspace(1, 0, n - cl, dtype=np.float32)
        pad *= env
        mix_at(audio, pad, 0)

        # Mix events
        swell_start = None
        for ts, etype, params in self.audio_events:
            off = int(ts * SR)
            if etype == 'tick':
                mix_at(audio, gen_tick(params.get('pitch', 800), params.get('vol', 0.08)), off)
            elif etype == 'swell':
                swell_start = ts

        # Warm swell from "everyone hazza name" through to end
        if swell_start is not None:
            swell_dur = video_dur - swell_start
            sn = int(SR * swell_dur)
            st = np.linspace(0, swell_dur, sn, dtype=np.float32)
            swell = np.zeros(sn, dtype=np.float32)
            base_freq = 146.83
            for freq, amp in [(base_freq, 0.30), (base_freq * 1.01, 0.15),
                              (base_freq * 1.5, 0.25), (base_freq * 2.0, 0.20)]:
                swell += np.sin(2 * np.pi * freq * st) * amp
            swell_env = np.ones(sn, dtype=np.float32)
            rise_n = min(int(SR * 1.5), sn)
            swell_env[:rise_n] = np.sin(np.linspace(0, np.pi / 2, rise_n, dtype=np.float32))
            peak_end = min(rise_n + int(SR * 3.0), sn)
            if peak_end < sn:
                swell_env[peak_end:] = np.cos(np.linspace(0, np.pi / 2, sn - peak_end, dtype=np.float32))
            swell *= swell_env * 0.05
            mix_at(audio, swell, int(swell_start * SR))

        peak = np.max(np.abs(audio))
        if peak > 0:
            audio = audio / peak * 0.85

        video_samples = int(video_dur * SR) + SR
        if len(audio) < video_samples:
            audio = np.concatenate([audio, np.zeros(video_samples - len(audio), dtype=np.float32)])
        else:
            audio = audio[:video_samples]

        audio_int16 = (audio * 32767).astype(np.int16)
        with wave.open(WAV_PATH, 'w') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(SR)
            wf.writeframes(audio_int16.tobytes())
        print(f"Audio: {len(audio) / SR:.1f}s")

    def run(self):
        raw_path = os.path.join(SCRIPT_DIR, 'temp_raw.rgb')

        class RawWriter:
            def __init__(self, path):
                self.f = open(path, 'wb')
                self.idx = 0
            def write(self, data):
                self.f.write(data)
                self.idx += 1
                if self.idx % 100 == 0:
                    print(f"  frame {self.idx}...")
            def close(self):
                self.f.close()

        self.writer = RawWriter(raw_path)
        self.frame_count = 0
        self.audio_events = []

        print("Rendering frames...")
        self.phase_intro_h()
        nomi_cx, nomi_cy, text_y = self.phase_nomi_intro()
        site_x, site_y = self.phase_isolate(nomi_cx, nomi_cy, text_y)
        self.phase_final_h(site_x, site_y)
        self.writer.close()
        print(f"  {self.frame_count} frames ({self.frame_count / FPS:.1f}s)")

        print("Generating audio...")
        self.generate_audio()

        print("Encoding MP4...")
        cmd = [
            'ffmpeg', '-y',
            '-f', 'rawvideo', '-pix_fmt', 'rgb24',
            '-s', f'{W}x{H}', '-r', str(FPS),
            '-i', raw_path,
            '-i', WAV_PATH,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20',
            '-threads', '1',
            '-x264-params', 'rc-lookahead=5:ref=1:bframes=0',
            '-c:a', 'aac', '-b:a', '192k',
            '-pix_fmt', 'yuv420p',
            '-map', '0:v', '-map', '1:a',
            OUT_PATH
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)

        try: os.remove(raw_path)
        except: pass
        try: os.remove(WAV_PATH)
        except: pass

        if result.returncode == 0:
            size_mb = os.path.getsize(OUT_PATH) / (1024 * 1024)
            print(f"\nDone! {OUT_PATH}")
            print(f"Size: {size_mb:.1f} MB, Duration: {self.frame_count / FPS:.1f}s")
        else:
            print("FFmpeg error:")
            print(result.stderr[-1000:])


if __name__ == '__main__':
    fw = FrameWriter()
    fw.run()
