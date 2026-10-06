from PIL import Image, ImageDraw, ImageFont, ImageFilter
F='/System/Library/Fonts/Avenir Next.ttc'
def font(i,s): return ImageFont.truetype(F,s,index=i)
BOLD,MED,REG,DEMI=0,5,7,2
W,H=1280,720
def tracked(d,xy,text,f,fill,track=0):
    x,y=xy
    for c in text:
        d.text((x,y),c,font=f,fill=fill); x+=f.getlength(c)+track
def wrap(d,text,f,maxw):
    words=text.split(); lines=[]; cur=''
    for w in words:
        t=(cur+' '+w).strip()
        if d.textlength(t,font=f)<=maxw: cur=t
        else: lines.append(cur); cur=w
    lines.append(cur); return lines
def card(d,x,y,w,h,title,body,bg,border,tc,bc,accent):
    d.rounded_rectangle((x,y,x+w,y+h),radius=18,fill=bg,outline=border,width=2)
    d.text((x+28,y+28),title,font=font(BOLD,26),fill=tc)
    for i,l in enumerate(wrap(d,body,font(REG,20),w-56)): d.text((x+28,y+78+i*30),l,font=font(REG,20),fill=bc)
cards=[('Exams, tests and tasks','Built once, saved as students work, and kept in one place.'),
       ('Results and report cards','Teachers mark, results release, report cards follow.'),
       ('Department analytics','Heads of department see how every class is performing.')]

def dark_content():
    im=Image.new('RGB',(W,H),(11,9,7)); g=Image.new('RGBA',(W,H),(0,0,0,0)); ImageDraw.Draw(g).ellipse((W*0.15,-H*0.5,W*0.95,H*0.55),fill=(212,118,42,70)); g=g.filter(ImageFilter.GaussianBlur(120))
    im=Image.alpha_composite(im.convert('RGBA'),g).convert('RGB'); d=ImageDraw.Draw(im)
    tracked(d,(80,74),'SMART ASSESS',font(BOLD,22),(236,146,74),6)
    d.text((80,120),'Measure learning.',font=font(BOLD,64),fill=(246,237,224))
    d.text((80,215),'Everything a school assesses, in one secure place.',font=font(MED,26),fill=(190,176,156))
    for i,(t,b) in enumerate(cards): card(d,80+i*372,330,340,250,t,b,(24,19,14),(52,42,32),(246,237,224),(190,176,156),None)
    tracked(d,(80,652),'SMART ASSESS JA',font(BOLD,16),(130,116,98),4)
    return im
def light_content():
    im=Image.new('RGB',(W,H),(253,248,243)); d=ImageDraw.Draw(im)
    tracked(d,(80,74),'SMART ASSESS',font(BOLD,22),(212,118,42),6)
    d.text((80,120),'Measure learning.',font=font(BOLD,64),fill=(30,18,8))
    d.text((80,215),'Everything a school assesses, in one secure place.',font=font(MED,26),fill=(107,79,53))
    for i,(t,b) in enumerate(cards): card(d,80+i*372,330,340,250,t,b,(255,255,255),(234,217,196),(30,18,8),(107,79,53),None)
    tracked(d,(80,652),'SMART ASSESS JA',font(BOLD,16),(160,128,96),4)
    return im
def dark_title():
    im=Image.new('RGB',(W,H),(11,9,7)); g=Image.new('RGBA',(W,H),(0,0,0,0)); ImageDraw.Draw(g).ellipse((W*0.2,H*0.1,W*0.8,H*1.1),fill=(212,118,42,80)); g=g.filter(ImageFilter.GaussianBlur(130))
    im=Image.alpha_composite(im.convert('RGBA'),g).convert('RGB'); d=ImageDraw.Draw(im)
    tracked(d,(80,250),'SMART ASSESS',font(BOLD,96),(236,146,74),12)
    d.text((80,380),'Measure learning.',font=font(MED,44),fill=(246,237,224))
    tracked(d,(80,640),'SMART ASSESS JA   |   BUILT FOR MANCHESTER HIGH SCHOOL',font(BOLD,15),(130,116,98),4)
    return im
tiles=[('A. Dark cinematic (matches the film)',dark_content()),('B. Light and warm (matches your website)',light_content()),
       ('C1. Mixed: dark for story and section openers',dark_title()),('C2. Mixed: light for the detail slides',light_content())]
S=Image.new('RGB',(2000,1180),(235,230,224)); d=ImageDraw.Draw(S)
for i,(label,im) in enumerate(tiles):
    x=20+(i%2)*990; y=20+(i//2)*580
    d.text((x,y),label,font=font(BOLD,24),fill=(30,18,8))
    S.paste(im.resize((960,540),Image.LANCZOS),(x,y+36))
S.save('style_samples.png'); print('ok')
