import json, numpy as np
from PIL import Image
S=1024
tris=json.load(open('/tmp/claude-0/ubc_tris.json'))
Z=np.full((S,S),255,np.uint8)
def region(c,h,ax,fw):
    if c==3: return 8
    if c==2: return 7
    if c==1: return 7 if ax>0.245 else (6 if ax>0.228 else 0)
    if c==4 and h>0.80: return 5 if (h>0.935 and fw<0.055) else 3
    if h>0.815: return 3
    if h>0.53: return 0
    if h>0.415: return 1
    if h>0.30: return 3
    if h>0.282: return 6
    if h>0.055: return 2
    return 4
for t in tris:
    c=t[0]; P=np.array([[t[1+i*5],t[2+i*5]] for i in range(3)])*S; A=np.array([t[3+i*5:6+i*5] for i in range(3)])
    x0,y0=np.floor(P.min(0)).astype(int); x1,y1=np.ceil(P.max(0)).astype(int)
    x0,y0=max(x0,0),max(y0,0); x1,y1=min(x1,S-1),min(y1,S-1)
    if x1<x0 or y1<y0: continue
    xs,ys=np.meshgrid(np.arange(x0,x1+1)+0.5,np.arange(y0,y1+1)+0.5)
    (ax_,ay),(bx,by),(cx,cy)=P; den=(by-cy)*(ax_-cx)+(cx-bx)*(ay-cy)
    if abs(den)<1e-9: continue
    w0=((by-cy)*(xs-cx)+(cx-bx)*(ys-cy))/den; w1=((cy-ay)*(xs-cx)+(ax_-cx)*(ys-cy))/den; w2=1-w0-w1
    m=(w0>=-0.02)&(w1>=-0.02)&(w2>=-0.02)
    if not m.any(): continue
    vals=w0[...,None]*A[0]+w1[...,None]*A[1]+w2[...,None]*A[2]
    yy,xx=np.nonzero(m)
    for k in range(len(yy)):
        h,ax,fw=vals[yy[k],xx[k]]; Z[y0+yy[k],x0+xx[k]]=region(c,h,ax,fw)
for it in range(8):
    m=Z==255
    if not m.any(): break
    for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
        sh=np.roll(np.roll(Z,dy,0),dx,1); f=m&(sh!=255); Z[f]=sh[f]; m=Z==255
Z[Z==255]=3
Image.fromarray((Z*16).astype(np.uint8)).save('/home/claude/beat-realcore-manager/public/models/hd/kit-zones.png', optimize=True)
pal=np.array([[60,220,130],[20,60,40],[60,220,130],[220,170,130],[20,20,20],[60,40,20],[255,255,255],[230,180,140],[240,200,160]],np.uint8)
Image.fromarray(pal[np.clip(Z,0,8)]).resize((512,512)).save('/tmp/claude-0/rigtest/zones.png')
print('ok')
