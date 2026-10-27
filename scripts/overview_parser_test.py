import unittest, pathlib
from importlib.machinery import SourceFileLoader
parser=SourceFileLoader('overviews',str(pathlib.Path(__file__).with_name('import-overviews.py'))).load_module()
class OverviewTests(unittest.TestCase):
    def test_overview_retains_links(self):
        result=parser.extract('<h2><span id="Overview">Overview</span></h2><p>A <a href="/wiki/Matrix_Lab">lab</a>.</p><h2>Recipes</h2><p>Ignore</p>')
        self.assertEqual(result[0][1]['wikiTitle'],'Matrix Lab')
        self.assertEqual(len(result),1)
    def test_lead_excludes_quote(self):
        result=parser.extract('<blockquote><p>Game quote</p></blockquote><p>Useful lead.</p><h2>Crafting</h2>')
        self.assertEqual(result,[[{'text':'Useful lead.'}]])
    def test_stub_uses_infobox_not_quote(self):
        result=parser.extract('<aside><h2>Lab</h2><h3 class="pi-data-label">Made In</h3><div class="pi-data-value pi-font"><a href="/wiki/Assembler">Assembler</a></div></aside><blockquote><p>Game quote</p></blockquote><h2>Crafting</h2>')
        self.assertEqual(result[0][0],{'text':'Made In: ','bold':True})
        self.assertEqual(result[0][1]['wikiTitle'],'Assembler')
    def test_empty_is_not_fabricated(self):
        self.assertEqual(parser.extract('<h2>Crafting</h2>'),[])
if __name__=='__main__':unittest.main()
