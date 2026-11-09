"""Author the Mercury livery atlas locally; no reference photograph is embedded."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SIZE = 2048
im = Image.new('RGB', (SIZE, SIZE), '#f1f2ed')
d = ImageDraw.Draw(im)
REGIONS = {}
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
LIGHT = '/System/Library/Fonts/HelveticaNeue.ttc'

def label(key, rect, text, bg='#f1f2ed', fg='#14191d', bold=False, pad=12):
    x,y,w,h = rect
    d.rectangle((x,y,x+w,y+h), fill=bg)
    size = int(h*.82)
    while True:
        font = ImageFont.truetype(BOLD if bold else FONT, size)
        bb = d.textbbox((0,0),text,font=font)
        if bb[2]-bb[0] <= w-2*pad and bb[3]-bb[1] <= h-2*pad: break
        size -= 1
    d.text((x+(w-bb[2]+bb[0])/2,y+(h-bb[3]+bb[1])/2-bb[1]), text, font=font, fill=fg)
    REGIONS[key]=rect

# The broad wordmark is bitmap artwork, not extruded text geometry.
label('uber',(16,16,2016,340),'Uber Boat',pad=24)
wordmark=Image.new('RGB',(1900,350),'#f1f2ed')
wd=ImageDraw.Draw(wordmark)
uber_font=ImageFont.truetype(LIGHT,320,index=1)
boat_font=ImageFont.truetype(LIGHT,320,index=7)
wd.text((0,-15),'Uber',font=uber_font,fill='#101418')
uber_width=wd.textlength('Uber',font=uber_font)
wd.text((uber_width+60,-15),'Boat',font=boat_font,fill='#101418')
bb=Image.eval(wordmark.convert('L'),lambda v:255-v).point(lambda v:255 if v>40 else 0).getbbox()
im.paste(wordmark.crop(bb).resize((1900,304),Image.Resampling.LANCZOS),(74,34))
label('by',(16,380,1500,140),'by thames clippers',bold=True)
label('by_white',(16,540,1500,140),'by thames clippers',bg='#242a30',fg='#f1f2ed',bold=True)
label('mercury',(16,700,1000,180),'Mercury Clipper',bg='#242a30',fg='#ffffff')
label('welcome',(1040,700,960,100),'Welcome aboard',bg='#242a30',fg='#ffffff')
label('route',(16,900,800,140),'RB1  Battersea',bg='#14191d',fg='#ffffff')
label('depth',(840,900,300,140),'1M2',bg='#00566b',fg='#ffffff',bold=True)
label('safety',(1160,900,400,140),'LIFE RAFT',bold=True)
label('exit',(1600,900,400,140),'EXIT  →',bg='#1a7954',fg='#ffffff',bold=True)

colors={'white':'#f1f2ed','teal':'#00566b','red':'#ec283e','orange':'#fb641b',
        'blue':'#24647f','black':'#242a30','yellow':'#f1cf43','green':'#188d64',
        'light':'#c4d6da','dark':'#0c131a','silver':'#9ba7aa','cyan':'#00b7cc'}
for i,(name,color) in enumerate(colors.items()):
    x=16+(i%6)*336; y=1720+(i//6)*150
    d.rectangle((x,y,x+304,y+130),fill=color)
    REGIONS[name]=(x+10,y+10,284,110)

# Wave badge, Union Flag, and Red Ensign are original raster constructions.
REGIONS['waves']=(16,1080,340,310)
d.rectangle((16,1080,356,1390),fill='#242a30')
for yy in (1120,1200,1280):
    d.line([(66,yy),(112,yy+34),(162,yy),(212,yy+34),(262,yy)], fill='#00b7cc',width=25,joint='curve')

def flag(x,y,w,h):
    d.rectangle((x,y,x+w,y+h),fill='#183463')
    d.line([(x,y),(x+w,y+h)],fill='white',width=int(h*.23))
    d.line([(x+w,y),(x,y+h)],fill='white',width=int(h*.23))
    d.line([(x,y),(x+w,y+h)],fill='#cf193b',width=int(h*.08))
    d.line([(x+w,y),(x,y+h)],fill='#cf193b',width=int(h*.08))
    d.rectangle((x+w*.40,y,x+w*.60,y+h),fill='white')
    d.rectangle((x,y+h*.33,x+w,y+h*.67),fill='white')
    d.rectangle((x+w*.44,y,x+w*.56,y+h),fill='#cf193b')
    d.rectangle((x,y+h*.40,x+w,y+h*.60),fill='#cf193b')
flag(400,1080,600,300); REGIONS['union']=(400,1080,600,300)
d.rectangle((1040,1080,1640,1380),fill='#bd1733')
flag(1040,1080,300,150); REGIONS['ensign']=(1040,1080,600,300)
label('raft_brand',(16,1450,800,130),'RESCUE EQUIPMENT',bold=True)
label('mercury_small',(840,1450,1160,130),'MERCURY CLIPPER',bold=True)
ROOT.joinpath('textures').mkdir(exist_ok=True)
im.save(ROOT/'textures/mercury_atlas.png',optimize=True)
(ROOT/'textures/atlas_regions.json').write_text(json.dumps(REGIONS,indent=2)+'\n')
assert im.size==(2048,2048) and len(REGIONS)==26
print(f'Atlas: {SIZE}², {len(REGIONS)} regions, {(ROOT/"textures/mercury_atlas.png").stat().st_size:,} bytes')
