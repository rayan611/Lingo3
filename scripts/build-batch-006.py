#!/usr/bin/env python3
"""Rebuild the data-only batch from its reviewed translations and Lexin forms.

No network, model calls, database writes, or app changes. Examples use parallel
everyday sentence frames; the frame is selected explicitly for each concept.
Swedish forms come from the attributed Lexin source snapshot, with overrides
for modern preferred forms and count/mass usage. Other forms are curated.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/shared-vocab'
LANGS = ['fa', 'en', 'sv', 'de', 'es', 'it']
IT_FEM = set('adozione azione attività età alleanza alternativa ambasciata ambizione analisi anatra ancora accusa osservazione antichità istruzione albicocca arena opinione ispezione emorragia ipotesi enfasi epidemia esplosione origine iniziale incubatrice oasi ala'.split())
DE_WEAK = {
 'Abonnent':'Abonnenten','Agent':'Agenten','Akrobat':'Akrobaten',
 'Aktivist':'Aktivisten','Amateur':'Amateurs','Archäologe':'Archäologen',
 'Architekt':'Architekten','Artist':'Artisten','Erbe':'Erben',
 'Assistent':'Assistenten','Astronaut':'Astronauten','Automat':'Automaten',
 'Bandit':'Banditen','Bär':'Bären','Bauer':'Bauern','Biologe':'Biologen',
 'Diamant':'Diamanten','Diplomat':'Diplomaten','Dirigent':'Dirigenten',
 'Elefant':'Elefanten','Experte':'Experten','Falke':'Falken',
 'Gefangene':'Gefangenen','Favorit':'Favoriten','Philosoph':'Philosophen',
 'Verkaufsautomat':'Verkaufsautomaten',
}
SV_PL = {'bonus':('bonusar','bonusarna'),'diet':('dieter','dieterna'),
         'byrå':('byråer','byråerna'),'betoning':('betoningar','betoningarna'),
         'geni':('genier','genierna'),'pronomen':('pronomen','pronomenen'),
         'förskola':('förskolor','förskolorna'),'framsida':('framsidor','framsidorna'),
         'lock':('lock','locken'),'galopp':('galopper','galopperna'),
         'genombrott':('genombrott','genombrotten'),'genomsnitt':('genomsnitt','genomsnitten'),
         'grannskap':('grannskap','grannskapen'),'hot':('hot','hoten'),
         'inblick':('inblickar','inblickarna'),'innehåll':('innehåll','innehållen'),
         'inträde':('inträden','inträdena'),'isolering':('isoleringar','isoleringarna'),
         'kapacitet':('kapaciteter','kapaciteterna'),'kiwi':('kiwier','kiwierna'),
         'kompetens':('kompetenser','kompetenserna'),'konsistens':('konsistenser','konsistenserna'),
         'kristall':('kristaller','kristallerna'),'jour':('jourer','jourerna'),
         'omkrets':('omkretsar','omkretsarna'),'omsättning':('omsättningar','omsättningarna'),
         'prioritet':('prioriteter','prioriteterna')}

def split_form(value):
    h, plural = value.split(';')
    return h, plural

def bare(h, lang):
    if lang == 'it' and h.startswith("l'"):
        return h[2:]
    return h.split(' ', 1)[1] if lang in {'sv','de','es','it'} else h

def de_acc(h):
    if not h.startswith('der '): return h
    base = h[4:]
    if base[0].islower() and ' ' in base:
        adjective,noun=base.split(' ',1)
        return 'den '+adjective.removesuffix('e')+'en '+noun
    return 'den ' + {'volle Tag':'vollen Tag'}.get(base,DE_WEAK.get(base, base))

def it_di(h):
    if h.startswith("l'"): return "dell'" + h[2:]
    article, noun = h.split(' ', 1)
    return {'il':'del','lo':'dello','la':'della','i':'dei','gli':'degli','le':'delle'}[article] + ' ' + noun

def sv_forms(lemma, raw, gender):
    raw = raw.replace('i(e)n','in').replace('(e)','e').replace('(n)','n').replace('(t)','t')
    raw = re.sub(r'\s*\((?:el\.|eller)[^)]*\)', '', raw)
    parts = raw.split()
    ds = parts[0]
    result = {'kind':'noun','gender':gender,'definiteSingular':ds}
    if lemma in SV_PL:
        ip, dp = SV_PL[lemma]
    elif len(parts) >= 3:
        ip, dp = parts[1:3]
    elif len(parts) == 2:
        ip = parts[1]
        if ip.endswith('r'): dp = ip + 'na'
        elif gender == 'ett' and ip.endswith('n'): dp = ip + 'a'
        elif gender == 'ett': dp = ip + 'en'
        else: raise ValueError(('Review plural', lemma, raw))
    else:
        return result
    result.update(indefinitePlural=ip, definitePlural=dp)
    return result

def make_examples(heads, ds, frame):
    fa, en, sv, de, es, it = [heads[l] for l in LANGS]
    en = re.sub(r'^(?:the|an|a) ', '', en)
    acc = de_acc(de)
    if frame == 'o':
        return dict(zip(LANGS,[f'{fa} را پیدا نمی‌کنم.',f'I cannot find the {en}.',f'Jag hittar inte {ds}.',f'Ich finde {acc} nicht.',f'No encuentro {es}.',f'Non trovo {it}.']))
    if frame == 'f':
        return dict(zip(LANGS,[f'دیروز {fa} را خریدم.',f'I bought the {en} yesterday.',f'Jag köpte {ds} i går.',f'Ich habe gestern {acc} gekauft.',f'Ayer compré {es}.',f'Ieri ho comprato {it}.']))
    if frame == 'l':
        en_verb='are' if en in {'premises','surroundings'} else 'is'
        it_predicate='sono vicini' if it.startswith(('i ','gli ')) else 'sono vicine' if it.startswith('le ') else 'è vicino'
        return dict(zip(LANGS,[f'{fa} نزدیک ایستگاه است.',f'The {en} {en_verb} near the station.',f'{ds.capitalize()} ligger nära stationen.',f'{de[0].upper()+de[1:]} liegt in der Nähe des Bahnhofs.',f'{es.capitalize()} está cerca de la estación.',f'{it.capitalize()} {it_predicate} alla stazione.']))
    if frame == 'p':
        return dict(zip(LANGS,[f'{fa} امروز تماس گرفت.',f'The {en} called today.',f'{ds.capitalize()} ringde i dag.',f'{de[0].upper()+de[1:]} hat heute angerufen.',f'{es.capitalize()} ha llamado hoy.',f'{it.capitalize()} ha chiamato oggi.']))
    if frame == 's':
        return dict(zip(LANGS,[f'دیروز {fa} را دیدیم.',f'We saw the {en} yesterday.',f'Vi såg {ds} i går.',f'Wir haben gestern {acc} gesehen.',f'Ayer vimos {es}.',f'Ieri abbiamo visto {it}.']))
    assert frame == 'a'
    return dict(zip(LANGS,[f'امروز دربارهٔ {fa} صحبت کردیم.',f'We talked about the {en} today.',f'Vi pratade om {ds} i dag.',f'Wir haben heute über {acc} gesprochen.',f'Hoy hablamos sobre {es}.',f'Oggi abbiamo parlato {it_di(it)}.']))

def main():
    source = json.loads((DATA/'batch-006-lexin.json').read_text())
    selected = source['selected']
    concepts = []
    # Weak masculine nouns and nominal adjectives have an oblique -n/-en.
    # Derive only the reviewed patterns supported by the supplied plural.
    for item in selected:
        de_h,de_pl=split_form(item['parts'][3])
        g,base=de_h.split(' ',1)
        if g=='der' and de_pl in {base+'n',base+'en'} and (item['parts'][6] in {'p','s'} or base.endswith(('e','ant','ent','ist','at','nom','graf','arch','ot'))) and not base.endswith('see'):
            DE_WEAK[base]=de_pl
    for item in selected:
        sv, en, fa, de, es, it, frame = item['parts']
        heads = item['e']
        forms = {'sv':sv_forms(sv, item['raw'],item['gender'])}
        en_h,en_pl = split_form(en)
        forms['en'] = {'kind':'noun', **({'plural':en_pl} if en_pl else {})}
        de_h,de_pl = split_form(de)
        de_g,de_base = de_h.split(' ',1)
        gen = de_base if de_g=='die' else DE_WEAK.get(de_base, de_base + ('es' if de_base.endswith(('s','ß','x','z')) else 's'))
        gen = {'Nachname':'Nachnamens','Atlas':'Atlasses','Gefängnis':'Gefängnisses','volle Tag':'vollen Tages'}.get(de_base,gen)
        gen = {'Gott':'Gottes','Genus':'Genus','Ganze':'Ganzen','Landesinnere':'Landesinneren','Funke':'Funkens','Name':'Namens','Buchstabe':'Buchstabens'}.get(de_base,gen)
        if de_g=='der' and de_base.lower().endswith('name'):gen=de_base+'ns'
        if de_base[0].islower() and ' ' in de_base:
            adjective,noun=de_base.split(' ',1)
            gen_noun = noun if de_g=='die' else {'Mann':'Mannes'}.get(noun,noun+('es' if noun.endswith(('s','ß','x','z')) else 's'))
            gen=adjective.removesuffix('e')+'en '+gen_noun
        forms['de'] = {'kind':'noun','gender':de_g,'genitiveSingular':gen,**({'plural':de_pl} if de_pl else {})}
        es_h,es_pl = split_form(es)
        es_article=es_h.split()[0]
        es_gender='la' if es_article in {'la','las'} or es_h in {'el ancla','el asa','el ala','el hacha','el acta','el águila','el agua','el arma','el alma','el aula'} else 'el'
        forms['es'] = {'kind':'noun','gender':es_gender,**({'plural':es_pl} if es_pl else {})}
        it_h,it_pl = split_form(it)
        it_base = bare(it_h,'it')
        it_first = it_base.split()[0]
        it_feminine = it_first.endswith(('zione','sione','tà','tù')) or bool(it_pl and it_pl.split()[0].endswith('e'))
        it_g = item.get('genders',{}).get('it') or ('la' if it_h.startswith(('la ','le ')) or it_base in IT_FEM or (it_h.startswith("l'") and (it_pl.endswith('e') or it_feminine)) else 'il')
        forms['it'] = {'kind':'noun','gender':it_g,'plural':it_pl}
        examples=make_examples(heads,forms['sv']['definiteSingular'],frame)
        entries={}
        for lang in LANGS:
            entry={'h':heads[lang],'x':examples[lang]}
            if lang!='fa': entry['f']=forms[lang]
            if lang=='en' and en_h in {'sweets','scissors','binoculars','tweezers','minutes','overalls','premises','surroundings','barracks','kennels','slippery conditions'}:
                entry['f']['plural']=en_h
                entry['n']='Plural form in this sense.'
            if lang=='fa':entry['n']='اسم؛ جنسیت دستوری ندارد. معنیِ انتخاب‌شده با مثال مشخص شده است.'
            elif lang=='sv' and 'indefinitePlural' not in forms['sv']:
                entry['n']='Vanligen utan plural i denna betydelse.'
            elif lang in ('en','de','es','it') and not forms[lang].get('plural') and not entry.get('n'):
                entry['n']={'en':'Usually uncountable in this sense.','de':'In dieser Bedeutung gewöhnlich ohne Plural.','es':'Normalmente incontable en este sentido.','it':'Normalmente non numerabile in questo significato.'}[lang]
            entries[lang]=entry
        concepts.append({'id':item['id'],'p':'noun','t':[{'o':'home','f':'food','l':'travel','p':'work','s':'daily','a':'daily'}[frame]],'e':entries})
    out={'format':'lingo3-vocab/1','langs':LANGS,'n':len(concepts),'concepts':concepts}
    (DATA/'batch-006.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print(f'{len(concepts)} concepts, {sum(len(c["e"]) for c in concepts)} entries')

if __name__=='__main__':main()
