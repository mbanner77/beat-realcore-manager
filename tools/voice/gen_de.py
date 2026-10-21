import json, re, wave, subprocess, hashlib, os, sys
from piper import PiperVoice, SynthesisConfig
from num2words import num2words
import sys
LANG=sys.argv[1]
lines = json.load(open(f'mgr/lines_{LANG}.json'))
PRON = [
 (r'Legacy League', '[[ lˈɛɡəsi lˈiːk ]]'), (r'\bFax\b', '[[ fˈaks ]]'), (r'Legacy-Monolith FC', '[[ lˈɛɡəsi ]] Monoliet Eff-Zeh'), (r'United', 'Junaited'), (r'deployed', 'diploit'), (r'Clubs', 'Klabs'), (r'Monolithen', 'Monolieten'), (r'Monolith', 'Monoliet'), (r'Data Lake GmbH', 'Däta Leik Geh-Em-Beh-Hah'), (r'Ticketflut', 'Tickettflut'), (r'S/4HANA', 'Ess-vier-Hana'), (r'\bR/3\b', 'Er drei'), (r'\bST22\b', 'Ess Teh zweiundzwanzig'), (r'AI4BIZ', 'Äi for Bis'),
 (r'Never touch a running system', 'Näwwer tatsch ä ranning Sisstem'), (r'Change Advisory Board', 'Tschäinsch Edweisori Bord'),
 (r'Change[- ]Requests', 'Tschäinsch-Rikwests'), (r'Change[- ]Request', 'Tschäinsch-Rikwest'),
 (r'Release-Freeze', 'Rilies-Friehs'), (r'Clean Core', 'Kliehn-Kohr'), (r'RealCore', 'Riel-Kohr'), (r'TechHub', 'Tech-Hab'),
 (r'Go-Live', 'Go-Leif'), (r'Joule', 'Dschul'), (r'Mainframes', 'Mehn-Frehms'), (r'Mainframe', 'Mehn-Frehm'),
 (r'Batchlauf', 'Bätsch-Lauf'), (r'Batch', 'Bätsch'), (r'Schatten-IT', 'Schatten-I-Teh'), (r'Legacy-IT', '[[ lˈɛɡəsi ]] I-Teh'), (r'Legacy-KI', '[[ lˈɛɡəsi ]] Ka-I'),
 (r'Upgrade', 'App-Gräid'), (r'Monolith erwacht', 'Mono-Liet erwacht'), (r'Legacy', '[[ lˈɛɡəsi ]]'), (r'Access', 'Äkzess'), (r'Controlling', 'Kontrolling'), (r'Deployment', 'Diploiment'), (r'deployt', 'diploit'),
 (r'Meeting-Camps?', 'Mieting-Kämp'), (r'Meeting', 'Mieting'), (r'Hypercare', 'Heiper-Kehr'), (r'Jour fixe', 'Schur fix'), (r'Templates?', 'Tämplet'), (r'Datenrennen', 'Daten-Rennen'),
 (r'Rollout', 'Rollaut'), (r'\bUI\b', 'U I'), (r'Integration Suite', 'Integrehschen Swiet'), (r'Data Lake', 'Däta Leik'),
 (r'Datenpipelines', 'Datenpeiplains'), (r'Datenpipeline', 'Datenpeiplain'), (r'Pipeline', 'Peiplain'), (r'Onboarding', 'Onbording'),
 (r'Dump', 'Damp'), (r'Lotus Notes', 'Lotus Nouts'), (r'COBOL', 'Kobol'), (r'Security', 'Sikjuriti'), (r'Z-Reports', 'Zett-Reports'), (r'Z-Report', 'Zett-Report'),
 (r'Z-Programme', 'Zett-Programme'), (r'\bBTP\b', 'Beh-Teh-Peh'), (r'\bCPI\b', 'Zeh-Peh-I'), (r'\bABAP\b', 'Abapp'), (r'\bSAP\b', 'Ess-A-Peh'),
 (r'\bKI\b', 'Ka-I'), (r'\bIT\b', 'I-Teh'), (r'Core', 'Kohr'), (r'Excel', 'Exel'), (r'Hub', 'Hab'), (r'Fiori', 'Fiori'), (r'Tickets?', lambda m: m.group(0)),
 (r'Hotfix', 'Hottfix'), (r'touche', 'tatsche'), (r'Trainee', 'Trehnie'), (r'Academy', 'Äkädemi'), (r'Touchscreen', 'Tatsch-Skrien'), (r'Jets', 'Dschetts'), (r'Post-it', 'Post-itt'), (r'Spaghetti', 'Spagetti'), (r'Wars', 'Woors'), (r'Beat', 'Biet'), (r'Team', 'Tiem'), (r'Doku', 'Doku'), (r'Tests', 'Tests'), (r'Makros', 'Makros'),
]
def norm(t):
    t = re.sub(r'^(Lena|Legacy-KI|Legacy AI): ', '', t)
    t = t.replace('–', ',').replace('…', '.').replace('„', '').replace('“', '').replace('%', ' Prozent')
    for a, b in PRON: t = re.sub(a, b, t)
    t = re.sub(r'(\d{1,3})\.(\d{3})', lambda m: m.group(1) + m.group(2), t)
    t = re.sub(r'\d+', lambda m: num2words(int(m.group(0)), lang='de') if not (1900 <= int(m.group(0)) <= 2099) else num2words(int(m.group(0)), lang='de', to='year'), t)
    return t
