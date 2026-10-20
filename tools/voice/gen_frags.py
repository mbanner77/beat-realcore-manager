# Erzeugt die Kommentar-Teilstücke (Satzteile, Namen, Zahlen) mit Piper: python3 gen_frags.py de|en
# Läuft im Ordner mit den Piper-Modellen (de_DE-thorsten-high.onnx, en/en_US-ryan-high.onnx).
import json, re, wave, subprocess, hashlib, os, sys
from multiprocessing import Pool
from num2words import num2words
LANG = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'public', 'audio', 'voice', LANG, 'c')
SRC = open(os.path.join(HERE, 'gen_de.py' if LANG == 'de' else 'gen_en.py'), encoding='utf-8').read()
ns = {'re': re, 'num2words': num2words}
exec(SRC[SRC.index('PRON = ['):SRC.index('V = {}')], ns)  # PRON + norm() aus dem Hauptskript
NAMES_DE = [(r'Firewall', 'Feierwoll'), (r'Gateway', 'Gehtwäi'), (r'Kyma', 'Kima'), (r'Max Mech', 'Max Meck'), (r'Ops-Center', 'Opps-Senter'), (r'Service-Center', 'Sörwis-Senter'),
  (r'Pipeline', 'Peiplein'), (r'Security-Analyst', 'Sikjuriti-Analüst'), (r'Interface', 'Interfeis'), (r'Kickers', 'Kickers'), (r'Terraform', 'Terraform'), (r'Kubernetes', 'Kubernetes'),
  (r'Native', 'Nehtiv'), (r'OAuth', 'O-Auth'), (r'Low-Code', 'Lo-Kohd'), (r'Yaml', 'Jammel'), (r'Quantum', 'Kwantum'), (r'Datasphere', 'Dätasfir'), (r'Governance', 'Gawwernens'),
  (r'Timeout', 'Teim-aut'), (r'Flat-File', 'Flätt-Feil'), (r'Mapping', 'Mäpping'), (r'Middleware', 'Middelwähr'), (r'IDoc', 'Ei-Dock'), (r'P2P', 'Peh-zu-Peh'), (r'Incident', 'Inzident'),
  (r'Reopen', 'Ri-open'), (r'Deadline', 'Dädlein'), (r'Hotline', 'Hottlein'), (r'Never-Touch', 'Näwwer-Tatsch'), (r'Running-System', 'Ranning-Sistem'), (r'Uptime', 'App-Teim'), (r'Root', 'Ruht'),
  (r'Kernel', 'Körnel'), (r'Young', 'Jang'), (r'Trainee', 'Trehnie'), (r'Newbie', 'Njubi'), (r'Monitoring', 'Monitoring'), (r'Final Finn', 'Feinel Finn'), (r'Pivot', 'Piwott')]
MODEL, LS, AF = ('de_DE-thorsten-high', 0.98, 'highpass=f=80,equalizer=f=2800:t=q:w=1.2:g=2,acompressor=threshold=-20dB:ratio=3') if LANG == 'de' else ('en/en_US-ryan-high', 0.98, 'highpass=f=80,equalizer=f=2800:t=q:w=1.2:g=2,acompressor=threshold=-20dB:ratio=3')
TRIM = 'silenceremove=start_periods=1:start_threshold=-60dB,areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse,adelay=20,apad=pad_dur=0.03'
def spoken(item):
    t = item['text']
    if item['key'].startswith('z:'): return num2words(int(t), lang=LANG)
    if LANG == 'de' and t == 'TechHub': return 'Teck-Hab Junaited'
    if LANG == 'de':
        for a, b in NAMES_DE: t = re.sub(a, b, t)
    return ns['norm'](t)
VOICE = None
def synth(item, path):
    global VOICE
    from piper import PiperVoice, SynthesisConfig
    if VOICE is None: VOICE = PiperVoice.load(MODEL + '.onnx')
    cfg = SynthesisConfig(length_scale=LS * (1.06 if item['key'][:2] in ('n:', 'z:') else 1), noise_scale=0.6, noise_w_scale=0.75)
    with wave.open(path, 'wb') as w: VOICE.synthesize_wav(spoken(item), w, syn_config=cfg)
def lufs(path):
    m = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', m)[-1])
def work(args):
    item, gain = args
    key = hashlib.sha1((LANG + item['key']).encode()).hexdigest()[:10]
    wav = f'/tmp/frag_{LANG}_{key}.wav'; mp3 = os.path.join(OUT, key + '.mp3')
    synth(item, wav)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', f'{AF},{TRIM},volume={gain:.2f}dB,alimiter=limit=0.89:level=disabled', '-ac', '1', '-ar', '44100', '-b:a', '48k', mp3], check=True)
    os.remove(wav)
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], capture_output=True, text=True).stdout)
    return item['key'], {'f': key + '.mp3', 'd': round(d, 3)}
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    items = json.load(open(os.path.join(HERE, f'frags_{LANG}.json'), encoding='utf-8'))
    # Kalibrierung: alle Teilstücke mit derselben Verstärkung (gleichmäßige Lautstärke beim Zusammensetzen)
    cal = {'key': 'f:cal', 'text': 'Tor für den Verein! Der Ball liegt im Netz, die Abwehr stand nicht sauber, und das Publikum jubelt laut.' if LANG == 'de' else 'Goal for the club! The ball is in the net, the defence was not clean, and the crowd is cheering loudly.'}
    synth(cal, '/tmp/cal.wav'); subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '/tmp/cal.wav', '-af', AF, '/tmp/cal_fx.wav'], check=True)
    gain = -15.0 - lufs('/tmp/cal_fx.wav')
    with Pool(2) as pool: res = pool.map(work, [(it, gain) for it in items], chunksize=8)
    man = dict(res)
    keep = set(v['f'] for v in man.values())
    for f in os.listdir(OUT):
        if f.endswith('.mp3') and f not in keep: os.remove(os.path.join(OUT, f))
    json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(LANG, len(man), 'gain', round(gain, 1))
