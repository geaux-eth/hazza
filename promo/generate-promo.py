"""
hazza promo video generator v4
Outputs: hazza-promo.mp4 (1920x1080, 30fps)
"""
import subprocess, wave, os, sys
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
OUT_PATH = os.path.join(SCRIPT_DIR, 'hazza-promo.mp4')
WAV_PATH = os.path.join(SCRIPT_DIR, 'temp_audio.wav')

font_big = ImageFont.truetype(FONT_PATH, 96)
font_tag = ImageFont.truetype(FONT_PATH, 38)

NAMES = [
    # Slow — let them land
    ('freddy',    0.90),
    ('arnold',    0.85),
    ('sophia',    0.80),
    ('cheryl',    0.75),
    ('coco',      0.65),
    ('steve',     0.60),
    ('snoop',     0.55),
    ('henry',     0.50),
    ('kamala',    0.45),
    # Medium — picking up speed
    ('neil',      0.40),
    ('garth',     0.38),
    ('susan',     0.36),
    ('stephanie', 0.34),
    ('jerry',     0.32),
    ('brittany',  0.30),
    ('tom',       0.28),
    ('darryl',    0.26),
    # Fast — rolling now
    ('brad',      0.24),
    ('leonardo',  0.22),
    ('kim',       0.20),
    ('arturo',    0.19),
    ('nushi',     0.18),
    ('maria',     0.17),
    ('wei',       0.16),
    ('david',     0.16),
    ('ali',       0.15),
    ('harold',    0.15),
    ('ying',      0.14),
    ('candace',   0.14),
    ('paul',      0.13),
    ('fatima',    0.13),
    ('izzy',      0.12),
    ('thomas',    0.12),
    ('rosa',      0.12),
    ('sergey',    0.11),
    ('chris',     0.11),
    ('sam',       0.11),
    ('brian',     0.11),
    ('jesse',     0.11),
    ('miguel',    0.11),
    ('wallace',   0.11),
    # Linger
    ('satoshi',   1.40),
]