V = {}
def voice(n):
    if n not in V: V[n] = PiperVoice.load(n + '.onnx')
    return V[n]
CFG = {
 'lena': ('de_DE-eva_k-x_low', None, 1.08, 'highpass=f=110,lowpass=f=7800,equalizer=f=3000:t=q:w=1:g=3,acompressor=threshold=-18dB:ratio=3,volume=1.6'),
 'sys': ('de_DE-thorsten-high', None, 1.0, 'highpass=f=110,lowpass=f=9500,equalizer=f=2800:t=q:w=1.2:g=3,acompressor=threshold=-20dB:ratio=3,volume=1.4'),
 'narr': ('de_DE-thorsten-high', None, 1.12, 'highpass=f=60,equalizer=f=120:t=q:w=1:g=4,acompressor=threshold=-20dB:ratio=3,aecho=0.8:0.5:45:0.12,volume=1.5'),
 'legacy': ('de_DE-thorsten_emotional-medium', 1, 1.1, 'asetrate=22050*0.86,aresample=44100,atempo=1.1628,flanger=delay=1.5:depth=1.5:speed=0.35,acrusher=bits=11:mode=log:aa=1:mix=0.2,aecho=0.8:0.6:70|140:0.28|0.16,lowpass=f=6500,volume=1.7'),
 'unit_inf': ('de_DE-thorsten-high', None, 1.05, 'highpass=f=200,lowpass=f=5200,equalizer=f=2500:t=q:w=1:g=4,acompressor=threshold=-20dB:ratio=3,volume=2.0'),
 'unit_veh': ('de_DE-thorsten-high', None, 1.0, 'highpass=f=200,lowpass=f=5200,equalizer=f=2500:t=q:w=1:g=4,acompressor=threshold=-20dB:ratio=3,volume=2.0'),
 'unit_air': ('de_DE-eva_k-x_low', None, 1.08, 'highpass=f=200,lowpass=f=5200,equalizer=f=2500:t=q:w=1:g=4,acompressor=threshold=-20dB:ratio=3,volume=2.0'),
 'unit_at': ('de_DE-thorsten-high', None, 1.0, 'highpass=f=200,lowpass=f=5200,equalizer=f=2500:t=q:w=1:g=4,acompressor=threshold=-20dB:ratio=3,volume=2.0'),
}
OUT=f'/home/claude/beat-realcore-manager/public/audio/voice/{LANG}'; os.makedirs(OUT, exist_ok=True); os.makedirs('mgr/gen', exist_ok=True); manifest = {}
TARGET = -15.0  # LUFS
for L in lines:
    model, sid, ls, af = CFG[L['who']]
    key = hashlib.sha1((L['who'] + L['text']).encode()).hexdigest()[:10]
    wav = f'mgr/gen/{key}.wav'; mp3 = f'{OUT}/{key}.mp3'
    ns, nw = (0.4, 0.55) if model.startswith('de_DE-eva') else (0.6, 0.8)  # Eva: weniger Variation = sauberere Aussprache
    cfg = SynthesisConfig(speaker_id=sid, length_scale=ls, noise_scale=ns, noise_w_scale=nw)
    with wave.open(wav, 'wb') as w: voice(model).synthesize_wav(norm(L['text']), w, syn_config=cfg)
    # 1. Effekte anwenden, 2. Lautheit messen, 3. linear auf Ziel-Lautheit bringen (alle Stimmen gleich laut)
    mid = f'mgr/gen/{key}_fx.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', af + ',silenceremove=start_periods=1:start_threshold=-62dB,adelay=60,apad=pad_dur=0.15', '-ac', '1', '-ar', '44100', mid], check=True)
    meas = subprocess.run(['ffmpeg', '-hide_banner', '-i', mid, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', meas)[-1])
    gain = TARGET - I
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mid, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.89:attack=3:release=60:level=disabled', '-ac', '1', '-ar', '44100', '-b:a', '64k', mp3], check=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], capture_output=True, text=True).stdout)
    manifest[L['text']] = {'f': key + '.mp3', 'd': round(dur, 2), 'w': L['who']}
    print(L['who'], round(dur, 1), norm(L['text'])[:90], flush=True)
json.dump(manifest, open(f'{OUT}/manifest.json', 'w'), ensure_ascii=False, indent=0)
