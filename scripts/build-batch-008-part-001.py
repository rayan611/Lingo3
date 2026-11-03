#!/usr/bin/env python3
"""Rebuild reviewed batch 008 from committed proposals, without external calls."""
import json,re,unicodedata,collections
from pathlib import Path
R=Path(__file__).resolve().parents[1]
DATA=R/'data/shared-vocab'
source=json.loads((DATA/'batch-008-part-001-lexin.json').read_text())
LANGS=['fa','en','sv','de','es','it']
pool={x['id']:x for x in source['selected']}
existing=[]
def key(h,l):
 h=unicodedata.normalize('NFC',' '.join(h.strip().split())).lower().replace('ي','ی').replace('ك','ک')
 return re.sub({'sv':r'^(en|ett|att) ','en':r'^(a|an|the|to) ','de':r'^(der|die|das) ','es':r'^(el|la|los|las) ','it':r'^(il|lo|la|le|gli|i) '}.get(l,r'(?!)'),'',h)
oldkeys={x['lemma_key'] for x in existing}
proposals={x['id']:(x['proposal'],x['provider'],x['request']) for x in source['selected']}
accepted=[];rejected=[];seen=set(oldkeys)
for id,(c,provider,file) in proposals.items():
 try:
  if id not in pool:raise ValueError('unknown source id')
  if provider in {'groq','mistral'}:raise ValueError('provider sample failed semantic quality review')
  if pool[id]['word'] in {'absolutism','acklamation','aktualitet','bisittare','brännvin','böckling','grävskopa','hållpunkt','imperfekt','kedjehus','kommunikationsmedel','korsdrag','kverulant','kärnmjölk','lantmäteri','lagerkrans','länsstyrelse','majstång','miljard','matvägrare','morgonsamling','målbrott','lipsill','mannagryn','olycksbarn','persedel','potpurri','påskrift','punktskatt','palsternacka','skohorn','skripta','rimfrost','servering','schäfer','segelflyg','sjukvårdare','sjukbidrag','sittning','semesterlön','sekelskifte','skoltermin','genomkörare','mellanstadium','mellanhavande','motorfordon','rundresa','rumänska','krigsmakt','mässling','rötmånad','rappakalja'}:raise ValueError('semantic review: sense mismatch or uncertain translation')
  if id=='core.n.lexin008_6ad03fa169661f26':raise ValueError('review: Spanish headword and example disagree')
  if not c.get('eligible'):raise ValueError('editor rejected: '+c.get('reason','unsuitable'))
  e=c['e'];assert set(e)==set(LANGS),'six-language completeness'
  e['fa'].pop('f',None)  # Persian has no grammatical gender; discard irrelevant provider field.
  if 'f' not in e['en'] and len(e['en'].get('n',''))>3:e['en']['f']={'kind':'noun'}
  assert e['sv']['h']==pool[id]['headword'],'Swedish source headword changed'
  e['sv']['f']=dict(pool[id]['form'])  # Source morphology is authoritative, never model-derived.
  if 'indefinitePlural' not in e['sv']['f']:e['sv'].setdefault('n','Lexin anger ingen pluralform i detta underlag.')
  de=e['de'];df=de.get('f',{});dh=de.get('h','')
  if not df.get('genitiveSingular') and df.get('gender') in ['der','die','das'] and dh.startswith(df['gender']+' '):
   base=dh.split(' ',1)[1];pl=df.get('plural','');g=df['gender']
   if ' ' in base and (g!='die' or base[0].islower()):raise ValueError('German multiword genitive needs review')
   if any(c in pl for c in ':|<>'):raise ValueError('Unprocessed German morphology')
   if g=='die':gen=base
   elif base in {'Gedanke','Glaube','Wille','Friede','Funke','Buchstabe','Same','Name'}:gen=base+'ns'
   elif base.endswith('name'):gen=base+'ns'
   elif base.endswith('ismus') or base in {'Fötus','Status','Rhythmus','Campus','Zirkus','Bonus','Fokus','Globus','Kaktus','Chaos'}:gen=base
   elif base.endswith('nis') or base.endswith('is') and pl==base+'se':gen=base+'ses'
   elif base in {'Atlas','Herz'}:gen={'Atlas':'Atlasses','Herz':'Herzens'}[base]
   elif re.search(r'[^aeiouäöüy]us$',base,re.I) and not base.lower().endswith('bus'):gen=base
   elif base.lower().endswith('bus'):gen=base+'ses'
   elif g=='der' and (base.endswith('mensch') or base=='Katholik'):gen=base+'en'
   elif g=='der' and base.lower().endswith('see'):gen=base+'s'
   elif g=='der' and pl in {base+'n',base+'en'} and base!='See' and base.endswith(('e','ant','ent','ist','at','nom','graf','arch','ot')):gen=pl
   else:gen=base+('es' if base.endswith(('s','ß','x','z')) else 's')
   df['genitiveSingular']=gen
  it=e['it'];h=it.get('h','');ig=it.get('f',{}).get('gender')
  if ig=='lo':it['f']['gender']='il';ig='il'  # lo is a phonetic masculine article, not a separate gender.
  if h.startswith(('il ','lo ','gli ','i ')) and ig!='il' or h.startswith(('la ','le ')) and ig!='la':raise ValueError('Italian article/gender conflict')
  es=e['es'];eh=es.get('h','');eg=es.get('f',{}).get('gender')
  if eh.startswith(('la ','las ')) and eg!='la' or eh.startswith('los ') and eg!='el':raise ValueError('Spanish article/gender conflict')
  if eh.startswith('el ') and eg=='la' and eh.split(' ')[1].lower() not in {'agua','águila','aula','alma','hacha','hambre','hada','ala','ansia','ancla','arma','arca','arpa','ascua','asa','acta','ánfora'}:raise ValueError('Spanish stressed-a article needs review')
  m=re.match(r"^(il |lo |la |l')(.+)$",h)
  if m and it.get('f',{}).get('gender') in ['il','la']:
   noun=m.group(2);g=it['f']['gender'];vowel=bool(re.match(r'[aeiouh]',noun,re.I))
   article="l'" if vowel else 'la ' if g=='la' else 'lo ' if re.match(r'(?:z|gn|ps|pn|x|y|s[^aeiou])',noun,re.I) else 'il '
   new=article+noun
   if new!=h:
    it['h']=new;it['x']=it['x'].replace(h,new).replace(h[0].upper()+h[1:],new[0].upper()+new[1:])
  for lang,allowed in {'en':['kind','plural'],'de':['kind','gender','plural','genitiveSingular'],'es':['kind','gender','plural'],'it':['kind','gender','plural']}.items():
   if 'f' in e[lang]:e[lang]['f']={k:v for k,v in e[lang]['f'].items() if k in allowed}
  keys=[]
  for l in LANGS:
   z=e[l];h=z.get('h','');x=z.get('x','');assert isinstance(h,str) and 1<len(h)<=120,'invalid headword'
   assert isinstance(x,str) and 10<len(x)<=350,'missing/invalid example'
   assert not re.search(r'[|<>]',h+x),'unprocessed markup'
   assert not re.search(r'(we talked about|we discussed|pratade om|hablamos sobre)',x,re.I),'generic discussion template'
   if l=='fa':assert 'f' not in z and re.search('[آ-ی]',h) and not re.search('[A-Za-z]',h),'Persian format'
   else:
    f=z.get('f',{});assert all(not re.search(r'[:|<>]|production:|genitive:',str(v)) for v in f.values()),'Unprocessed morphology';assert f.get('kind')=='noun','missing noun morphology'
    assert f.get('plural') or l=='sv' or len(z.get('n',''))>3,'missing plural or mass note'
    if l=='de':assert f.get('genitiveSingular') and h.startswith(f.get('gender','INVALID')+' '),'German gender/genitive'
    if l=='es':assert f.get('gender') in ['el','la'] and h.startswith(('el ','la ','los ','las ')),'Spanish gender/article'
    if l=='it':assert f.get('gender') in ['il','la'] and h.startswith(('il ','lo ','la ',"l'",'gli ','i ','le ')),'Italian gender/article'
    if l=='en':assert h.startswith('the '),'English noun article'
   k=key(h,l);assert k and k not in keys,'cross-language ambiguity within concept'
   assert k not in seen,'existing or in-batch headword/automatic-language collision'
   keys.append(k)
  accepted.append({'id':id,'p':'noun','t':['daily'],'e':e})
  seen.update(keys)
 except (AssertionError,ValueError,KeyError,TypeError) as ex:rejected.append({'id':id,'word':pool.get(id,{}).get('word'),'reason':str(ex),'provider':provider,'file':file})
selected=accepted[:2000]
out={'format':'lingo3-vocab/1','langs':LANGS,'n':len(selected),'concepts':selected}
assert len(selected)==1079 and not rejected,(len(selected),rejected[:3])
(DATA/'batch-008-part-001.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'concepts':len(selected),'cards':len(selected)*6,'failures':0}))
