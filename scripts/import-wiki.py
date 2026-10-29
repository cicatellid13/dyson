"""Import the wiki's declarative Lua data without executing it. Standard library only."""
import re, json, pathlib, urllib.parse, concurrent.futures, datetime, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
API='https://dyson-sphere-program.fandom.com/api.php'
SOURCE='https://dyson-sphere-program.fandom.com/wiki/Module:Recipe/Data'
def get(url):
    return subprocess.check_output(['curl', '--fail', '--location', '--silent', '--show-error',
        '--retry', '3', '--max-time', '40', '-H', 'User-Agent: DSP-Toolkit/2.0',
        '-H', 'Referer: https://dyson-sphere-program.fandom.com/', url])
def api(**params):
    return json.loads(get(API+'?'+urllib.parse.urlencode(dict(format='json',**params))))
def parse_lua(s):
    # This source is only literals/tables. Reject any executable syntax.
    pattern=r'\s+|--\[\[[\s\S]*?\]\]|--[^\n]*|\'(?:\\.|[^\'\\])*\'|"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?|[A-Za-z_]\w*|[{}\[\]=,;]'
    tokens=[]; end=0
    for m in re.finditer(pattern,s):
        if s[end:m.start()].strip(): raise ValueError('Unsupported Lua syntax')
        end=m.end(); t=m.group()
        if not t.isspace() and not t.startswith('--'): tokens.append(t)
    if s[end:].strip(): raise ValueError('Trailing syntax')
    pos=0
    def pop():
        nonlocal pos
        t=tokens[pos]; pos+=1; return t
    def value():
        t=pop()
        if t=='{':
            fields={}; entries=[]
            while tokens[pos]!='}':
                if tokens[pos]=='[':
                    pop(); key=value(); assert pop()==']'; assert pop()=='='; fields[str(key)]=value()
                elif pos+1<len(tokens) and tokens[pos+1]=='=':
                    key=pop(); pop(); fields[key]=value()
                else: entries.append(value())
                if tokens[pos] in (',',';'): pop()
            pop()
            if fields and entries: raise ValueError('Mixed table')
            return fields or entries
        if t[0] in "\"'":
            return re.sub(r'\\(.)',lambda m:{'n':'\n','r':'\r','t':'\t'}.get(m[1],m[1]),t[1:-1])
        if t in ('true','false','nil'): return {'true':True,'false':False,'nil':None}[t]
        if re.fullmatch(r'-?\d+(\.\d+)?',t): return float(t) if '.' in t else int(t)
        raise ValueError('Not a literal: '+t)
    assert pop()=='return'; data=value(); assert pos==len(tokens); return data

def main():
    response=api(action='query',prop='revisions',rvprop='content|ids|timestamp',titles='Module:Recipe/Data')
    revision=next(iter(response['query']['pages'].values()))['revisions'][0]
    data=parse_lua(revision['*'])
    items=[dict(v,id=int(k)) for k,v in data['game_items'].items() if not v.get('disabled')]
    recipes=[r for r in data['game_recipes'] if not r.get('disabled')]
    ids={i['id'] for i in items}
    recipes=[r for r in recipes if all(x in ids for x in r['inputs'][::2]+r['outputs'][::2])]
    icons={}; missing=[]
    for start in range(0,len(items),40):
        names=['File:'+i['name']+'.png' for i in items[start:start+40]]
        result=api(action='query',prop='imageinfo',iiprop='url',titles='|'.join(names),redirects='1')
        pages=result['query']['pages'].values()
        urls={p['title']:p['imageinfo'][0]['url'] for p in pages if p.get('imageinfo')}
        for rename in result['query'].get('normalized',[])+result['query'].get('redirects',[]):
            if rename['to'] in urls: urls[rename['from']]=urls[rename['to']]
        for item in items[start:start+40]:
            url=urls.get('File:'+item['name']+'.png')
            if url: icons[item['id']]=url
            else: missing.append(item['name'])
    def download(pair):
        id,url=pair
        for ext in ('png','webp','jpg'):
            target=ROOT/'public/icons'/f'{id}.{ext}'
            if target.exists(): return id,f'icons/{id}.{ext}'
        content=get(url)
        ext='png' if content.startswith(b'\x89PNG') else 'webp' if content[:4]==b'RIFF' and content[8:12]==b'WEBP' else 'jpg' if content[:2]==b'\xff\xd8' else None
        if not ext: raise ValueError('Unsupported image: '+url)
        target=ROOT/'public/icons'/f'{id}.{ext}';target.write_bytes(content)
        return id,f'icons/{id}.{ext}'
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: paths=dict(pool.map(download,icons.items()))
    for r in recipes: r['seconds']=float(r['seconds'])
    for i in items:
        i['icon']=paths.get(i['id'])
        i['description']=re.sub('<[^>]*>','',i.get('description',''))
        if i.get('mining_from'): i['mining_from']=re.sub('<[^>]*>','',i['mining_from'])
    out=dict(source=SOURCE,revision=revision['revid'],sourceUpdated=revision['timestamp'],downloaded=datetime.datetime.now(datetime.timezone.utc).isoformat(),items=items,recipes=recipes,techs=data['game_techs'],facilities=data['game_facilities'],categories=data['categories'],missingIcons=missing)
    # Refresh prose together with recipe data so a refresh never drops Overviews.
    temporary=ROOT/'public/data/catalog.json.tmp'
    temporary.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')))
    temporary.replace(ROOT/'public/data/catalog.json')
    print(f'Imported {len(items)} items, {len(recipes)} recipes, {len(icons)} icons. Missing: {missing}')
if __name__=='__main__':
    main()
    subprocess.run(['python3', str(ROOT/'scripts/import-overviews.py')], check=True)
