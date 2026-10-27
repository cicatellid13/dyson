"""Cache wiki Overview paragraphs as safe structured text, resolving item aliases."""
import json, re, pathlib, concurrent.futures, datetime, urllib.parse, sys
from html.parser import HTMLParser
from importlib.machinery import SourceFileLoader
wiki = SourceFileLoader('wiki_import', str(pathlib.Path(__file__).with_name('import-wiki.py'))).load_module()
ROOT = wiki.ROOT
class OverviewParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.paragraphs=[]; self.current=None; self.link=None; self.bold=0
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag in ('p','li'):
            if self.current: self.paragraphs.append(self.current)
            self.current=[]
        if tag=='a':
            href=attrs.get('href','')
            self.link=urllib.parse.unquote(href.split('/wiki/',1)[1].split('#')[0]).replace('_',' ') if '/wiki/' in href else None
        if tag in ('b','strong'): self.bold+=1
        if tag=='br': self.handle_data('\n')
    def handle_endtag(self,tag):
        if tag in ('p','li') and self.current is not None:
            if ''.join(s['text'] for s in self.current).strip(): self.paragraphs.append(self.current)
            self.current=None
        if tag=='a': self.link=None
        if tag in ('b','strong'): self.bold=max(0,self.bold-1)
    def handle_data(self,text):
        if self.current is None: return
        segment={'text':re.sub(r'\s+',' ',text)}
        if self.link: segment['wikiTitle']=self.link
        if self.bold: segment['bold']=True
        self.current.append(segment)
def parse_paragraphs(html):
    parser=OverviewParser(); parser.feed(html)
    return parser.paragraphs

def extract(html):
    match=re.search(r'<h([1-6])\b[^>]*>.*?id="Overview".*?</h\1>',html,re.S)
    if match:
        body=re.split(r'<h[12]\b',html[match.end():],maxsplit=1)[0]
        paragraphs=parse_paragraphs(body)
        if paragraphs: return paragraphs
    # Some pages have a lead rather than an Overview heading. Exclude quotes,
    # infoboxes and tables so the in-game description stays in the info popup.
    lead=re.sub(r'<(aside|blockquote|table)\b[^>]*>.*?</\1>', '', html, flags=re.S)
    lead=re.split(r'<h[1-6]\b',lead,maxsplit=1)[0]
    paragraphs=parse_paragraphs(lead)
    if paragraphs: return paragraphs
    # Stub articles can still have useful infobox facts. Preserve linked names.
    info=re.search(r'<aside\b[^>]*>.*?</aside>',html,re.S)
    if not info: return []
    fields=re.findall(r'<h3[^>]*>(.*?)</h3>\s*<div class="pi-data-value[^"]*">(.*?)</div>',info[0],re.S)
    allowed={'Category','Made In','Unlocked Under','Version Added','Energy','Fuel Chamber Generation','Work Consumption','Idle Consumption','Production Speed','Research Speed'}
    return [paragraph for label,value in fields if re.sub('<[^>]+>','',label).strip() in allowed
            for paragraph in parse_paragraphs('<p><strong>'+label+': </strong>'+value+'</p>')]

def main():
    path=ROOT/'public/data/catalog.json'; catalog=json.loads(path.read_text())
    cache=ROOT/'.cache/wiki-overviews'; cache.mkdir(parents=True,exist_ok=True)
    def fetch(item):
        file=cache/f"{item['id']}.json"
        if file.exists() and not ('--refresh-missing' in sys.argv and not item.get('overview')): result=json.loads(file.read_text())
        else:
            result=wiki.api(action='parse',page=item['name'],prop='text',redirects='1')
            if 'error' in result:
                if result['error'].get('code')=='missingtitle':
                    print('Missing wiki page:',item['name'])
                    return item['id'],item.get('overview',[])
                raise ValueError('Wiki page fetch failed: '+item['name'])
            file.write_text(json.dumps(result))
        return item['id'],extract(result['parse']['text']['*'])
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: overviews=dict(pool.map(fetch,catalog['items']))
    titles=sorted({s['wikiTitle'] for p in overviews.values() for paragraph in p for s in paragraph if 'wikiTitle' in s})
    aliases={}
    for start in range(0,len(titles),40):
        result=wiki.api(action='query',titles='|'.join(titles[start:start+40]),redirects='1')['query']
        for entry in result.get('normalized',[])+result.get('redirects',[]): aliases[entry['from']]=entry['to']
    ids={i['name'].casefold():i['id'] for i in catalog['items']}
    for item in catalog['items']:
        item['overview']=overviews[item['id']]
        for paragraph in item['overview']:
            for segment in paragraph:
                title=segment.pop('wikiTitle',None)
                if title:
                    seen=set()
                    while title in aliases and title not in seen: seen.add(title); title=aliases[title]
                    if title.casefold() in ids: segment['itemId']=ids[title.casefold()]
        item['overviewSource']=f"https://dyson-sphere-program.fandom.com/wiki/{urllib.parse.quote(item['name'].replace(' ','_'))}"
    catalog['downloaded']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    temp=path.with_suffix('.json.tmp'); temp.write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))); temp.replace(path)
    print(f"Cached Overview sections for {sum(bool(i['overview']) for i in catalog['items'])}/{len(catalog['items'])} items.")
    print('No Overview:', ', '.join(i['name'] for i in catalog['items'] if not i['overview']))
if __name__=='__main__': main()