def text_size(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def cursor_rect(x, cy, font):
    """Return cursor rectangle aligned with glyph bounds"""
    asc, desc = font.getmetrics()
    top = cy + int(asc * 0.15)
    bot = cy + asc + 2
    return [x, top, x + 4, bot]

def ease_out_cubic(t):
    return 1 - (1 - t) ** 3

def ease_in_cubic(t):
    return t ** 3

def ease_in_out_cubic(t):
    if t < 0.5:
        return 4 * t * t * t
    else:
        return 1 - (-2 * t + 2) ** 3 / 2

# ============================================================
# Audio
# ============================================================
SR = 44100

def gen_tick(pitch=800, vol=0.08):
    """Soft pop/beep"""
    n = int(SR * 0.05)
    t = np.linspace(0, 0.05, n, dtype=np.float32)
    w = np.sin(2 * np.pi * pitch * t) * vol
    w *= np.linspace(1, 0, n, dtype=np.float32) ** 2.5
    return w

def gen_pop(vol=0.12):
    """Visible pop for the final h disappearance"""
    n = int(SR * 0.15)
    t = np.linspace(0, 0.15, n, dtype=np.float32)
    # Two-tone pop: attack + decay
    w = np.sin(2 * np.pi * 900 * t) * vol * 0.6
    w += np.sin(2 * np.pi * 1200 * t) * vol * 0.4
    env = np.exp(-t * 25)
    w *= env
    return w

def gen_tone(freq, duration, volume=0.1):
    n = int(SR * duration)
    t = np.linspace(0, duration, n, dtype=np.float32)
    w = np.sin(2 * np.pi * freq * t) * volume
    w *= np.linspace(1, 0, n, dtype=np.float32)
    return w

def mix_at(base, overlay, offset):
    s = int(offset)
    e = s + len(overlay)
    if e > len(base): e = len(base); overlay = overlay[:e-s]
    if s < 0: overlay = overlay[-s:]; s = 0
    base[s:e] += overlay

# ============================================================
# Frame writer
# ============================================================
class FrameWriter:
    def __init__(self):
        self.frame_count = 0
        self.audio_events = []
        self.current_time = 0.0
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

    def emit(self, img):
        self.writer.write(img.tobytes())
        self.frame_count += 1

    def emit_n(self, img, n):
        data = img.tobytes()
        for _ in range(n):
            self.writer.write(data)
            self.frame_count += 1

    def add_audio(self, etype, **params):
        # Derive time from frame count to stay perfectly synced with video
        self.audio_events.append((self.frame_count / FPS, etype, params))

    def advance(self, seconds):
        pass  # timing now derived from frame_count

    # --- PHASES ---

    def phase0_pause(self):
        """Initial red screen"""
        n = int(FPS * 0.5)
        self.emit_n(self.make_frame(), n)
        self.advance(0.5)

    def phase1_roll_names(self):
        """Roll through famous names with soft beeps"""
        for i, (name, dur) in enumerate(NAMES):
            total_f = int(FPS * dur)
            anim_f = min(int(FPS * 0.2), total_f // 3)
            hold_f = total_f - anim_f * 2

            # Soft tick, pitch rises as names speed up
            pitch = 700 + (i / len(NAMES)) * 500
            self.add_audio('tick', pitch=pitch, vol=0.05 + (i / len(NAMES)) * 0.04)

            tw, th = self.ts(name, font_big)
            cx = (W - tw) // 2
            cy = (H - th) // 2

            # Roll in
            for f in range(anim_f):
                t = ease_out_cubic(f / max(anim_f - 1, 1))
                img = self.make_frame()
                self.draw_text(img, name, font_big, cx, cy + int((1 - t) * 120), WHITE, t)
                self.emit(img)

            # Hold
            img = self.make_frame()
            self.draw_text(img, name, font_big, cx, cy, WHITE, 1.0)
            self.emit_n(img, hold_f)

            # Roll out (except last)
            if i < len(NAMES) - 1:
                for f in range(anim_f):
                    t = ease_in_cubic(f / max(anim_f - 1, 1))
                    img = self.make_frame()
                    self.draw_text(img, name, font_big, cx, cy + int(-t * 120), WHITE, 1 - t)
                    self.emit(img)

            self.advance(dur)

    def phase2_backspace(self):
        """Backspace satoshi with cursor"""
        last = 'satoshi'
        tw, th = self.ts(last, font_big)
        cy = (H - th) // 2

        # Hold last frame briefly
        img = self.make_frame()
        cx = (W - tw) // 2
        self.draw_text(img, last, font_big, cx, cy)
        self.emit_n(img, int(FPS * 0.3))
        self.advance(0.3)

        # Backspace character by character
        for c in range(len(last), 0, -1):
            partial = last[:c - 1]
            img = self.make_frame()
            draw = ImageDraw.Draw(img)
            if partial:
                pw, _ = self.ts(partial, font_big)
                px = (W - pw) // 2
                self.draw_text(img, partial, font_big, px, cy)
                draw.rectangle(cursor_rect(px + pw + 4, cy, font_big), fill=WHITE)
            else:
                draw.rectangle(cursor_rect(W // 2 - 2, cy, font_big), fill=WHITE)
            self.add_audio('tick', pitch=400, vol=0.02)
            self.emit_n(img, max(1, int(FPS * 0.055)))
            self.advance(0.055)

        # Cursor blink pause before typing
        blink_f = int(FPS * 0.25)
        for blink in range(4):
            cursor_on = (blink % 2 == 0)
            img = self.make_frame()
            if cursor_on:
                ImageDraw.Draw(img).rectangle(cursor_rect(W // 2 - 2, cy, font_big), fill=WHITE)
            self.emit_n(img, blink_f)
        self.advance(1.0)
        return cy, th

    def phase3_type_everyone(self, cy, th):
        """Type 'everyone', pause 3 blinks, type '.hazza.name'"""
        target = 'everyone'
        suffix = '.hazza.name'
        full = target + suffix

        # Position so "everyone" starts where it will be in the full string
        fw, _ = self.ts(full, font_big)
        fx = (W - fw) // 2
        ew, _ = self.ts(target, font_big)

        # Type "everyone" — each letter with a soft tick
        for c in range(1, len(target) + 1):
            partial = target[:c]
            pw, _ = self.ts(partial, font_big)
            img = self.make_frame()
            self.draw_text(img, partial, font_big, fx, cy)
            ImageDraw.Draw(img).rectangle(cursor_rect(fx + pw + 4, cy, font_big), fill=WHITE)
            self.add_audio('tick', pitch=600, vol=0.025)
            self.emit_n(img, max(1, int(FPS * 0.09)))
            self.advance(0.09)

        # Soft tick when "everyone" completes (same sound family, slightly different pitch)
        self.add_audio('tick', pitch=500, vol=0.04)

        # 3 blinks: cursor on/off 3 times (each phase 0.3s = 1.8s total)
        blink_phase = int(FPS * 0.3)
        for blink in range(6):
            cursor_on = (blink % 2 == 0)
            img = self.make_frame()
            self.draw_text(img, target, font_big, fx, cy)
            if cursor_on:
                ImageDraw.Draw(img).rectangle(cursor_rect(fx + ew + 4, cy, font_big), fill=WHITE)
            self.emit_n(img, blink_phase)
            self.advance(0.3)

        # Type ".hazza.name" — slightly faster, softer ticks
        for c in range(1, len(suffix) + 1):
            partial = suffix[:c]
            pw, _ = self.ts(target + partial, font_big)
            img = self.make_frame()
            self.draw_text(img, target + partial, font_big, fx, cy)
            ImageDraw.Draw(img).rectangle(cursor_rect(fx + pw + 4, cy, font_big), fill=WHITE)
            self.add_audio('tick', pitch=550, vol=0.02)
            self.emit_n(img, max(1, int(FPS * 0.07)))
            self.advance(0.07)

        # Remove cursor, hold "everyone.hazza.name" for 1.5s
        self.add_audio('swell')  # mark the reveal moment
        img = self.make_frame()
        self.draw_text(img, full, font_big, fx, cy)
        self.emit_n(img, int(FPS * 1.5))
        self.advance(1.5)
        return fx

    def phase4_isolate_hazza(self, cy, fx):
        """Fade 'everyone.' and '.name', leaving 'hazza'"""
        ew, _ = self.ts('everyone', font_big)
        dw, _ = self.ts('.', font_big)
        hw, hh = self.ts('hazza', font_big)

        everyone_x = fx
        dot_x = fx + ew
        hazza_x = fx + ew + dw
        dotname_x = fx + ew + dw + hw

        # Fade "everyone." and ".name" (1.2s)
        n_frames = int(FPS * 1.2)
        for f in range(n_frames):
            t = f / max(n_frames - 1, 1)
            fade = 1 - ease_out_cubic(t)
            img = self.make_frame()
            self.draw_text(img, 'everyone', font_big, everyone_x, cy, WHITE, fade)
            self.draw_text(img, '.', font_big, dot_x, cy, WHITE, fade)
            self.draw_text(img, 'hazza', font_big, hazza_x, cy)
            self.draw_text(img, '.name', font_big, dotname_x, cy, WHITE, fade)
            self.emit(img)
        self.advance(1.2)

        # Hold "hazza" in current position (0.8s)
        img = self.make_frame()
        self.draw_text(img, 'hazza', font_big, hazza_x, cy)
        self.emit_n(img, int(FPS * 0.8))
        self.advance(0.8)

        # Slide "hazza" to center (0.8s)
        hazza_target_x = (W - hw) // 2
        n_frames = int(FPS * 0.8)
        for f in range(n_frames):
            t = ease_in_out_cubic(f / max(n_frames - 1, 1))
            cur_x = hazza_x + (hazza_target_x - hazza_x) * t
            img = self.make_frame()
            self.draw_text(img, 'hazza', font_big, int(cur_x), cy)
            self.emit(img)
        self.advance(0.8)

        # Hold centered hazza (0.6s)
        img = self.make_frame()
        self.draw_text(img, 'hazza', font_big, hazza_target_x, cy)
        self.emit_n(img, int(FPS * 0.6))
        self.advance(0.6)

        return hazza_target_x, hh

    def phase5_tagline(self, cy, hazza_x, hh):
        """'immediately useful names' fades in below hazza"""
        tag = 'immediately useful names'
        ttw, _ = self.ts(tag, font_tag)
        tx = (W - ttw) // 2
        ty = cy + hh + 100  # increased gap from hazza

        # Fade in tagline (0.6s)
        n_frames = int(FPS * 0.6)
        for f in range(n_frames):
            t = ease_out_cubic(f / max(n_frames - 1, 1))
            img = self.make_frame()
            self.draw_text(img, 'hazza', font_big, hazza_x, cy)
            self.draw_text(img, tag, font_tag, tx, ty, WHITE, t * 0.85)
            self.emit(img)
        self.advance(0.6)

        # Hold (1.5s)
        img = self.make_frame()
        self.draw_text(img, 'hazza', font_big, hazza_x, cy)
        self.draw_text(img, tag, font_tag, tx, ty, WHITE, 0.85)
        self.emit_n(img, int(FPS * 1.5))
        self.advance(1.5)

        return tx, ty, tag

    def phase6_final_h(self, cy, hazza_x, tx, ty, tag):
        """Fade azza + tagline, slide h to center, pop disappear"""
        h_w, _ = self.ts('h', font_big)
        azza_x = hazza_x + h_w

        # Fade "azza" + tagline simultaneously (0.7s)
        n_frames = int(FPS * 0.7)
        for f in range(n_frames):
            t = f / max(n_frames - 1, 1)
            fade = 1 - ease_out_cubic(t)
            img = self.make_frame()
            self.draw_text(img, 'h', font_big, hazza_x, cy)
            self.draw_text(img, 'azza', font_big, azza_x, cy, WHITE, fade)
            self.draw_text(img, tag, font_tag, tx, ty, WHITE, fade * 0.85)
            self.emit(img)
        self.advance(0.7)

        # Brief hold of lone h (0.3s)
        img = self.make_frame()
        self.draw_text(img, 'h', font_big, hazza_x, cy)
        self.emit_n(img, int(FPS * 0.3))
        self.advance(0.3)

        # Slide h to true center (1.0s) — smooth ease in-out
        target_x = (W - h_w) // 2
        target_y = (H - self.ts('h', font_big)[1]) // 2
        start_x = hazza_x
        start_y = cy

        n_frames = int(FPS * 1.0)
        for f in range(n_frames):
            t = ease_in_out_cubic(f / max(n_frames - 1, 1))
            cur_x = start_x + (target_x - start_x) * t
            cur_y = start_y + (target_y - start_y) * t
            img = self.make_frame()
            self.draw_text(img, 'h', font_big, int(cur_x), int(cur_y))
            self.emit(img)
        self.advance(1.0)

        # Hold centered h (0.8s)
        img = self.make_frame()
        self.draw_text(img, 'h', font_big, target_x, target_y)
        self.emit_n(img, int(FPS * 0.8))
        self.advance(0.8)

        # Pop! — h scales up and fades (0.5s for visibility, no sound)
        pop_dur = 0.5
        n_frames = int(FPS * pop_dur)
        for f in range(n_frames):
            t = f / max(n_frames - 1, 1)
            # Scale: 1.0 → 1.6x
            scale = 1.0 + ease_out_cubic(t) * 0.6
            # Alpha: hold visible longer, then drop
            # Use quadratic ease so it stays visible for first 60% of animation
            if t < 0.4:
                alpha = 1.0
            else:
                fade_t = (t - 0.4) / 0.6
                alpha = 1.0 - ease_out_cubic(fade_t)

            scaled_size = max(10, int(96 * scale))
            scaled_font = ImageFont.truetype(FONT_PATH, scaled_size)
            sw, sh = self.ts('h', scaled_font)
            sx = (W - sw) // 2
            sy = (H - sh) // 2
            img = self.make_frame()
            self.draw_text(img, 'h', scaled_font, sx, sy, WHITE, alpha)
            self.emit(img)
        self.advance(pop_dur)

        # Brief red hold to end (0.6s)
        self.emit_n(self.make_frame(), int(FPS * 0.6))
        self.advance(0.6)

    def generate_audio(self):
        """Generate audio WAV"""
        video_dur = self.frame_count / FPS
        total_samples = int(SR * video_dur) + SR
        audio = np.zeros(total_samples, dtype=np.float32)

        # Ambient pad — builds through the name roll, calms at the end
        n = int(SR * video_dur)
        t = np.linspace(0, video_dur, n, dtype=np.float32)
        pad = np.zeros(n, dtype=np.float32)
        for freq in [130.81, 196.00, 261.63, 329.63]:
            pad += np.sin(2 * np.pi * freq * t)
        pad *= 0.025 / 4

        # Envelope: build up through names, peak at ~45%, gentle decline
        env = np.ones(n, dtype=np.float32)
        pk = int(n * 0.45)
        cl = int(n * 0.75)
        env[:pk] = np.linspace(0, 1, pk, dtype=np.float32)
        env[cl:] = np.linspace(1, 0, n - cl, dtype=np.float32)
        pad *= env
        mix_at(audio, pad, 0)

        # Mix in audio events
        swell_start = None
        for ts, etype, params in self.audio_events:
            off = int(ts * SR)
            if etype == 'tick':
                mix_at(audio, gen_tick(params.get('pitch', 800), params.get('vol', 0.08)), off)
            elif etype == 'swell':
                swell_start = ts

        # Swell layer: warm harmonic rise from reveal to end
        if swell_start is not None:
            swell_dur = video_dur - swell_start
            sn = int(SR * swell_dur)
            st = np.linspace(0, swell_dur, sn, dtype=np.float32)

            # Layered harmonics: root, fifth, octave, slight detune for warmth
            swell = np.zeros(sn, dtype=np.float32)
            base_freq = 146.83  # D3
            harmonics = [
                (base_freq,        0.30),  # root
                (base_freq * 1.01, 0.15),  # slight detune for chorus
                (base_freq * 1.5,  0.25),  # fifth (A3)
                (base_freq * 2.0,  0.20),  # octave (D4)
                (base_freq * 3.0,  0.10),  # fifth above octave
            ]
            for freq, amp in harmonics:
                swell += np.sin(2 * np.pi * freq * st) * amp

            # Envelope: slow rise (2s) → peak hold (~3s) → gentle decay to end
            swell_env = np.ones(sn, dtype=np.float32)
            rise_n = min(int(SR * 2.0), sn)
            # Use sine curve for smooth rise
            swell_env[:rise_n] = np.sin(np.linspace(0, np.pi / 2, rise_n, dtype=np.float32))

            # Peak region: stays at 1.0 for ~3s after rise
            peak_end = min(rise_n + int(SR * 3.0), sn)
            # swell_env[rise_n:peak_end] already 1.0

            # Gentle decay from peak to end
            if peak_end < sn:
                decay_n = sn - peak_end
                swell_env[peak_end:] = np.cos(np.linspace(0, np.pi / 2, decay_n, dtype=np.float32))

            swell *= swell_env * 0.06  # subtle volume
            mix_at(audio, swell, int(swell_start * SR))

        # Normalize
        peak = np.max(np.abs(audio))
        if peak > 0:
            audio = audio / peak * 0.85

        # Ensure audio covers full video
        video_samples = int(self.frame_count / FPS * SR) + SR
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

    def run_phases(self):
        self.phase0_pause()
        self.phase1_roll_names()
        cy, th = self.phase2_backspace()
        fx = self.phase3_type_everyone(cy, th)
        hazza_x, hh = self.phase4_isolate_hazza(cy, fx)
        tx, ty, tag = self.phase5_tagline(cy, hazza_x, hh)
        self.phase6_final_h(cy, hazza_x, tx, ty, tag)

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
        self.current_time = 0.0
        self.audio_events = []

        print("Rendering frames...")
        self.run_phases()
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
