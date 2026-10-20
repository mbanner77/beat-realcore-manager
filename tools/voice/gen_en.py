import json, re, wave, subprocess, hashlib, os, sys
from piper import PiperVoice, SynthesisConfig
from num2words import num2words
import sys
LANG='en'
lines = json.load(open('mgr/lines_en.json'))
PRON = [
 (r'S/4HANA', 'S four HANA'), (r'\bR/3\b', 'R three'), (r'\bST22\b', 'S T twenty-two'), (r'AI4BIZ', 'A I for Biz'),
 (r'\bABAP\b', 'ah-bap'), (r'\bBTP\b', 'B T P'), (r'\bCPI\b', 'C P I'), (r'\bSAP\b', 'S A P'), (r'\bAI\b', 'A I'), (r'\bIT\b', 'I T'), (r'\bUI\b', 'U I'),
 (r'Z-reports', 'zee reports'), (r'TechHub', 'Tech Hub'), (r'RealCore', 'Real Core'), (r'Kyma', 'Keema'), (r'Nordwerk', 'Nord-vairk'), (r'Joule', 'Jool'),
 (r'Hypercare', 'Hyper-care'), (r'hypercare', 'hyper-care'), (r'Essen', 'Essen'), (r'COBOL', 'Co-ball'),
]
def norm(t):
    t = re.sub(r'^(Lena|Legacy-KI|Legacy AI): ', '', t)
    t = t.replace('–', ',').replace('“', '').replace('”', '').replace('…', '.').replace('„', '').replace('“', '').replace('%', ' percent')
    for a, b in PRON: t = re.sub(a, b, t)
    t = re.sub(r'(\d{1,3})[,.](\d{3})', lambda m: m.group(1) + m.group(2), t)
    t = re.sub(r'\d+', lambda m: num2words(int(m.group(0)), lang='en') if not (1900 <= int(m.group(0)) <= 2099) else num2words(int(m.group(0)), lang='en', to='year'), t)
    return t
V = {}
def voice(n):
    if n not in V: V[n] = PiperVoice.load(n + '.onnx')
    return V[n]
CFG = {
 'lena': ('en/en_US-hfc_female-medium', None, 1.0, 'highpass=f=110,lowpass=f=7800,equalizer=f=3000:t=q:w=1:g=3,acompressor=threshold=-18dB:ratio=3,volume=1.6'),
 'sys': ('en/en_GB-alan-medium', None, 1.0, 'highpass=f=110,lowpass=f=9500,equalizer=f=2800:t=q:w=1.2:g=3,acompressor=threshold=-20dB:ratio=3,volume=1.4'),
 'narr': ('en/en_US-ryan-high', None, 1.1, 'highpass=f=60,equalizer=f=120:t=q:w=1:g=4,acompressor=threshold=-20dB:ratio=3,aecho=0.8:0.5:45:0.12,volume=1.5'),
 'legacy': ('en/en_US-ryan-high', None, 1.08, 'asetrate=22050*0.86,aresample=44100,atempo=1.1628,flanger=delay=1.5:depth=1.5:speed=0.35,acrusher=bits=11:mode=log:aa=1:mix=0.2,aecho=0.8:0.6:70|140:0.28|0.16,lowpass=f=6500,volume=1.7'),
 'unit_inf': ('en/en_US-ryan-high', None, 1.0, 'highpass=f=200,lowpass=f=5200,equalizer=f=2500:t=q:w=1:g=4,acompressor=threshold=-20dB:ratio=3,volume=2.0'),
 'unit_veh': ('en/en_GB-alan-medium', None, 1.0, 'highpass=f=200,lowpass=f=5200,equalizer=f=2500:t=q:w=1:g=4,acompressor=threshold=-20dB:ratio=3,volume=2.0'),
 'unit_air': ('en/en_US-amy-medium', None, 1.0, 'highpass=f=200,lowpass=f=5200,equalizer=f=2500:t=q:w=1:g=4,acompressor=threshold=-20dB:ratio=3,volume=2.0'),
 'unit_at': ('en/en_US-ryan-high', None, 1.0, 'highpass=f=200,lowpass=f=5200,equalizer=f=2500:t=q:w=1:g=4,acompressor=threshold=-20dB:ratio=3,volume=2.0'),
}
OUT='/home/claude/beat-realcore-manager/public/audio/voice/en'; os.makedirs(OUT, exist_ok=True); os.makedirs('mgr/gen_en', exist_ok=True); manifest = {}
TARGET = -15.0  # LUFS
for L in lines:
    model, sid, ls, af = CFG[L['who']]
    key = hashlib.sha1((L['who'] + L['text']).encode()).hexdigest()[:10]
    wav = f'mgr/gen_en/{key}.wav'; mp3 = f'{OUT}/{key}.mp3'
    ns, nw = (0.4, 0.55) if model.startswith('de_DE-eva') else (0.6, 0.8)  # Eva: weniger Variation = sauberere Aussprache
    cfg = SynthesisConfig(speaker_id=sid, length_scale=ls, noise_scale=ns, noise_w_scale=nw)
    with wave.open(wav, 'wb') as w: voice(model).synthesize_wav(norm(L['text']), w, syn_config=cfg)
    # 1. Effekte anwenden, 2. Lautheit messen, 3. linear auf Ziel-Lautheit bringen (alle Stimmen gleich laut)
    mid = f'mgr/gen_en/{key}_fx.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', af + ',silenceremove=start_periods=1:start_threshold=-62dB,adelay=60,apad=pad_dur=0.15', '-ac', '1', '-ar', '44100', mid], check=True)
    meas = subprocess.run(['ffmpeg', '-hide_banner', '-i', mid, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', meas)[-1])
    gain = TARGET - I
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mid, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.89:attack=3:release=60:level=disabled', '-ac', '1', '-ar', '44100', '-b:a', '64k', mp3], check=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], capture_output=True, text=True).stdout)
    manifest[L['text']] = {'f': key + '.mp3', 'd': round(dur, 2), 'w': L['who']}
    print(L['who'], round(dur, 1), norm(L['text'])[:90], flush=True)
json.dump(manifest, open(f'{OUT}/manifest.json', 'w'), ensure_ascii=False, indent=0)
